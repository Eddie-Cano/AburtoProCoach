import { neon } from '@neondatabase/serverless';

const PROJECT_SLUG = 'andres-aburto';
const DEFAULT_NOTIFY_PHONE = '522282780491';
const CRM_SHEET_ID = '1yE6PJDnBkKTVX1vNLb0dHByWn7FyqkvIn2Er3IMO1FU';
const CRM_SHEET_TAB = 'Contactos';

export function isCoachingLead(profile = {}) {
  const modality = String(profile.modality || '').toLowerCase();
  const interest = String(profile.interest || '').toLowerCase();
  const isDirect = modality.includes('en línea') || modality.includes('online') || modality.includes('presencial');
  const excluded = interest.includes('producto') || interest.includes('posing intensivo') || interest.includes('diario de progreso') || interest.includes('claves antes de competir') || interest.includes('temporizador') || interest.includes('herramienta');
  return isDirect && !excluded;
}

export function normalizePhone(value = '') {
  return String(value).replace(/\D/g, '');
}

export function extractEmail(value = '') {
  return String(value).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() || '';
}

export function extractPhone(value = '') {
  const match = String(value).match(/\+?\d[\d\s().-]{8,}\d/);
  return normalizePhone(match?.[0] || '');
}

export function buildOwnerWhatsApp({ name, phone, email, interest, modality, timing, summary }) {
  const contactLine = phone ? `https://wa.me/${phone}` : 'Sin WhatsApp válido';
  return [
    '🔥 Nuevo lead — Andrés Aburto',
    '',
    `Nombre: ${name || 'Sin nombre'}`,
    `WhatsApp: ${phone || 'No informado'}`,
    `Correo: ${email || 'No informado'}`,
    `Interés: ${interest || 'Por definir'}`,
    `Modalidad: ${modality || 'Por definir'}`,
    `Inicio: ${timing || 'Por definir'}`,
    '',
    `Resumen: ${summary || 'Solicitud directa de coaching.'}`,
    '',
    `💬 Hablar con el lead: ${contactLine}`
  ].join('\n');
}

async function getProject(sql) {
  const rows = await sql`SELECT id FROM projects WHERE slug = ${PROJECT_SLUG} LIMIT 1`;
  if (!rows?.[0]?.id) throw new Error('project missing');
  return rows[0].id;
}

export async function saveLeadCore(payload) {
  if (!process.env.DATABASE_URL) return { saved: false, reason: 'database_not_configured' };
  const sql = neon(process.env.DATABASE_URL);
  const projectId = await getProject(sql);
  const rows = await sql`
    INSERT INTO leads (project_id, name, phone, email, source, interest, status, priority, summary, notes, metadata)
    VALUES (
      ${projectId},
      ${payload.name || null},
      ${payload.phone || null},
      ${payload.email || null},
      ${payload.source || 'website'},
      ${payload.interest || null},
      'new',
      ${payload.priority || 'normal'},
      ${payload.summary || null},
      ${payload.notes || null},
      ${JSON.stringify(payload.metadata || {})}::jsonb
    )
    RETURNING id, created_at
  `;
  const lead = rows[0];
  await sql`
    INSERT INTO lead_events (project_id, lead_id, event_type, source, payload)
    VALUES (${projectId}, ${lead.id}, 'lead.created', ${payload.source || 'website'}, ${JSON.stringify(payload.metadata || {})}::jsonb)
  `;
  return { saved: true, leadId: lead.id, createdAt: lead.created_at, projectId };
}

