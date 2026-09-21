import { createHmac, timingSafeEqual } from 'node:crypto';
import { queueAndSendWhatsApp } from './_leadcore.js';

export const config = { api: { bodyParser: false } };

const CRM_SHEET_ID = '1yE6PJDnBkKTVX1vNLb0dHByWn7FyqkvIn2Er3IMO1FU';
const CRM_SHEET_TAB = 'Ventas';
const SALES_EMAIL = 'raiznoblemx@gmail.com';
const DEFAULT_RAIZ_PHONE = '522282780491';

const PRODUCT_NAMES = {
  '5-claves': '5 Claves Antes de Competir',
  '5-claves-antes-de-competir': '5 Claves Antes de Competir',
  'coaching-1a1-online': 'Coaching 1 a 1 — Online',
  'coaching-1-a-1-online': 'Coaching 1 a 1 — Online',
  'coaching-1a1-presencial': 'Trainer Presencial',
  'coaching-1-a-1-presencial': 'Trainer Presencial',
  'bodybuilding-training-system': 'Bodybuilding Training System',
  'posing-coaching': 'Posing Coaching | Aburto Team',
  'preparacion-competencia': 'Preparación para Competencia',
};

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function verifyStripeSignature(body, signature, secret) {
  if (!signature || !secret) return false;
  const fields = Object.fromEntries(
    signature.split(',').map(part => {
      const [key, value] = part.split('=');
      return [key, value];
    })
  );
  const timestamp = fields.t;
  const candidates = signature.split(',').filter(x => x.startsWith('v1=')).map(x => x.slice(3));
  if (!timestamp || candidates.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return candidates.some(candidate => {
    try {
      const candidateBuffer = Buffer.from(candidate, 'hex');
      return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer);
    } catch {
      return false;
    }
  });
}

async function redis(...command) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('redis unavailable');
  const data = await response.json();
  if (data.error) throw new Error('redis error');
  return data.result;
}

