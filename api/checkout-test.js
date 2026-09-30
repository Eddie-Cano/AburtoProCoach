import { createHash } from 'node:crypto';

const SITE = 'https://www.aburtoprocoach.com';
const PRODUCTS = Object.freeze({
  '5-claves': { name: '5 Claves Antes de Competir', amount: 32000 },
  '5-habitos-dia-29': { name: 'El Día 29', amount: 52600 },
  'romantizar-la-prep': { name: 'Romantizar la Prep', amount: 52600 },
});

function sameOrigin(req) {
  const origin = String(req.headers.origin || '');
  return [SITE, 'https://aburtoprocoach.com', ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : [])].includes(origin);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Origen no permitido.' });
  if (!process.env.STRIPE_TEST_SECRET_KEY) return res.status(503).json({ error: 'STRIPE_TEST_SECRET_KEY no está configurada.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const slug = String(body.product || '5-claves');
    const product = PRODUCTS[slug];
    if (!product) return res.status(400).json({ error: 'Producto de prueba no válido.' });

    const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
    const idem = createHash('sha256').update(`sandbox:${slug}:${ip}:${Math.floor(Date.now()/60000)}`).digest('hex');

    const params = new URLSearchParams({
      mode: 'payment',
      locale: 'es',
      customer_creation: 'always',
      'phone_number_collection[enabled]': 'true',
      'line_items[0][price_data][currency]': 'mxn',
      'line_items[0][price_data][unit_amount]': String(product.amount),
      'line_items[0][price_data][product_data][name]': `[SANDBOX] ${product.name}`,
      'line_items[0][quantity]': '1',
      'metadata[project]': 'andres-aburto',
      'metadata[product_slug]': slug,
      'metadata[kind]': 'digital',
      'metadata[sandbox_test]': 'true',
      integration_identifier: 'aburto_sandboxx',
      success_url: `${SITE}/sandbox.html?status=success&product=${encodeURIComponent(slug)}`,
      cancel_url: `${SITE}/sandbox.html?status=cancelled&product=${encodeURIComponent(slug)}`,
    });

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_TEST_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': `aburto/sandbox/${idem}`,
      },
      body: params,
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.url) return res.status(502).json({ error: data?.error?.message || 'Stripe Sandbox no respondió.' });
    return res.status(200).json({ url: data.url });
  } catch {
    return res.status(503).json({ error: 'No pudimos abrir el checkout Sandbox.' });
  }
}
