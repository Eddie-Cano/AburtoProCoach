import { neon } from '@neondatabase/serverless';

const PROJECT_SLUG = 'andres-aburto';
const DEFAULT_NOTIFY_PHONE = '522282780491';

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
  if (!process.env.DATABASE_URL) return { queued: false, sent: false, reason: 'database_not_configured' };
  const sql = neon(process.env.DATABASE_URL);
  const to = normalizePhone(recipient || process.env.ANDRES_NOTIFICATION_PHONE || DEFAULT_NOTIFY_PHONE);
  const rows = await sql`
    INSERT INTO notifications (project_id, lead_id, channel, recipient, message, status)
    VALUES (${projectId}, ${leadId}, 'whatsapp', ${to}, ${text}, 'pending')
    RETURNING id
  `;
  const notificationId = rows[0].id;

  if (!process.env.OPENWA_BASE_URL || !process.env.OPENWA_API_KEY || !process.env.OPENWA_SESSION_ID) {
    return { queued: true, sent: false, notificationId, reason: 'openwa_not_configured' };
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
    await sql`
      UPDATE notifications
      SET status = 'sent', external_message_id = ${String(data?.messageId || data?.id || '') || null}, sent_at = now()
      WHERE id = ${notificationId}
    `;
    return { queued: true, sent: true, notificationId };
  } catch (error) {
    await sql`
      UPDATE notifications
      SET status = 'failed'
      WHERE id = ${notificationId}
    `;
    return { queued: true, sent: false, notificationId, reason: 'openwa_send_failed' };
  }
}