export async function queueAndSendWhatsApp({ leadId, projectId, recipient, text }) {
  const to = normalizePhone(recipient || process.env.ANDRES_NOTIFICATION_PHONE || DEFAULT_NOTIFY_PHONE);
  const provider = String(process.env.WHATSAPP_PROVIDER || 'meta').toLowerCase();

  let sql = null;
  let notificationId = null;

  if (process.env.DATABASE_URL && projectId && leadId) {
    try {
      sql = neon(process.env.DATABASE_URL);
      const rows = await sql`
        INSERT INTO notifications (project_id, lead_id, channel, recipient, message, status)
        VALUES (${projectId}, ${leadId}, 'whatsapp', ${to}, ${text}, 'pending')
        RETURNING id
      `;
      notificationId = rows?.[0]?.id || null;
    } catch {
      sql = null;
      notificationId = null;
    }
  }

  if (provider === 'meta') {
    if (!process.env.META_WHATSAPP_TOKEN || !process.env.META_PHONE_NUMBER_ID) {
      return { queued: Boolean(notificationId), sent: false, notificationId, reason: 'meta_not_configured' };
    }

    try {
      const graphVersion = process.env.META_GRAPH_VERSION || 'v25.0';
      const response = await fetch(
        `https://graph.facebook.com/${graphVersion}/${process.env.META_PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.META_WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'text',
            text: { preview_url: false, body: text },
          }),
          signal: AbortSignal.timeout(10000),
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message || `Meta ${response.status}`);

      if (sql && notificationId) {
        try {
          await sql`
            UPDATE notifications
            SET status = 'sent',
                external_message_id = ${String(data?.messages?.[0]?.id || '') || null},
                sent_at = now()
            WHERE id = ${notificationId}
          `;
        } catch {}
      }

      return {
        queued: Boolean(notificationId),
        sent: true,
        notificationId,
        provider: 'meta',
        externalMessageId: String(data?.messages?.[0]?.id || '') || null,
      };
    } catch (error) {
      if (sql && notificationId) {
        try {
          await sql`
            UPDATE notifications
            SET status = 'failed'
            WHERE id = ${notificationId}
          `;
        } catch {}
      }
      return {
        queued: Boolean(notificationId),
        sent: false,
        notificationId,
        provider: 'meta',
        reason: 'meta_send_failed',
      };
    }
  }

  if (!process.env.OPENWA_BASE_URL || !process.env.OPENWA_API_KEY || !process.env.OPENWA_SESSION_ID) {
    return { queued: Boolean(notificationId), sent: false, notificationId, reason: 'openwa_not_configured' };
  }

  try {
    const response = await fetch(
      `${process.env.OPENWA_BASE_URL.replace(/\/$/, '')}/api/sessions/${encodeURIComponent(process.env.OPENWA_SESSION_ID)}/messages/send-text`,
      {
        method: 'POST',
        headers: {
          'X-API-Key': process.env.OPENWA_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId: `${to}@c.us`, text }),
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!response.ok) throw new Error(`OpenWA ${response.status}`);
    const data = await response.json().catch(() => ({}));

    if (sql && notificationId) {
      try {
        await sql`
          UPDATE notifications
          SET status = 'sent',
              external_message_id = ${String(data?.messageId || data?.id || '') || null},
              sent_at = now()
          WHERE id = ${notificationId}
        `;
      } catch {}
    }

    return { queued: Boolean(notificationId), sent: true, notificationId, provider: 'openwa' };
  } catch {
    if (sql && notificationId) {
      try {
        await sql`
          UPDATE notifications
          SET status = 'failed'
          WHERE id = ${notificationId}
      `;
      } catch {}
    }
    return { queued: Boolean(notificationId), sent: false, notificationId, reason: 'openwa_send_failed' };
  }
}

export async function syncLeadToCrm(payload = {}) {
  const row = {
    id: payload.id || '',
    createdAt: payload.createdAt || new Date().toISOString(),
    channel: payload.channel || 'Otro',
    source: payload.source || '',
    name: payload.name || '',
    email: payload.email || '',
    phone: payload.phone || '',
    interest: payload.interest || '',
    modality: payload.modality || '',
    experience: payload.experience || '',
    timing: payload.timing || '',
    message: payload.message || '',
    route: payload.route || '',
    status: payload.status || 'Nuevo',
    priority: payload.priority || 'Media',
    owner: payload.owner || '',
    nextFollowUp: payload.nextFollowUp || '',
    notes: payload.notes || '',
    consent: payload.consent || '',
    originUrl: payload.originUrl || '',
    utmSource: payload.utmSource || '',
    utmCampaign: payload.utmCampaign || '',
    updatedAt: payload.updatedAt || new Date().toISOString(),
    dedupeId: payload.dedupeId || payload.id || '',
  };

  // The live site cannot reuse the ChatGPT Google Drive connection.
  // A small Google Apps Script/webhook (or service-account adapter) will receive
  // this exact CRM payload and append it to the existing Contactos tab.
  if (!process.env.GOOGLE_SHEETS_WEBHOOK_URL) {
    if (process.env.DATABASE_URL && payload.projectId && payload.leadId) {
      try {
        const sql = neon(process.env.DATABASE_URL);
        await sql`
          INSERT INTO lead_events (project_id, lead_id, event_type, source, payload)
          VALUES (
            ${payload.projectId},
            ${payload.leadId},
            'crm.sync.pending',
            ${payload.source || 'website'},
            ${JSON.stringify({ sheetId: CRM_SHEET_ID, sheetTab: CRM_SHEET_TAB, row })}::jsonb
          )
        `;
      } catch {}
    }
    return { synced: false, queued: true, reason: 'crm_webhook_not_configured' };
  }

  try {
    const response = await fetch(process.env.GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.CRM_WEBHOOK_SECRET
          ? { 'X-CRM-Secret': process.env.CRM_WEBHOOK_SECRET }
          : {}),
      },
      body: JSON.stringify({
        sheetId: CRM_SHEET_ID,
        sheetTab: CRM_SHEET_TAB,
        row,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`CRM webhook ${response.status}`);
    return { synced: true, queued: false };
  } catch {
    if (process.env.DATABASE_URL && payload.projectId && payload.leadId) {
      try {
        const sql = neon(process.env.DATABASE_URL);
        await sql`
          INSERT INTO lead_events (project_id, lead_id, event_type, source, payload)
          VALUES (
            ${payload.projectId},
            ${payload.leadId},
            'crm.sync.failed',
            ${payload.source || 'website'},
            ${JSON.stringify({ sheetId: CRM_SHEET_ID, sheetTab: CRM_SHEET_TAB, row })}::jsonb
          )
        `;
      } catch {}
    }
    return { synced: false, queued: true, reason: 'crm_webhook_failed' };
  }
}
