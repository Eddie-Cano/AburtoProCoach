import { createHash } from 'node:crypto';
import { LAUNCH } from '../lib/launch-config.js';
import { getManualOffer } from '../lib/manual-offer.js';
import { googleAccessToken } from './stripe-webhook.js';

const SITE = 'https://www.aburtoprocoach.com';
const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function createStripeSession(email, offer, body) {
  const idempotencyKey = createHash('sha256').update(
    `${email}:${offer.stage}:${Math.floor(Date.now() / 60000)}`
  ).digest('hex');
  const params = new URLSearchParams({
    mode: 'payment',
    locale: 'es',
    integration_identifier: 'aburto_qmztvphk',
    customer_email: email,
    customer_creation: 'always',
    'line_items[0][price]': offer.stage === 'founding' ? LAUNCH.foundingStripePrice : LAUNCH.regularStripePrice,
    'line_items[0][quantity]': '1',
    'metadata[project]': 'andres-aburto',
    'metadata[product_slug]': 'starter-pack',
    'metadata[kind]': 'digital',
    'metadata[offer]': offer.stage === 'founding' ? 'founding' : 'regular',
    'metadata[founding_assignment]': 'manual_sheets',
    'metadata[legal_acceptance]': 'privacy_confidentiality_v1',
    'metadata[legal_accepted_at]': new Date().toISOString(),
    'metadata[utm_source]': String(body.utmSource || '').slice(0,100),
    'metadata[utm_campaign]': String(body.utmCampaign || '').slice(0,100),
    'phone_number_collection[enabled]': 'true',
    success_url: `${SITE}/compra-confirmada.html`,
    cancel_url: `${SITE}/productos/starter-pack.html#comprar`,
  });
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': `aburto/pack-manual/${idempotencyKey}`,
    },
    body: params,
    signal: AbortSignal.timeout(15000),
  });
  const session = await response.json().catch(() => ({}));
  if (!response.ok || !session.url) throw new Error('Could not create Stripe Checkout Session');
  return session.url;
}

export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({error:'Método no permitido.'});
  try {
    const token = await googleAccessToken();
    const offer = await getManualOffer(token);
    if (req.method === 'GET') return res.status(200).json(offer);
    const origin = String(req.headers.origin || '');
    if (![SITE,'https://aburtoprocoach.com',
      ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : [])].includes(origin)) {
      return res.status(403).json({error:'Origen no permitido.'});
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const email = String(body.email || '').trim().toLowerCase();
    if (body.product !== 'starter-pack' || !validEmail.test(email) || email.length > 254) {
      return res.status(400).json({error:'Escribe un correo válido.'});
    }
    if (body.acceptedConfidentiality !== true) {
      return res.status(400).json({error:'Debes aceptar el Aviso de Privacidad y el Acuerdo de Confidencialidad.'});
    }
    if (!offer.checkoutReady) return res.status(409).json({error:'La compra todavía no está disponible.',offer});
    if (Number(body.expectedPrice) !== offer.price) return res.status(409).json({error:'El precio ha cambiado. Actualiza la página y revisa el importe.',offer});
    return res.status(200).json({url:await createStripeSession(email,offer,body)});
  } catch (error) {
    console.error('commerce failed',error?.message);
    return res.status(503).json({error:'Estamos preparando la compra. Intenta de nuevo más tarde.'});
  }
}
