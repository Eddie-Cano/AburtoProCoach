import { createHash, randomUUID } from 'node:crypto';
import { LAUNCH } from '../lib/launch-config.js';
import { getOffer, reserveMember, bindReservation, releaseReservation } from '../lib/founding.js';
import { redis } from '../lib/redis.js';

const SITE = 'https://www.aburtoprocoach.com';
async function stripe(path, body, key) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': key },
    body: new URLSearchParams(body), signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error('Stripe checkout unavailable'); error.definitive = response.status >= 400 && response.status < 500; throw error; }
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Método no permitido.' });
  try {
    let offer = await getOffer();
    if (req.method === 'GET') return res.status(200).json(offer);
    const origin = String(req.headers.origin || '');
    if (![SITE, 'https://aburtoprocoach.com', ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : [])].includes(origin)) return res.status(403).json({ error: 'Origen no permitido.' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    if (body.product !== 'starter-pack' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: 'Escribe un correo válido.' });
    if (body.acceptedConfidentiality !== true) return res.status(400).json({ error: 'Debes aceptar el Aviso de Privacidad y el Acuerdo de Confidencialidad.' });
    if (!offer.checkoutReady) return res.status(409).json({ error: 'La compra todavía no está disponible. Consulta la fecha de apertura.', offer });
    const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0];
    const rateKey = `aburto:checkout-rate:${createHash('sha256').update(ip).digest('hex')}:${Math.floor(Date.now() / 3600000)}`;
    const attempts = await redis('INCR', rateKey);
    if (attempts === 1) await redis('EXPIRE', rateKey, 3700);
    if (attempts > 20) return res.status(429).json({ error: 'Demasiados intentos. Vuelve a consultar más tarde.' });
    let reservation = null;
    if (offer.stage === 'founding') {
      const reserved = await reserveMember(email, offer);
      if (reserved.state === 'member') {
        offer = { ...offer, price: LAUNCH.regularPrice, discountPercent: 23, foundingAccess: false };
      } else if (reserved.state === 'pending' && reserved.reservation?.url) {
        return res.status(200).json({ url: reserved.reservation.url });
      } else if (['reserved', 'pending'].includes(reserved.state)) reservation = reserved.reservation;
      else return res.status(409).json({ error: reserved.state === 'closed' ? 'La apertura ha cerrado. Consulta el precio actual del Starter Pack.' : 'Todos los lugares están confirmados o en proceso de pago.', offer: await getOffer() });
    }
    if (Number(body.expectedPrice) !== offer.price) {
      if (reservation && !reservation.sessionId) await releaseReservation(reservation.id);
      return res.status(409).json({ error: 'El precio cambió. Revisa la oferta actual y vuelve a continuar.', offer });
    }
    const requestId = reservation?.id || randomUUID();
    const params = {
      mode: 'payment', locale: 'es', integration_identifier: 'aburto_qmztvphk',
      'line_items[0][price]': reservation ? LAUNCH.foundingStripePrice : LAUNCH.regularStripePrice,
      'line_items[0][quantity]': '1',
      'metadata[project]': 'andres-aburto', 'metadata[product_slug]': 'starter-pack', 'metadata[kind]': 'digital',
      'metadata[legal_acceptance]': 'privacy_confidentiality_v1', 'metadata[legal_accepted_at]': new Date().toISOString(),
      'metadata[offer]': reservation ? 'founding' : 'regular', 'metadata[reservation_id]': reservation?.id || '',
      'phone_number_collection[enabled]': 'true',
      'metadata[utm_source]': String(body.utmSource || '').slice(0, 100), 'metadata[utm_campaign]': String(body.utmCampaign || '').slice(0, 100),
      success_url: `${SITE}/compra-confirmada.html`, cancel_url: `${SITE}/productos/starter-pack.html#comprar`,
      ...(reservation ? { expires_at: String(reservation.expiresAt) } : {}),
    };
    try {
      // An existing Stripe Customer with an email prevents edits in Checkout,
      // keeping the membership reservation and Drive recipient on one address.
      const customer = await stripe('/customers', { email, 'metadata[project]': 'andres-aburto' }, `aburto/pack-customer/${requestId}`);
      params.customer = customer.id;
      const session = await stripe('/checkout/sessions', params, `aburto/pack/${requestId}`);
      if (reservation) await bindReservation(reservation, session);
      return res.status(200).json({ url: session.url });
    } catch (error) {
      if (reservation && error.definitive) await releaseReservation(reservation.id);
      throw error;
    }
  } catch {
    return res.status(503).json({ error: 'Estamos preparando la compra. Intenta de nuevo más tarde.' });
  }
}
