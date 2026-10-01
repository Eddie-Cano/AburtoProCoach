import { createHmac, timingSafeEqual } from 'node:crypto';
import { getVercelOidcToken } from '@vercel/oidc';
import { ExternalAccountClient } from 'google-auth-library';
import { queueAndSendWhatsApp } from './_leadcore.js';
import { sendPurchaseDeliveryEmail, sendTransactionalEmail } from './_email.js';
import { PACK_PRODUCTS, LAUNCH } from '../lib/launch-config.js';
import { confirmMember, releaseReservation, emailHash, foundingKeys } from '../lib/founding.js';
import { syncSaleToSheet, saleValues } from '../lib/crm.js';

export const config = { api: { bodyParser: false } };

const CRM_SHEET_ID = '1yE6PJDnBkKTVX1vNLb0dHByWn7FyqkvIn2Er3IMO1FU';
const CRM_SHEET_TAB = 'Ventas';
const SALES_EMAIL = 'raiznoblemx@gmail.com';
const DEFAULT_RAIZ_PHONE = '522282780491';

const DIGITAL_DELIVERY = {
  '5-claves': {
    fileId: '1nLlZJqc6Z0PWgF3Ba2ZVRNJnB-jhDmZX',
    url: 'https://drive.google.com/file/d/1nLlZJqc6Z0PWgF3Ba2ZVRNJnB-jhDmZX/view',
  },
  '5-claves-antes-de-competir': {
    fileId: '1nLlZJqc6Z0PWgF3Ba2ZVRNJnB-jhDmZX',
    url: 'https://drive.google.com/file/d/1nLlZJqc6Z0PWgF3Ba2ZVRNJnB-jhDmZX/view',
  },
  '5-habitos-dia-29': {
    fileId: '1kCBeH1GCDlCKwisuImkvFZ6XPAP3YU9R',
    url: 'https://drive.google.com/file/d/1kCBeH1GCDlCKwisuImkvFZ6XPAP3YU9R/view',
  },
  'romantizar-la-prep': {
    fileId: '1Se6_demNzrfofYmlg5zlWkm7CGZsin-H',
    url: 'https://drive.google.com/file/d/1Se6_demNzrfofYmlg5zlWkm7CGZsin-H/view',
  },
};

