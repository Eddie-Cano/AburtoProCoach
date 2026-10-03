import { createHash } from 'node:crypto';
import { ENGLISH_PRICES } from '../lib/english-stripe-prices.js';
import { englishEdition } from '../lib/product-editions.js';

const SITE = 'https://www.aburtoprocoach.com';

const PRODUCTS = Object.freeze({
  '5-habitos-dia-29': {
    name: 'El Día 29',
    amount: 52600,
    cancelPath: '/productos/5-habitos.html',
  },
  'romantizar-la-prep': {
    name: 'Romantizar la Prep',
    amount: 52600,
    cancelPath: '/productos/romantizar-la-prep.html',
  },
  '5-claves': {
    name: '5 Claves Antes de Competir',
    amount: 32000,
    cancelPath: '/productos/5-claves.html',
  },
});

function sameOrigin(req) {
  const origin = String(req.headers.origin || '');
  return [
    SITE,
    'https://aburtoprocoach.com',
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ].includes(origin);
}

async function createStripeCheckout(product, slug, body, req) {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('stripe_not_configured');
  const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const bucket = Math.floor(Date.now() / 60000);
  const idem = createHash('sha256')
    .update(`${slug}:${body.language}:${ip}:${bucket}:${String(body.utmSource || '')}:${String(body.utmCampaign || '')}`)
    .digest('hex');

  const params = new URLSearchParams({
    mode: 'payment',
    locale: body.language,
    customer_creation: 'always',
    'phone_number_collection[enabled]': 'true',
    'line_items[0][price_data][currency]': 'mxn',
    'line_items[0][price_data][unit_amount]': String(product.amount),
    'line_items[0][price_data][product_data][name]': product.name,
    'line_items[0][price_data][product_data][metadata][project]': 'andres-aburto',
    'line_items[0][price_data][product_data][metadata][product_slug]': slug,
    'line_items[0][quantity]': '1',
    'metadata[project]': 'andres-aburto',
    'metadata[product_slug]': slug,
    'metadata[kind]': 'digital',
    'metadata[language]': body.language,
    'line_items[0][price_data][product_data][metadata][language]': body.language,
    'metadata[legal_acceptance]': 'privacy_confidentiality_v1',
    'metadata[legal_accepted_at]': new Date().toISOString(),
    'metadata[utm_source]': String(body.utmSource || '').slice(0, 100),
    'metadata[utm_campaign]': String(body.utmCampaign || '').slice(0, 100),
    integration_identifier: 'aburto_qmztvphk',
    success_url: `${SITE}/compra-confirmada.html?producto=${encodeURIComponent(slug)}&lang=${body.language}`,
    cancel_url: `${SITE}${product.cancelPath}?pago=cancelado&lang=${body.language}`,
  });

  if (body.language === 'en') {
    for (const key of [...params.keys()]) if (key.startsWith('line_items[0][price_data]')) params.delete(key);
    params.set('line_items[0][price]', ENGLISH_PRICES[slug]);
  }

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': `aburto/digital/${idem}`,
    },
    body: params,
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.url) throw new Error('stripe_checkout_failed');
  return data.url;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Origen no permitido.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const slug = String(body.product || '');
    body.language ??= 'es';
    if (!['es', 'en'].includes(body.language)) return res.status(400).json({ error: 'Idioma no válido.' });
    const base = PRODUCTS[slug];
    const product = base && { ...base, ...(body.language === 'en' ? { name: `${englishEdition(slug).name} — English Edition` } : {}) };
    if (!product) return res.status(400).json({ error: 'Producto no válido.' });
    if (body.acceptedConfidentiality !== true) {
      return res.status(400).json({ error: 'Debes aceptar el Aviso de Privacidad y el Acuerdo de Confidencialidad.' });
    }

    const url = await createStripeCheckout(product, slug, body, req);
    return res.status(200).json({ url });
  } catch {
    return res.status(503).json({ error: 'No pudimos abrir el checkout. Intenta nuevamente.' });
  }
}
