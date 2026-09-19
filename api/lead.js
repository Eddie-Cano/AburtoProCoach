import { randomBytes, createHash } from 'node:crypto';

const hash = text => createHash('sha256').update(text).digest('hex');
const notificationEmail = 'raiznoblemx@gmail.com';
const whatsappNumber = '522282780491';

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

async function notifyLead(profile, createdAt, requestId) {
  if (!process.env.RESEND_API_KEY) return false;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `aburto-lead-${requestId}`,
    },
    body: JSON.stringify({
      from: process.env.LEAD_FROM_EMAIL || 'Aburto Pro Coach <onboarding@resend.dev>',
      to: [notificationEmail],
      subject: 'Nueva solicitud — Asistente Aburto',
      text: [
        'Nueva solicitud desde el asistente de Aburto Pro Coach.',
        '',
        `Nombre: ${profile.name}`,
        `Contacto: ${profile.contact}`,
        `Interés: ${profile.interest || 'Por definir'}`,
        `Experiencia: ${profile.experience || 'Por definir'}`,
        `Modalidad: ${profile.modality || 'Por definir'}`,
        `Momento para comenzar: ${profile.timing || 'Por definir'}`,
        `Ruta sugerida: ${recommendation(profile)}`,
        `WhatsApp de seguimiento: +52 228 278 0491`,
        `Fecha: ${createdAt}`,
        '',
        'No se incluyen datos médicos ni información corporal de la calculadora.',
      ].join('\n'),
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('notification unavailable');
  return true;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  const storageReady = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  const emailReady = Boolean(process.env.RESEND_API_KEY);
  if (!storageReady && !emailReady) return res.status(503).json({ error: 'Captura temporalmente no disponible.' });

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

    if (storageReady) {
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
      const rateKey = `aburto:lead-rate:${hash(ip)}:${Math.floor(Date.now() / 600000)}`;
      const attempts = await redis('INCR', rateKey);
      if (attempts === 1) await redis('EXPIRE', rateKey, 660);
      if (attempts > 20) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
    }

    const createdAt = new Date().toISOString();
    const id = randomBytes(12).toString('hex');
    let saved = false;
    if (storageReady) {
      try {
        await redis('SET', `aburto:assistant-lead:${id}`, JSON.stringify({
          ...profile,
          recommendation: recommendation(profile),
          createdAt,
          source: 'assistant',
          routing: { email: notificationEmail, whatsapp: whatsappNumber },
        }), 'EX', 2592000);
        saved = true;
      } catch { saved = false; }
    }

    let notified = false;
    try { notified = await notifyLead(profile, createdAt, id); } catch { notified = false; }

    if (!saved && !notified) return res.status(503).json({ error: 'No se pudo guardar ni enviar la solicitud.' });
    return res.status(200).json({ saved, notified, whatsappNumber });
  } catch {
    return res.status(503).json({ error: 'No se pudo procesar la solicitud.' });
  }
}
