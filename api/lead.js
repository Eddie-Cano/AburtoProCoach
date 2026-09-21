import { createHash } from 'node:crypto';
import {
  extractEmail,
  extractPhone,
  isCoachingLead,
  saveLeadCore,
  syncLeadToCrm,
} from './_leadcore.js';

const hash = text => createHash('sha256').update(text).digest('hex');

async function redis(...command) {
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('storage unavailable');
  const data = await response.json();
  if (data.error) throw new Error('storage error');
  return data.result;
}

async function sendEmail({ to, subject, text, idempotencyKey }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      from: process.env.LEAD_FROM_EMAIL || 'Aburto Pro Coach <onboarding@resend.dev>',
      to: [to],
      subject,
      text,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('notification unavailable');
  return true;
}

function recommendation(profile) {
  const target = `${profile.interest} ${profile.experience} ${profile.modality}`.toLowerCase();
  if (target.includes('trainer presencial')) return 'Trainer Presencial — $10,440 MXN';
  if (target.includes('coaching 1 a 1')) return 'Coaching 1 a 1 online — $2,830 MXN';
  if (target.includes('bodybuilding')) return 'Bodybuilding Training System — $3,140 MXN';
  if (target.includes('posing coaching')) return 'Posing Coaching | Aburto Team — $2,620 MXN';
  if (target.includes('preparación para competencia')) return 'Preparación para Competencia — $4,180 MXN';
  if (target.includes('5 claves')) return '5 Claves Antes de Competir — $320 MXN';
  if (target.includes('posing intensivo')) return 'Posing Intensivo — próximamente';
  if (target.includes('diario de progreso')) return 'Diario de Progreso — próximamente';
  return 'Conversación inicial para definir la mejor ruta';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  try {
    if (req.headers.origin && req.headers.origin !== `https://${req.headers.host}`) {
      return res.status(403).json({ error: 'Origen no permitido.' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); }
      catch { return res.status(400).json({ error: 'Datos inválidos.' }); }
    }

    const clean = value => String(value || '').trim().slice(0, 500);
    const profile = {
      interest: clean(body?.interest),
      experience: clean(body?.experience),
      modality: clean(body?.modality),
      timing: clean(body?.timing),
      name: clean(body?.name).slice(0, 100),
      contact: clean(body?.contact).slice(0, 200),
      consent: body?.consent === true ? true : body?.consent === false ? false : null,
    };

    if (profile.name.length < 2 || profile.contact.length < 3) {
      return res.status(400).json({ error: 'Falta nombre o contacto.' });
    }

    const storageReady = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
    if (storageReady) {
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
      const rateKey = `aburto:lead-rate:${hash(ip)}:${Math.floor(Date.now() / 600000)}`;
      const attempts = await redis('INCR', rateKey);
      if (attempts === 1) await redis('EXPIRE', rateKey, 660);
      if (attempts > 20) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
    }

    const route = recommendation(profile);
    const email = extractEmail(profile.contact);
    const phone = extractPhone(profile.contact);
    const notifyEligible = isCoachingLead(profile);
    const lowerInterest = profile.interest.toLowerCase();
    const isPosingTool = lowerInterest.includes('temporizador') || lowerInterest.includes('posing lab');
    const isProduct = lowerInterest.includes('producto') ||
      ['5 claves antes de competir', 'posing intensivo', 'diario de progreso'].some(item => lowerInterest.includes(item));
    const submissionId = hash(`${profile.name}:${profile.contact}:${profile.interest}:${Date.now()}`).slice(0, 24);
    const summary = [
      `${profile.name} solicita atención de Andrés.`,
      `Interés: ${profile.interest || 'Por definir'}.`,
      `Experiencia: ${profile.experience || 'Por definir'}.`,
      `Modalidad: ${profile.modality || 'Por definir'}.`,
      `Inicio: ${profile.timing || 'Por definir'}.`,
      `Ruta sugerida: ${route}.`,
    ].join(' ');

    let core = { saved: false };
    try {
      core = await saveLeadCore({
        name: profile.name,
        phone,
        email,
        source: isPosingTool ? 'posing-lab' : 'assistant',
        interest: profile.interest,
        priority: notifyEligible ? 'high' : 'normal',
        summary,
        metadata: {
          experience: profile.experience,
          modality: profile.modality,
          timing: profile.timing,
          recommendation: route,
          notifyEligible,
        },
      });
    } catch {
      core = { saved: false };
    }

    let fallbackSaved = false;
    if (!core.saved && storageReady) {
      try {
        await redis('SET', `aburto:assistant-lead:${submissionId}`, JSON.stringify({
          ...profile,
          recommendation: route,
          source: isPosingTool ? 'posing-lab' : 'assistant',
          notifyEligible,
          createdAt: new Date().toISOString(),
        }), 'EX', 2592000);
        fallbackSaved = true;
      } catch {
        fallbackSaved = false;
      }
    }

    const saved = core.saved || fallbackSaved;

    const crmChannel = notifyEligible
      ? 'Consulta'
      : isPosingTool
        ? 'Herramienta'
        : isProduct
        ? 'Producto digital'
        : 'Asistente';

    const crmDelivery = await syncLeadToCrm({
      id: core.leadId || `AB-${submissionId.slice(0, 12)}`,
      leadId: core.leadId || '',
      projectId: core.projectId || '',
      createdAt: core.createdAt || new Date().toISOString(),
      channel: crmChannel,
      source: notifyEligible
        ? `Asistente Aburto — Coaching ${profile.modality}`
        : isPosingTool
          ? 'Posing Lab'
          : isProduct
            ? profile.interest
            : 'Asistente Aburto',
      name: profile.name,
      email,
      phone,
      interest: profile.interest,
      modality: profile.modality,
      experience: profile.experience,
      timing: profile.timing,
      message: summary,
      route,
      status: 'Nuevo',
      priority: notifyEligible ? 'Alta' : 'Media',
      owner: notifyEligible ? 'Andrés Aburto' : 'Compartido',
      consent: profile.consent === true ? 'Sí' : notifyEligible ? 'Solicitud directa' : '',
      originUrl: req.headers.referer || req.headers.origin || `https://${req.headers.host}`,
      notes: notifyEligible ? 'Solicitud registrada para seguimiento. WhatsApp reservado a ventas confirmadas por Stripe.' : 'Registro sin alerta de WhatsApp.',
      dedupeId: core.leadId || submissionId,
    });

    let userCopySent = false;
    if (isPosingTool && email && process.env.RESEND_API_KEY) {
      try {
        await sendEmail({
          to: email,
          subject: 'Tu acceso al Posing Lab — Aburto Pro Coach',
          text: [
            `Hola ${profile.name},`,
            '',
            'Tu acceso gratuito al Posing Lab quedó activado.',
            '',
            `Categoría inicial: ${profile.experience || 'Por definir'}`,
            `Ruta sugerida: ${route}`,
            '',
            'Por privacidad, esta copia no contiene datos médicos, medidas corporales ni resultados de la calculadora.',
            'Si tú no enviaste esta solicitud, puedes ignorar este mensaje.',
          ].join('\n'),
          idempotencyKey: `aburto-posing-user-${submissionId}`,
        });
        userCopySent = true;
      } catch {
        userCopySent = false;
      }
    }

    // El asistente nunca dispara WhatsApp. Las alertas de WhatsApp quedan reservadas
    // exclusivamente para compras confirmadas por Stripe en /api/stripe-webhook.
    const accepted = saved || crmDelivery.synced === true;
    if (!accepted) return res.status(503).json({ error: 'No se pudo procesar la solicitud.' });

    return res.status(200).json({
      saved,
      leadId: core.leadId || null,
      notifyEligible,
      route,
      userCopySent,
      crmSynced: crmDelivery.synced === true,
      crmQueued: crmDelivery.queued === true,
    });
  } catch {
    return res.status(503).json({ error: 'No se pudo procesar la solicitud.' });
  }
}
