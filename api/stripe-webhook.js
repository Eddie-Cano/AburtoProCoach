import { createHmac, timingSafeEqual } from 'node:crypto';
import { getVercelOidcToken } from '@vercel/oidc';
import { ExternalAccountClient } from 'google-auth-library';
import { queueAndSendWhatsApp } from './_leadcore.js';
import { sendPurchaseDeliveryEmail, sendTransactionalEmail } from './_email.js';
import { PACK_PRODUCTS, LAUNCH } from '../lib/launch-config.js';
import { findSaleBySession, findSaleByPaymentIntent, fullyDelivered } from '../lib/purchase-ledger.js';
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

// Permissions are checked before being granted; repeated Stripe events reuse the existing permission.
export async function grantDigitalAccess({ slug, email, paymentIntentId }) {
  const products = deliveryProducts(slug);
  if (!products.length) return { applicable: false, granted: false };
  if (!email || !paymentIntentId) return { applicable: true, granted: false, reason: 'missing_customer_or_payment' };
  const grantedFiles = [];
  for (const product of products) {
    const grant = await grantFileAccess({ product, email });
    if (!grant.granted) return { applicable: true, granted: false, reason: grant.reason, files: grantedFiles };
    grantedFiles.push({ ...grant, slug: product.slug, name: product.name, email });
  }
  return { applicable: true, granted: true, fileUrl: products[0].url,
    files: products.map(product => ({ name: product.name, fileUrl: product.url, slug: product.slug })) };
}

