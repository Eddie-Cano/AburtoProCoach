import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { saveLeadCore } from './_leadcore.js';

const hash = text => createHash('sha256').update(text).digest('hex');
const emailKey = email => `aburto:lead:${hash(email)}`;

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
  if (!response.ok) throw new Error('email unavailable');
  return true;
}

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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const ready = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Método no permitido.' });
  if (!ready) return res.status(req.method === 'GET' ? 200 : 503).json({ ready: false, registered: false, error: 'El registro está temporalmente fuera de servicio. Inténtalo más tarde.' });

  try {
    const token = String(req.headers.cookie || '').match(/(?:^|;\s*)aburto_access=([a-f0-9]{64})(?:;|$)/)?.[1];
    if (token && await redis('GET', `aburto:session:${hash(token)}`)) return res.status(200).json({ ready: true, registered: true });
    if (req.method === 'GET') return res.status(200).json({ ready: true, registered: false });
    if (req.headers.origin && req.headers.origin !== `https://${req.headers.host}`) return res.status(403).json({ error: 'Origen no permitido.' });

    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const rateKey = `aburto:rate:${hash(ip)}:${Math.floor(Date.now() / 600000)}`;
    const attempts = await redis('INCR', rateKey);
    if (attempts === 1) await redis('EXPIRE', rateKey, 660);
    if (attempts > 20) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); }
      catch { return res.status(400).json({ error: 'Datos inválidos.' }); }
    }

    const email = String(body?.email || '').trim().toLowerCase();
    const phone = String(body?.phone || '').replace(/[^0-9]/g, '');
    const name = String(body?.name || '').trim();
    const returning = body?.returning === true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !/^\d{10,15}$/.test(phone) || (!returning && (name.length < 2 || name.length > 100 || body?.consent !== true))) {
      return res.status(400).json({ error: 'Revisa tu nombre, correo, teléfono y autorización.' });
    }

    const key = emailKey(email);
    let record = await redis('GET', key);
    let coreSaved = false;

    if (!record && !returning) {
      const createdAt = new Date().toISOString();
      const created = await redis('SET', key, JSON.stringify({
        name,
        email,
        phoneHash: hash(phone),
        phone,
        createdAt,
        consentVersion: 'tools-v1',
        marketing: false,
      }), 'NX');
      record = await redis('GET', key);
      if (created) {
        try {
          const core = await saveLeadCore({
            name,
            phone,
            email,
            source: 'free-tools',
            interest: 'Herramientas gratuitas',
            priority: 'normal',
            summary: 'Registro para usar las herramientas gratuitas de Aburto Pro Coach.',
            metadata: { access: 'tools', notifyEligible: false, createdAt },
          });
          coreSaved = core.saved === true;
        } catch {
          coreSaved = false;
        }
      }
    }

    const lead = record ? (typeof record === 'string' ? JSON.parse(record) : record) : null;
    if (!lead || !timingSafeEqual(Buffer.from(lead.phoneHash, 'hex'), Buffer.from(hash(phone), 'hex'))) {
      return res.status(400).json({ error: 'No pudimos habilitar el acceso. Revisa los datos de tu registro o usa otro correo.' });
    }

    const session = randomBytes(32).toString('hex');
    await redis('SET', `aburto:session:${hash(session)}`, key, 'EX', 15552000);
    res.setHeader('Set-Cookie', `aburto_access=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=15552000`);
    return res.status(200).json({
      ready: true,
      registered: true,
      coreSaved,
      ownerNotificationSent: false,
    });
  } catch {
    return res.status(503).json({ error: 'No se pudo completar el registro. Tus herramientas se desbloquearán cuando confirmemos el guardado.' });
  }
}
