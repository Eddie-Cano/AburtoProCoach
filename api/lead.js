import { createHash } from 'node:crypto';
import {
  buildOwnerWhatsApp,
  extractEmail,
  extractPhone,
  isCoachingLead,
  queueAndSendWhatsApp,
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

function recommendation(profile) {
  const target = `${profile.interest} ${profile.experience} ${profile.modality}`.toLowerCase();
  if (target.includes('posing')) return 'Posing intensivo';
  if (target.includes('compet')) return 'Preparación competitiva + 5 claves antes de competir';
  if (target.includes('producto digital')) return target.includes('competido') ? 'Posing intensivo' : 'Diario de progreso';
  if (target.includes('nutric')) return 'Solicitud de orientación en nutrición deportiva';
  if (target.includes('entrenamiento')) return 'Solicitud de entrenamiento personalizado';
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
        source: profile.interest.toLowerCase().includes('temporizador') ? 'posing-lab' : 'assistant',
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
        const id = hash(`${profile.name}:${profile.contact}:${Date.now()}`).slice(0, 24);
        await redis('SET', `aburto:assistant-lead:${id}`, JSON.stringify({
          ...profile,
          recommendation: route,
          source: profile.interest.toLowerCase().includes('temporizador') ? 'posing-lab' : 'assistant',
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
      : (profile.interest.toLowerCase().includes('producto') ||
         ['5 claves antes de competir','posing intensivo','diario de progreso'].some(item => profile.interest.toLowerCase().includes(item)))
        ? 'Producto digital'
        : 'Asistente';

    const crmDelivery = await syncLeadToCrm({
      id: core.leadId || '',
      leadId: core.leadId || '',
      projectId: core.projectId || '',
      createdAt: core.createdAt || new Date().toISOString(),
      channel: crmChannel,
      source: notifyEligible ? `Asistente Aburto — Coaching ${profile.modality}` : 'Asistente Aburto',
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
      consent: notifyEligible ? 'Solicitud directa' : '',
      originUrl: req.headers.origin || `https://${req.headers.host}`,
      notes: notifyEligible ? 'Avisar por WhatsApp al responsable.' : 'Registro sin alerta de WhatsApp.',
      dedupeId: core.leadId || hash(`${profile.name}:${profile.contact}:${profile.interest}`),
    });

    let whatsappQueued = false;
    let whatsappSent = false;
    let whatsappCopiesSent = 0;
    if (notifyEligible) {
      const text = buildOwnerWhatsApp({
        name: profile.name,
        phone,
        email,
        interest: profile.interest,
        modality: profile.modality,
        timing: profile.timing,
        summary,
      });

      const recipients = [
        process.env.ANDRES_NOTIFICATION_PHONE,
        process.env.RAIZ_NOTIFICATION_PHONE,
      ]
        .map(value => String(value || '').trim())
        .filter(Boolean)
        .filter((value, index, list) => list.indexOf(value) === index);

      const deliveries = [];
      for (const recipient of recipients) {
        deliveries.push(await queueAndSendWhatsApp({
          leadId: core.leadId,
          projectId: core.projectId,
          recipient,
          text,
        }));
      }

      whatsappQueued = deliveries.some(delivery => delivery.queued === true);
      whatsappSent = deliveries.some(delivery => delivery.sent === true);
      whatsappCopiesSent = deliveries.filter(delivery => delivery.sent === true).length;
    }

    const accepted = saved || whatsappSent || crmDelivery.synced === true;
    if (!accepted) return res.status(503).json({ error: 'No se pudo procesar la solicitud.' });

    return res.status(200).json({
      saved,
      leadId: core.leadId || null,
      notifyEligible,
      whatsappQueued,
      whatsappSent,
      whatsappCopiesSent,
      route,
      crmSynced: crmDelivery.synced === true,
      crmQueued: crmDelivery.queued === true,
    });
  } catch {
    return res.status(503).json({ error: 'No se pudo procesar la solicitud.' });
  }
}