const PRODUCT_NAMES = {
  '5-claves': '5 Claves Antes de Competir',
  '5-claves-antes-de-competir': '5 Claves Antes de Competir',
  '5-habitos-dia-29': 'El Día 29',
  'romantizar-la-prep': 'Romantizar la Prep',
  'starter-pack': 'Starter Pack',
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

export function createDriveAuthClient(env = process.env) {
  const projectNumber = env.GCP_PROJECT_NUMBER || '';
  const poolId = env.GCP_WORKLOAD_IDENTITY_POOL_ID || '';
  const providerId = env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID || '';
  const serviceAccountEmail = env.GCP_SERVICE_ACCOUNT_EMAIL || env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';

  if (!projectNumber || !poolId || !providerId || !serviceAccountEmail) return null;

  // STS identifies the Google provider here. The Vercel JWT audience is separate
  // and must be allowed by that provider (https://vercel.com/<team-slug>).
  const audience = `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`;
  const oidcAudience = `https://iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`;

  return ExternalAccountClient.fromJSON({
    type: 'external_account',
    audience,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url:
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
    scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets'],
    subject_token_supplier: {
      getSubjectToken: () => getVercelOidcToken({ audience: oidcAudience }),
    },
  });
}

export async function googleAccessToken() {
  const authClient = createDriveAuthClient();
  if (!authClient) return null;

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

export function deliveryProducts(slug) {
  return slug === 'starter-pack' ? PACK_PRODUCTS : DIGITAL_DELIVERY[slug] ? [{ ...DIGITAL_DELIVERY[slug], slug, name: PRODUCT_NAMES[slug] }] : [];
}

export async function grantDigitalAccess({ slug, email, paymentIntentId }) {
  const products = deliveryProducts(slug);
  if (!products.length) return { applicable: false, granted: false };
  if (!email || !paymentIntentId) return { applicable: true, granted: false, reason: 'missing_customer_or_payment' };
  const key = `aburto:drive-grant:${paymentIntentId}`;
  const saved = JSON.parse(await redis('GET', key) || 'null');
  const grants = saved ? (Array.isArray(saved) ? saved : [saved]) : [];
  for (const product of products) {
    if (grants.some(grant => grant.fileId === product.fileId && grant.permissionId)) continue;
    const granted = await grantFileAccess({ product, email, paymentIntentId });
    if (!granted.granted) return { applicable: true, granted: false, reason: granted.reason, files: grants };
    grants.push({ ...granted, slug: product.slug, name: product.name, email });
    await redis('SET', key, JSON.stringify(grants));
  }
  return { applicable: true, granted: true, fileUrl: products[0].url,
    files: products.map(product => ({ name: product.name, fileUrl: product.url, slug: product.slug })) };
}

async function grantFileAccess({ product, email, paymentIntentId }) {

  // Do not modify file copy/download restrictions here. Those settings require
  // owner/organizer privileges and are unrelated to granting buyer access.
  let existing, pageToken;
  do {
    const listed = await driveApi(`/files/${product.fileId}/permissions?supportsAllDrives=true&fields=nextPageToken,permissions(id,emailAddress,role,type)&pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`);
    existing = listed.data?.permissions?.find(permission => String(permission.emailAddress || '').toLowerCase() === email.toLowerCase());
    pageToken = listed.data?.nextPageToken;
  } while (!existing && pageToken);
  const ownersKey = `aburto:entitlement:${product.fileId}:${emailHash(email)}`;
  if (existing && Number(await redis('SCARD', ownersKey)) === 0) await redis('SADD', ownersKey, 'existing-access');
  const permission = existing ? { data: existing } : await driveApi(
    `/files/${product.fileId}/permissions?supportsAllDrives=true&sendNotificationEmail=false&fields=id,emailAddress,role,type`,
    {
      method: 'POST',
      body: { type: 'user', role: 'reader', emailAddress: email },
    }
  );

  const permissionId = permission.data?.id || '';
  if (!permissionId) throw new Error('Drive permission was not granted');
  await redis('SADD', ownersKey, paymentIntentId);

  return {
    applicable: true,
    granted: true,
    fileId: product.fileId,
    fileUrl: product.url,
    permissionId,
    ownersKey,
  };
}

async function revokeDigitalAccess(paymentIntentId) {
  if (!paymentIntentId) return { revoked: false, reason: 'missing_payment_intent' };
  const raw = await redis('GET', `aburto:drive-grant:${paymentIntentId}`);
  if (!raw) return { revoked: false, reason: 'grant_not_found' };
  const saved = JSON.parse(raw);
  const grants = Array.isArray(saved) ? saved : [saved];
  for (const grant of grants) {
    const ownersKey = grant.ownersKey || `aburto:entitlement:${grant.fileId}:${emailHash(grant.email)}`;
    if (Number(await redis('SCARD', ownersKey)) > 0) {
      await redis('SREM', ownersKey, paymentIntentId);
      if (Number(await redis('SCARD', ownersKey)) > 0) continue;
    }
    const result = await driveApi(`/files/${grant.fileId}/permissions/${grant.permissionId}?supportsAllDrives=true`, { method: 'DELETE' });
    if (result.configured === false) return { revoked: false, reason: 'google_drive_not_configured' };
  }
  await redis('DEL', `aburto:drive-grant:${paymentIntentId}`);
  return { revoked: true, email: grants[0]?.email, slug: grants.length > 1 ? 'starter-pack' : grants[0]?.slug };
}

export async function syncSaleToCrm(sale) {
  if (!process.env.GOOGLE_SHEETS_WEBHOOK_URL) {
    return syncSaleToSheet(sale, await googleAccessToken());
  }
  const secret = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET || process.env.CRM_WEBHOOK_SECRET || '';
  const values = saleValues(sale);
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
  if (sale.foundingMember) await syncSaleToSheet(sale, await googleAccessToken());
  return { synced: true };
}

export function saleMessage(sale) {
  return [
    '💰 NUEVA VENTA — ANDRÉS ABURTO',
    '',
    `Producto/servicio: ${sale.productName}`,
    `Tipo: ${sale.kind === 'digital' ? 'Producto digital' : 'Servicio'}`,
    `Monto: $${sale.amountMxn.toLocaleString('es-MX')} MXN`,
    ...(sale.foundingMember ? [`Founding Member: #${String(sale.foundingMember.number).padStart(3, '0')} / 100`] : []),
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
  let sandboxSignature = false;
  try {
    const body = await rawBody(req);
    const signature = String(req.headers['stripe-signature'] || '');
    const liveValid = verifyStripeSignature(body, signature, process.env.STRIPE_WEBHOOK_SECRET || '');
    const testValid = verifyStripeSignature(body, signature, process.env.STRIPE_TEST_WEBHOOK_SECRET || '');
    if (!liveValid && !testValid) {
      return res.status(400).json({ error: 'Firma inválida.' });
    }
    sandboxSignature = !liveValid && testValid;
    event = JSON.parse(body.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Webhook inválido.' });
  }

  if (['charge.refunded', 'charge.dispute.created'].includes(event.type)) {
    const charge = event?.data?.object || {};
    if (charge.livemode !== true) return res.status(200).json({ received: true, sandbox: sandboxSignature, ignored: true });
    if (event.type === 'charge.refunded' && Number(charge.amount_refunded) < Number(charge.amount)) return res.status(200).json({ received: true, partialRefund: true });
    const paymentIntentId = String(charge.payment_intent || '');
    try {
      if (!paymentIntentId) return res.status(200).json({ received: true, ignored: true });
      await redis('SET', `aburto:revoked-payment:${paymentIntentId}`, event.type);
      const revoked = await revokeDigitalAccess(paymentIntentId);
      const sessionId = await redis('GET', `aburto:payment-session:${paymentIntentId}`);
      if (sessionId) {
        const jobKey = `aburto:fulfillment:${sessionId}`;
        const job = JSON.parse(await redis('GET', jobKey) || 'null');
        if (job?.sale) {
          job.sale.paymentStatus = event.type === 'charge.refunded' ? 'Reembolsado' : 'En disputa';
          job.sale.deliveryStatus = 'Acceso revocado';
          if (job.sale.foundingMember) {
            job.sale.foundingMember.active = false;
            await redis('HSET', foundingKeys[0], emailHash(job.sale.email), JSON.stringify(job.sale.foundingMember));
          }
          await syncSaleToCrm(job.sale);
          await redis('SET', jobKey, JSON.stringify(job));
        }
      }
      return res.status(200).json({ received: true, accessRevocation: revoked });
    } catch {
      return res.status(503).json({ error: 'No se pudo revocar el acceso digital.' });
    }
  }

  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.expired'].includes(event.type)) {
    return res.status(200).json({ received: true, ignored: true });
  }

  const session = event?.data?.object || {};
  const sandbox = sandboxSignature && session.livemode === false && session.metadata?.sandbox_test === 'true';
  const live = !sandboxSignature && session.livemode === true;
  if ((!live && !sandbox) || session.metadata?.project !== 'andres-aburto') {
    return res.status(200).json({ received: true, ignored: true });
  }
  if (event.type === 'checkout.session.expired') {
    try {
      if (!sandbox && session.metadata.reservation_id) await releaseReservation(session.metadata.reservation_id, session.id);
      return res.status(200).json({ received: true, expired: true });
    } catch { return res.status(503).json({ error: 'No se pudo liberar el lugar reservado.' }); }
  }
  if (!['paid', 'no_payment_required'].includes(String(session.payment_status || ''))) {
    return res.status(200).json({ received: true, pending: true });
  }

  const slug = String(session.metadata?.product_slug || 'venta');
  const digital = deliveryProducts(slug).length > 0;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return res.status(503).json({ error: 'El registro de acceso digital no está configurado.' });
  }
  if (!sandbox && slug === 'starter-pack' && (session.currency !== 'mxn' || Number(session.amount_total) !== (session.metadata.offer === 'founding' ? LAUNCH.foundingPrice : LAUNCH.regularPrice))) return res.status(400).json({ error: 'El importe no corresponde a la oferta.' });

  const eventKey = `aburto:${sandbox ? 'sandbox:' : ''}fulfillment-lock:${session.id}`;
  const jobKey = `aburto:${sandbox ? 'sandbox:' : ''}fulfillment:${session.id}`;
  let job;
  try {
    if (await redis('GET', `aburto:revoked-payment:${session.payment_intent}`)) return res.status(200).json({ received: true, revoked: true });
    job = JSON.parse(await redis('GET', jobKey) || '{}');
    if (job.done) return res.status(200).json({ received: true, duplicate: true });
    const lock = await redis('SET', eventKey, 'processing', 'NX', 'EX', 180);
    if (lock === null) return res.status(503).json({ error: 'La compra está siendo procesada.' });
  } catch {
    return res.status(503).json({ error: 'No se pudo asegurar la deduplicación.' });
  }

  const sale = job.sale || {
    saleId: `${sandbox ? 'TEST' : 'SALE'}-${String(session.id || event.id).replace(/^cs_/, '').slice(0, 18)}`,
    eventId: String(event.id || ''),
    checkoutSessionId: String(session.id || ''),
    paymentLinkId: String(session.payment_link || ''),
    paymentIntentId: String(session.payment_intent || ''),
    productSlug: slug,
    productName: `${sandbox ? '[SANDBOX] ' : ''}${PRODUCT_NAMES[slug] || slug}`,
    kind: digital ? 'digital' : String(session.metadata?.kind || 'service'),
    name: String(session.customer_details?.name || session.customer_details?.individual_name || ''),
    email: String(session.customer_details?.email || session.customer_email || ''),
    phone: String(session.customer_details?.phone || ''),
    amountMxn: Number(session.amount_total || 0) / 100,
    currency: String(session.currency || 'mxn').toUpperCase(),
    paymentStatus: String(session.payment_status || ''),
    createdAt: new Date(Number(session.created || Math.floor(Date.now()/1000)) * 1000).toISOString(),
    whatsappStatus: 'No requerido',
    emailStatus: 'Pendiente',
    deliveryStatus: digital ? 'Pendiente' : 'No aplica',
    buyerEmailStatus: digital ? 'Pendiente' : 'No aplica',
    offer: sandbox ? 'sandbox' : String(session.metadata?.offer || ''),
    products: deliveryProducts(slug).map(file => file.name),
    utmSource: String(session.metadata?.utm_source || ''),
    utmCampaign: String(session.metadata?.utm_campaign || ''),
    startsAt: process.env.FOUNDING_START_AT || '',
    endsAt: (process.env.FOUNDING_START_AT || LAUNCH.defaultStartAt) ? new Date(Date.parse(process.env.FOUNDING_START_AT || LAUNCH.defaultStartAt) + LAUNCH.durationHours * 3600000).toISOString() : '',
  };
  job.sale = sale;
  const save = async () => redis('SET', jobKey, JSON.stringify(job));

  try {
    if (!sandbox && slug === 'starter-pack' && !sale.foundingMember) sale.foundingMember = await confirmMember(session, event.created);
    await redis('SET', `aburto:${sandbox ? 'sandbox:' : ''}payment-session:${sale.paymentIntentId}`, session.id);
    // Record confirmed payment and membership before side effects. Later retries
    // update this row with delivery and email progress rather than adding a sale.
    if (!job.recorded) {
      const recorded = await syncSaleToCrm(sale);
      if (!recorded.synced) throw new Error('Confirmed sale could not be recorded');
      job.recorded = true;
      await save();
    }
    let delivery = job.delivery || { applicable: false, granted: false };
    let customerEmail = { sent: Boolean(job.buyerEmail) || !digital, reason: 'not_applicable' };
    if (digital) {
      delivery = await grantDigitalAccess({
        slug,
        email: sale.email,
        paymentIntentId: sale.paymentIntentId,
      });
      job.delivery = delivery;
      sale.deliveries = deliveryProducts(slug).map(file => ({ slug: file.slug, status: delivery.granted || delivery.files?.some(grant => grant.slug === file.slug && grant.permissionId) ? 'Drive concedido' : 'Pendiente' }));
      sale.deliveryStatus = delivery.granted ? 'Drive concedido' : `Pendiente: ${delivery.reason || 'no concedido'}`;
      await save();
      if (delivery.granted && !job.buyerEmail) {
        customerEmail = await sendPurchaseDeliveryEmail({ sale, delivery, eventId: event.id });
        sale.deliveryStatus = customerEmail.sent ? 'Drive + correo enviados' : `Drive concedido; correo pendiente: ${customerEmail.reason || 'no enviado'}`;
      }
      job.buyerEmail = customerEmail.sent;
      sale.buyerEmailStatus = customerEmail.sent ? 'Enviado' : 'Pendiente';
      if (customerEmail.sent) sale.deliveryStatus = 'Drive + correo enviados';
      await save();
    }

    // WhatsApp is no longer required for purchase fulfillment.
    // Purchases are reported through Sheets + email; digital access is delivered by Drive + email.
    sale.whatsappStatus = 'No requerido';
    job.whatsapp = true;
    await save();

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
      `Teléfono del cliente: ${sale.phone || 'No informado'}`,
      '',
      `Checkout Session: ${sale.checkoutSessionId}`,
      `Payment Link: ${sale.paymentLinkId || 'No disponible'}`,
      `Payment Intent: ${sale.paymentIntentId || 'No disponible'}`,
      `Entrega digital: ${sale.deliveryStatus}`,
      ...(sale.foundingMember ? [`Founding Member: #${sale.foundingMember.number} / 100`, 'Founding Access: registrado'] : []),
    ].join('\n');

    // The pack uses one Resend email per buyer. Internal reporting remains in
    // Sheets; an optional owner copy would double the daily quota.
    const ownerEmailRequired = slug !== 'starter-pack' || process.env.SEND_PACK_SALES_EMAIL === 'true';
    const email = !ownerEmailRequired || job.ownerEmail ? { sent: true } : await sendTransactionalEmail({
      subject: `Nueva venta: ${sale.productName} — $${sale.amountMxn.toLocaleString('es-MX')} MXN`,
      text: emailText,
      to: [SALES_EMAIL],
      idempotencyKey: `aburto/sale/${session.id}`,
      tags: [{ name: 'category', value: 'sale_notification' }],
    });
    sale.emailStatus = !ownerEmailRequired ? 'Registrado en Sheets' : email.sent ? 'Enviado' : `Pendiente: ${email.reason || 'no enviado'}`;
    job.ownerEmail = ownerEmailRequired && email.sent;
    await save();

    const crm = await syncSaleToCrm(sale);

    const deliveryRequired = digital;
    const deliveryComplete = !deliveryRequired || (delivery.granted && customerEmail.sent);

    if (!email.sent || !crm.synced || !deliveryComplete) {
      try { await redis('DEL', eventKey); } catch {}
      return res.status(503).json({
        error: 'Venta confirmada, pero falta completar una o más entregas.',
        email: sale.emailStatus,
        crm: crm.synced ? 'Sincronizado' : crm.reason,
        delivery: sale.deliveryStatus,
      });
    }

    job.done = true;
    await save();
    await redis('DEL', eventKey);
    return res.status(200).json({ received: true, saleId: sale.saleId, crmSynced: true });
  } catch {
    try { await save(); if (job.recorded) await syncSaleToCrm(sale); } catch {}
    try { await redis('DEL', eventKey); } catch {}
    return res.status(503).json({ error: 'No se pudo completar la notificación de venta.' });
  }
}
