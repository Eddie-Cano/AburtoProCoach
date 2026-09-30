import { createHmac, timingSafeEqual } from 'node:crypto';
import { getVercelOidcToken } from '@vercel/oidc';
import { ExternalAccountClient } from 'google-auth-library';
import { queueAndSendWhatsApp } from './_leadcore.js';

export const config = { api: { bodyParser: false } };

const CRM_SHEET_ID = '1yE6PJDnBkKTVX1vNLb0dHByWn7FyqkvIn2Er3IMO1FU';
const CRM_SHEET_TAB = 'Ventas';
const SALES_EMAIL = 'raiznoblemx@gmail.com';
const DEFAULT_RAIZ_PHONE = '522282780491';

const DIGITAL_DELIVERY = {
  '5-claves': {
    fileId: '1jaemoMFdRP071LhxvVQybJ2RsoaO8nEx',
    url: 'https://drive.google.com/file/d/1jaemoMFdRP071LhxvVQybJ2RsoaO8nEx/view',
  },
  '5-claves-antes-de-competir': {
    fileId: '1jaemoMFdRP071LhxvVQybJ2RsoaO8nEx',
    url: 'https://drive.google.com/file/d/1jaemoMFdRP071LhxvVQybJ2RsoaO8nEx/view',
  },
  '5-habitos-dia-29': {
    fileId: '1Nh14AYtgo22X8_v6WoCxCP2mk5VbNvHm',
    url: 'https://drive.google.com/file/d/1Nh14AYtgo22X8_v6WoCxCP2mk5VbNvHm/view',
  },
  'romantizar-la-prep': {
    fileId: '1XU6KOeaVOpWJsiUnV7iS7RGQ-c48Wa8n',
    url: 'https://drive.google.com/file/d/1XU6KOeaVOpWJsiUnV7iS7RGQ-c48Wa8n/view',
  },
};