async function grantFileAccess({ product, email }) {
  let existing, pageToken;
  do {
    const listed = await driveApi(`/files/${product.fileId}/permissions?supportsAllDrives=true&fields=nextPageToken,permissions(id,emailAddress,role,type)&pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`);
    existing = listed.data?.permissions?.find(permission => String(permission.emailAddress || '').toLowerCase() === email.toLowerCase());
    pageToken = listed.data?.nextPageToken;
  } while (!existing && pageToken);
  const result = existing ? { data: existing } : await driveApi(
    `/files/${product.fileId}/permissions?supportsAllDrives=true&sendNotificationEmail=false&fields=id,emailAddress,role,type`,
    { method: 'POST', body: { type: 'user', role: 'reader', emailAddress: email } }
  );
  const permissionId = result.data?.id || '';
  if (!permissionId) throw new Error('Drive permission was not granted');
  return { applicable: true, granted: true, fileId: product.fileId, fileUrl: product.url, permissionId };
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
    if (charge.livemode !== true || sandboxSignature) return res.status(200).json({ received: true, ignored: true });
    if (event.type === 'charge.refunded' && Number(charge.amount_refunded) < Number(charge.amount)) return res.status(200).json({ received: true, partialRefund: true });
    try {
      const paymentIntentId = String(charge.payment_intent || '');
      if (!paymentIntentId) return res.status(200).json({ received: true, ignored: true });
      const token = await googleAccessToken();
      const row = await findSaleByPaymentIntent(paymentIntentId, token);
      if (!row) return res.status(503).json({ error: 'Venta pendiente de conciliación antes de registrar el reembolso.' });
      const kind = event.type === 'charge.refunded' ? 'Reembolsado' : 'En disputa';
      const updates = [
        { range: `'Ventas'!N${row.rowNumber}`, values: [[kind]] },
        { range: `'Ventas'!AB${row.rowNumber}`, values: [['Revisión manual de acceso a Drive']] },
        { range: `'Ventas'!AH${row.rowNumber}`, values: [[`${kind} — verificar permisos de otros pagos antes de revocar`]] },
      ];
      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CRM_SHEET_ID}/values:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ valueInputOption: 'RAW', data: updates }),
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error('Failed to record refund status');
      // A customer may own multiple purchases for the same PDF. Flag revocation for review.
      await sendTransactionalEmail({
        to: [SALES_EMAIL],
        subject: `Revisar acceso a Drive: ${kind} — Aburto Pro Coach`,
        text: [`Evento: ${event.type}`, `Stripe Payment Intent: ${paymentIntentId}`,
          `Comprador: ${row.email}`, `Producto: ${row.productSlug}`,
          'Revisar compras vigentes antes de quitar permisos en Drive.',
          `Google Sheet: https://docs.google.com/spreadsheets/d/${CRM_SHEET_ID}/edit`].join('\n'),
        idempotencyKey: `aburto/refund/${paymentIntentId}/${event.type}`,
        tags: [{ name: 'category', value: 'refund_review' }],
      });
      return res.status(200).json({ received: true, manualReview: true });
    } catch (error) {
      console.error('Refund review registration failed:', error?.message);
      return res.status(503).json({ error: 'No se pudo registrar el reembolso en Sheets.' });
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
  if (event.type === 'checkout.session.expired') return res.status(200).json({ received: true, expired: true });
  if (!['paid', 'no_payment_required'].includes(String(session.payment_status || ''))) {
    return res.status(200).json({ received: true, pending: true });
  }

  const slug = String(session.metadata?.product_slug || 'venta');
  const digital = deliveryProducts(slug).length > 0;
  if (!sandbox && slug === 'starter-pack' && (session.currency !== 'mxn' || Number(session.amount_total) !== (session.metadata.offer === 'founding' ? LAUNCH.foundingPrice : LAUNCH.regularPrice))) return res.status(400).json({ error: 'El importe no corresponde a la oferta.' });

  const ownerEmailRequired = slug !== 'starter-pack' || process.env.SEND_PACK_SALES_EMAIL === 'true';
  let previous;
  try {
    const token = await googleAccessToken();
    if (!token) throw new Error('Google authentication is missing');
    previous = await findSaleBySession(String(session.id || ''), token);
    if (previous && ['Reembolsado', 'En disputa'].includes(previous.paymentStatus)) {
      return res.status(200).json({ received: true, revoked: true });
    }
    if (fullyDelivered(previous, digital, ownerEmailRequired)) {
      return res.status(200).json({ received: true, duplicate: true });
    }
  } catch (error) {
    console.error('Could not check paid Stripe session in Sheets:', error?.message);
    return res.status(503).json({ error: 'No se pudo verificar el estado de la compra.' });
  }

  const sale = {
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
    createdAt: new Date(Number(session.created || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    whatsappStatus: 'No requerido',
    emailStatus: previous?.values?.[16] || 'Pendiente',
    deliveryStatus: previous?.deliveryStatus || (digital ? 'Pendiente' : 'No aplica'),
    buyerEmailStatus: previous?.buyerEmailStatus || (digital ? 'Pendiente' : 'No aplica'),
    offer: sandbox ? 'sandbox' : String(session.metadata?.offer || ''),
    products: deliveryProducts(slug).map(file => file.name),
    utmSource: String(session.metadata?.utm_source || ''),
    utmCampaign: String(session.metadata?.utm_campaign || ''),
    startsAt: '',
    endsAt: '',
  };

  try {
    // The Stripe signature has been verified. Sheets rows are keyed by Checkout Session ID.
    const recorded = await syncSaleToCrm(sale);
    if (!recorded.synced) throw new Error('Sale was not recorded in Sheets');
    let delivery = { applicable: false, granted: false };
    let customerEmail = { sent: !digital || previous?.buyerEmailStatus === 'Enviado' };
    if (digital) {
      delivery = await grantDigitalAccess({ slug, email: sale.email, paymentIntentId: sale.paymentIntentId });
      sale.deliveries = deliveryProducts(slug).map(file => ({
        slug: file.slug,
        status: delivery.granted || delivery.files?.some(grant => grant.slug === file.slug && grant.permissionId)
          ? 'Drive concedido' : 'Pendiente',
      }));
      sale.deliveryStatus = delivery.granted ? 'Drive concedido' : `Pendiente: ${delivery.reason || 'no concedido'}`;
      if (!delivery.granted) throw new Error('Drive permission pending');
      if (!customerEmail.sent) customerEmail = await sendPurchaseDeliveryEmail({ sale, delivery, eventId: event.id });
      sale.buyerEmailStatus = customerEmail.sent ? 'Enviado' : 'Pendiente';
      sale.deliveryStatus = customerEmail.sent ? 'Drive + correo enviados' : 'Drive concedido; correo pendiente';
      const updated = await syncSaleToCrm(sale);
      if (!updated.synced) throw new Error('Delivery result not saved in Sheets');
      if (!customerEmail.sent) throw new Error('Buyer delivery email pending');
    }

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
      `Teléfono: ${sale.phone || 'No informado'}`,
      '',
      `Checkout Session: ${sale.checkoutSessionId}`,
      `Payment Intent: ${sale.paymentIntentId}`,
      `Entrega digital: ${sale.deliveryStatus}`,
      ...(sale.offer === 'founding' ? ['Founding 100: pendiente asignación manual de número en Google Sheets'] : []),
    ].join('\n');
    const ownerEmail = !ownerEmailRequired || previous?.values?.[16] === 'Enviado'
      ? { sent: true }
      : await sendTransactionalEmail({
          subject: `Nueva venta: ${sale.productName} — $${sale.amountMxn.toLocaleString('es-MX')} MXN`,
          text: emailText,
          to: [SALES_EMAIL],
          idempotencyKey: `aburto/sale/${session.id}`,
          tags: [{ name: 'category', value: 'sale_notification' }],
        });
    sale.emailStatus = !ownerEmailRequired ? 'Registrado en Sheets' : ownerEmail.sent ? 'Enviado' : 'Pendiente';
    if (!ownerEmail.sent) throw new Error('Owner notification pending');
    const finalSave = await syncSaleToCrm(sale);
    if (!finalSave.synced) throw new Error('Final sale state was not saved in Sheets');
    return res.status(200).json({ received: true, saleId: sale.saleId, crmSynced: true });
  } catch (error) {
    console.error('Stripe purchase processing needs retry:', error?.message);
    try { await syncSaleToCrm(sale); } catch {}
    // Return non-2xx so Stripe retries. Resend uses per-session idempotency keys.
    return res.status(503).json({ error: 'Pago confirmado; entrega pendiente. Se reintentará automáticamente.' });
  }
}