async function sendEmail({ subject, text, eventId }) {
  if (!process.env.RESEND_API_KEY) return { sent: false, reason: 'resend_not_configured' };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `aburto-sale-${eventId}`,
    },
    body: JSON.stringify({
      from: process.env.LEAD_FROM_EMAIL || 'Aburto Pro Coach <onboarding@resend.dev>',
      to: [SALES_EMAIL],
      subject,
      text,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('email failed');
  return { sent: true };
}

async function syncSaleToCrm(sale) {
  if (!process.env.GOOGLE_SHEETS_WEBHOOK_URL) {
    return { synced: false, reason: 'crm_webhook_not_configured' };
  }
  const secret = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET || process.env.CRM_WEBHOOK_SECRET || '';
  const values = [
    sale.saleId,
    sale.createdAt,
    sale.eventId,
    sale.checkoutSessionId,
    sale.paymentLinkId,
    sale.kind,
    sale.productName,
    sale.productSlug,
    sale.name,
    sale.email,
    sale.phone,
    sale.amountMxn,
    sale.currency,
    sale.paymentStatus,
    sale.paymentIntentId,
    sale.whatsappStatus,
    sale.emailStatus,
    'Stripe Payment Link',
  ];
  const response = await fetch(process.env.GOOGLE_SHEETS_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { 'X-CRM-Secret': secret } : {}),
    },
    body: JSON.stringify({
      secret,
      sheetId: CRM_SHEET_ID,
      sheetTab: CRM_SHEET_TAB,
      dedupeKey: sale.checkoutSessionId,
      values,
      sale,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`CRM webhook ${response.status}`);
  const data = await response.json().catch(() => ({}));
  if (data.ok !== true) throw new Error('CRM webhook rejected');
  return { synced: true };
}

function saleMessage(sale) {
  return [
    '💰 NUEVA VENTA — ANDRÉS ABURTO',
    '',
    `Producto/servicio: ${sale.productName}`,
    `Tipo: ${sale.kind === 'digital' ? 'Producto digital' : 'Servicio'}`,
    `Monto: $${sale.amountMxn.toLocaleString('es-MX')} MXN`,
    '',
    `Cliente: ${sale.name || 'Sin nombre'}`,
    `Correo: ${sale.email || 'No informado'}`,
    `WhatsApp: ${sale.phone || 'No informado'}`,
    '',
    `Stripe Checkout: ${sale.checkoutSessionId}`,
    `Payment Intent: ${sale.paymentIntentId || 'No disponible'}`,
    '',
    'Pago confirmado por Stripe.',
  ].join('\n');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  let event;
  try {
    const body = await rawBody(req);
    const signature = String(req.headers['stripe-signature'] || '');
    if (!verifyStripeSignature(body, signature, process.env.STRIPE_WEBHOOK_SECRET || '')) {
      return res.status(400).json({ error: 'Firma inválida.' });
    }
    event = JSON.parse(body.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Webhook inválido.' });
  }

  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
    return res.status(200).json({ received: true, ignored: true });
  }

  const session = event?.data?.object || {};
  if (session.livemode !== true || session.metadata?.project !== 'andres-aburto') {
    return res.status(200).json({ received: true, ignored: true });
  }
  if (!['paid', 'no_payment_required'].includes(String(session.payment_status || ''))) {
    return res.status(200).json({ received: true, pending: true });
  }

  const eventKey = `aburto:stripe-event:${event.id}`;
  try {
    const existing = await redis('GET', eventKey);
    if (existing) return res.status(200).json({ received: true, duplicate: true });
    const lock = await redis('SET', eventKey, 'processing', 'NX', 'EX', 3600);
    if (lock === null && process.env.UPSTASH_REDIS_REST_URL) {
      return res.status(200).json({ received: true, duplicate: true });
    }
  } catch {
    return res.status(503).json({ error: 'No se pudo asegurar la deduplicación.' });
  }

  const slug = String(session.metadata?.product_slug || 'venta');
  const sale = {
    saleId: `SALE-${String(session.id || event.id).replace(/^cs_/, '').slice(0, 18)}`,
    eventId: String(event.id || ''),
    checkoutSessionId: String(session.id || ''),
    paymentLinkId: String(session.payment_link || ''),
    paymentIntentId: String(session.payment_intent || ''),
    productSlug: slug,
    productName: PRODUCT_NAMES[slug] || slug,
    kind: String(session.metadata?.kind || 'service'),
    name: String(session.customer_details?.name || session.customer_details?.individual_name || ''),
    email: String(session.customer_details?.email || session.customer_email || ''),
    phone: String(session.customer_details?.phone || ''),
    amountMxn: Number(session.amount_total || 0) / 100,
    currency: String(session.currency || 'mxn').toUpperCase(),
    paymentStatus: String(session.payment_status || ''),
    createdAt: new Date(Number(session.created || Math.floor(Date.now()/1000)) * 1000).toISOString(),
    whatsappStatus: 'Pendiente',
    emailStatus: 'Pendiente',
  };

  try {
    const whatsapp = await queueAndSendWhatsApp({
      recipient: process.env.RAIZ_NOTIFICATION_PHONE || DEFAULT_RAIZ_PHONE,
      text: saleMessage(sale),
    });
    sale.whatsappStatus = whatsapp.sent ? 'Enviado' : `Pendiente: ${whatsapp.reason || 'no enviado'}`;

    const emailText = [
      'Nueva venta confirmada — Andrés Aburto Pro Coach',
      '',
      `Producto/servicio: ${sale.productName}`,
      `Tipo: ${sale.kind === 'digital' ? 'Producto digital' : 'Servicio'}`,
      `Monto: $${sale.amountMxn.toLocaleString('es-MX')} MXN`,
      `Estado Stripe: ${sale.paymentStatus}`,
      '',
      `Cliente: ${sale.name || 'Sin nombre'}`,
      `Correo: ${sale.email || 'No informado'}`,
      `WhatsApp: ${sale.phone || 'No informado'}`,
      '',
      `Checkout Session: ${sale.checkoutSessionId}`,
      `Payment Link: ${sale.paymentLinkId || 'No disponible'}`,
      `Payment Intent: ${sale.paymentIntentId || 'No disponible'}`,
    ].join('\n');

    const email = await sendEmail({
      subject: `Nueva venta: ${sale.productName} — $${sale.amountMxn.toLocaleString('es-MX')} MXN`,
      text: emailText,
      eventId: event.id,
    });
    sale.emailStatus = email.sent ? 'Enviado' : `Pendiente: ${email.reason || 'no enviado'}`;

    const crm = await syncSaleToCrm(sale);

    if (!whatsapp.sent || !email.sent || !crm.synced) {
      try { await redis('DEL', eventKey); } catch {}
      return res.status(503).json({
        error: 'Venta confirmada, pero falta completar una o más entregas.',
        whatsapp: sale.whatsappStatus,
        email: sale.emailStatus,
        crm: crm.synced ? 'Sincronizado' : crm.reason,
      });
    }

    try { await redis('SET', eventKey, 'done', 'EX', 2592000); } catch {}
    return res.status(200).json({ received: true, saleId: sale.saleId, crmSynced: true });
  } catch {
    try { await redis('DEL', eventKey); } catch {}
    return res.status(503).json({ error: 'No se pudo completar la notificación de venta.' });
  }
}