const PRODUCT_NAMES = {
  '5-claves': '5 Claves Antes de Competir',
  '5-claves-antes-de-competir': '5 Claves Antes de Competir',
  '5-habitos-dia-29': 'El Día 29',
  'romantizar-la-prep': 'Romantizar la Prep',
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

async function sendEmail({ subject, text, html, eventId, to = [SALES_EMAIL], idempotencyPrefix = 'aburto-sale' }) {
  if (!process.env.RESEND_API_KEY) return { sent: false, reason: 'resend_not_configured' };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `${idempotencyPrefix}-${eventId}`,
    },
    body: JSON.stringify({
      from: process.env.LEAD_FROM_EMAIL || 'Aburto Pro Coach <onboarding@resend.dev>',
      to,
      subject,
      text,
      ...(html ? { html } : {}),
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('email failed');
  return { sent: true };
}


async function googleAccessToken() {
  const projectNumber = process.env.GCP_PROJECT_NUMBER || '';
  const poolId = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID || '';
  const providerId = process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID || '';
  const serviceAccountEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';

  if (!projectNumber || !poolId || !providerId || !serviceAccountEmail) return null;

  // The provider's default audience is an HTTPS URL; the OIDC token must match it exactly.
  const audience = `https://iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`;

  const authClient = ExternalAccountClient.fromJSON({
    type: 'external_account',
    audience,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url:
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
    subject_token_supplier: {
      getSubjectToken: () => getVercelOidcToken({ audience }),
    },
  });

  const headers = await authClient.getRequestHeaders();
  const auth = headers.get ? headers.get('authorization') : headers.Authorization || headers.authorization;
  return String(auth || '').replace(/^Bearer\s+/i, '') || null;
}

async function driveApi(path, { method = 'GET', body } = {}) {
  const token = await googleAccessToken();
  if (!token) return { configured: false };
  const response = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`drive api ${response.status}: ${data?.error?.message || 'request failed'}`);
  return { configured: true, data };
}

async function grantDigitalAccess({ slug, email, paymentIntentId }) {
  const product = DIGITAL_DELIVERY[slug];
  if (!product) return { applicable: false, granted: false };
  if (!email) return { applicable: true, granted: false, reason: 'missing_customer_email' };

  const protection = await driveApi(
    `/files/${product.fileId}?supportsAllDrives=true&fields=id,copyRequiresWriterPermission`,
    { method: 'PATCH', body: { copyRequiresWriterPermission: true } }
  );
  if (protection.configured === false) {
    return { applicable: true, granted: false, reason: 'google_drive_not_configured' };
  }

  const permission = await driveApi(
    `/files/${product.fileId}/permissions?supportsAllDrives=true&sendNotificationEmail=false&fields=id,emailAddress,role,type`,
    {
      method: 'POST',
      body: { type: 'user', role: 'reader', emailAddress: email },
    }
  );

  const permissionId = permission.data?.id || '';
  if (paymentIntentId && permissionId) {
    await redis('SET', `aburto:drive-grant:${paymentIntentId}`, JSON.stringify({
      fileId: product.fileId,
      permissionId,
      email,
      slug,
    }), 'EX', 31536000);
  }

  return {
    applicable: true,
    granted: true,
    fileId: product.fileId,
    fileUrl: product.url,
    permissionId,
  };
}

async function revokeDigitalAccess(paymentIntentId) {
  if (!paymentIntentId) return { revoked: false, reason: 'missing_payment_intent' };
  const raw = await redis('GET', `aburto:drive-grant:${paymentIntentId}`);
  if (!raw) return { revoked: false, reason: 'grant_not_found' };
  const grant = JSON.parse(raw);
  const result = await driveApi(
    `/files/${grant.fileId}/permissions/${grant.permissionId}?supportsAllDrives=true`,
    { method: 'DELETE' }
  );
  if (result.configured === false) return { revoked: false, reason: 'google_drive_not_configured' };
  await redis('DEL', `aburto:drive-grant:${paymentIntentId}`);
  return { revoked: true, email: grant.email, slug: grant.slug };
}

async function sendDigitalDeliveryEmail({ sale, delivery, eventId }) {
  if (!delivery?.granted || !sale.email) {
    return { sent: false, reason: delivery?.reason || 'delivery_not_granted' };
  }
  const text = [
    `Hola${sale.name ? ` ${sale.name}` : ''},`,
    '',
    `Tu compra de ${sale.productName} fue confirmada correctamente.`,
    '',
    'Tu acceso está asociado al mismo correo utilizado durante la compra.',
    `Abrir producto: ${delivery.fileUrl}`,
    '',
    'El material es de uso personal. No reenvíes el acceso a terceros.',
    '',
    'Aburto Pro Coach',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;line-height:1.55;color:#111">
      <h2>Tu producto ya está disponible</h2>
      <p>Hola${sale.name ? ` ${sale.name}` : ''}, tu compra de <strong>${sale.productName}</strong> fue confirmada correctamente.</p>
      <p>El acceso fue concedido exclusivamente al correo utilizado durante la compra.</p>
      <p style="margin:28px 0"><a href="${delivery.fileUrl}" style="background:#111;color:#fff;text-decoration:none;padding:14px 20px;border-radius:8px;display:inline-block">ACCEDER A MI PRODUCTO</a></p>
      <p style="font-size:13px;color:#666">Material de uso personal. El enlace requiere la cuenta de Google autorizada.</p>
    </div>`;

  return sendEmail({
    subject: `Tu acceso: ${sale.productName}`,
    text,
    html,
    eventId,
    to: [sale.email],
    idempotencyPrefix: 'aburto-delivery',
  });
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

  if (['charge.refunded', 'charge.dispute.created'].includes(event.type)) {
    const paymentIntentId = String(event?.data?.object?.payment_intent || '');
    try {
      const revoked = await revokeDigitalAccess(paymentIntentId);
      return res.status(200).json({ received: true, accessRevocation: revoked });
    } catch {
      return res.status(503).json({ error: 'No se pudo revocar el acceso digital.' });
    }
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

  const slug = String(session.metadata?.product_slug || 'venta');
  if (DIGITAL_DELIVERY[slug] && (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN)) {
    return res.status(503).json({ error: 'El registro de acceso digital no está configurado.' });
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

  const sale = {
    saleId: `SALE-${String(session.id || event.id).replace(/^cs_/, '').slice(0, 18)}`,
    eventId: String(event.id || ''),
    checkoutSessionId: String(session.id || ''),
    paymentLinkId: String(session.payment_link || ''),
    paymentIntentId: String(session.payment_intent || ''),
    productSlug: slug,
    productName: PRODUCT_NAMES[slug] || slug,
    kind: DIGITAL_DELIVERY[slug] ? 'digital' : String(session.metadata?.kind || 'service'),
    name: String(session.customer_details?.name || session.customer_details?.individual_name || ''),
    email: String(session.customer_details?.email || session.customer_email || ''),
    phone: String(session.customer_details?.phone || ''),
    amountMxn: Number(session.amount_total || 0) / 100,
    currency: String(session.currency || 'mxn').toUpperCase(),
    paymentStatus: String(session.payment_status || ''),
    createdAt: new Date(Number(session.created || Math.floor(Date.now()/1000)) * 1000).toISOString(),
    whatsappStatus: 'Pendiente',
    emailStatus: 'Pendiente',
    deliveryStatus: DIGITAL_DELIVERY[slug] ? 'Pendiente' : 'No aplica',
  };

  try {
    let delivery = { applicable: false, granted: false };
    let customerEmail = { sent: true, reason: 'not_applicable' };
    if (DIGITAL_DELIVERY[slug]) {
      delivery = await grantDigitalAccess({
        slug,
        email: sale.email,
        paymentIntentId: sale.paymentIntentId,
      });
      sale.deliveryStatus = delivery.granted ? 'Drive concedido' : `Pendiente: ${delivery.reason || 'no concedido'}`;
      if (delivery.granted) {
        customerEmail = await sendDigitalDeliveryEmail({ sale, delivery, eventId: event.id });
        sale.deliveryStatus = customerEmail.sent ? 'Drive + correo enviados' : `Drive concedido; correo pendiente: ${customerEmail.reason || 'no enviado'}`;
      }
    }

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
      `Entrega digital: ${sale.deliveryStatus}`,
    ].join('\n');

    const email = await sendEmail({
      subject: `Nueva venta: ${sale.productName} — $${sale.amountMxn.toLocaleString('es-MX')} MXN`,
      text: emailText,
      eventId: event.id,
    });
    sale.emailStatus = email.sent ? 'Enviado' : `Pendiente: ${email.reason || 'no enviado'}`;

    const crm = await syncSaleToCrm(sale);

    const deliveryRequired = DIGITAL_DELIVERY[slug] && process.env.DRIVE_DELIVERY_REQUIRED === 'true';
    const deliveryComplete = !deliveryRequired || (delivery.granted && customerEmail.sent);

    if (!whatsapp.sent || !email.sent || !crm.synced || !deliveryComplete) {
      try { await redis('DEL', eventKey); } catch {}
      return res.status(503).json({
        error: 'Venta confirmada, pero falta completar una o más entregas.',
        whatsapp: sale.whatsappStatus,
        email: sale.emailStatus,
        crm: crm.synced ? 'Sincronizado' : crm.reason,
        delivery: sale.deliveryStatus,
      });
    }

    try { await redis('SET', eventKey, 'done', 'EX', 2592000); } catch {}
    return res.status(200).json({ received: true, saleId: sale.saleId, crmSynced: true });
  } catch {
    try { await redis('DEL', eventKey); } catch {}
    return res.status(503).json({ error: 'No se pudo completar la notificación de venta.' });
  }
}
