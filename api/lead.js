import { randomBytes, createHash } from 'node:crypto';

const hash = text => createHash('sha256').update(text).digest('hex');
const notificationEmail = process.env.LEAD_NOTIFY_EMAIL || 'raiznoblemx@gmail.com';

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

async function notifyLead(profile, createdAt) {
  if (!process.env.RESEND_API_KEY) return false;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.LEAD_FROM_EMAIL || 'Aburto Pro Coach <onboarding@resend.dev>',
      to: [notificationEmail],
      subject: 'Nueva solicitud de prueba — Asistente Aburto',
      text: [
        'Nueva solicitud de prueba desde el asistente de Aburto Pro Coach.',
        '',
        `Nombre: ${profile.name}`,
        `Contacto: ${profile.contact}`,
        `Interés: ${profile.interest || 'Por definir'}`,
        `Experiencia: ${profile.experience || 'Por definir'}`,
        `Modalidad: ${profile.modality || 'Por definir'}`,
        `Momento para comenzar: ${profile.timing || 'Por definir'}`,
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

  const ready = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!ready) return res.status(503).json({ error: 'Captura temporalmente no disponible.' });

  try {
    if (req.headers.origin && req.headers.origin !== `https://${req.headers.host}`) {
      return res.status(403).json({ error: 'Origen no permitido.' });
    }

    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const rateKey = `aburto:lead-rate:${hash(ip)}:${Math.floor(Date.now() / 600000)}`;
    const attempts = await redis('INCR', rateKey);
    if (attempts === 1) await redis('EXPIRE', rateKey, 660);
    if (attempts > 20) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });

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

    const createdAt = new Date().toISOString();
    const id = randomBytes(12).toString('hex');
    await redis('SET', `aburto:assistant-lead:${id}`, JSON.stringify({
      ...profile,
      createdAt,
      source: 'assistant',
      testRouting: true,
    }), 'EX', 2592000);

    let notified = false;
    try { notified = await notifyLead(profile, createdAt); } catch { notified = false; }

    return res.status(200).json({ saved: true, notified });
  } catch {
    return res.status(503).json({ error: 'No se pudo guardar la solicitud.' });
  }
}
