import { grantDigitalAccess, syncSaleToCrm, saleMessage } from './stripe-webhook.js';
import { sendPurchaseDeliveryEmail } from './_email.js';
import { queueAndSendWhatsApp } from './_leadcore.js';

const TEST_EMAIL = 'raiznoblemx@gmail.com';
const TEST_PHONE = '522282780491';
const TEST_ID = 'SELFTEST-ABURTO-20260930-V1';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido.' });
  if (String(req.query?.key || '') !== 'aburto-selftest-9x7k4m2q') return res.status(403).json({ error: 'No autorizado.' });

  const sale = {
    saleId: TEST_ID,
    eventId: TEST_ID,
    checkoutSessionId: TEST_ID,
    paymentLinkId: '',
    paymentIntentId: TEST_ID,
    productSlug: '5-claves',
    productName: '[PRUEBA] 5 Claves Antes de Competir',
    kind: 'digital',
    name: 'Raiz Noble Test',
    email: TEST_EMAIL,
    phone: TEST_PHONE,
    amountMxn: 0,
    currency: 'MXN',
    paymentStatus: 'TEST',
    createdAt: new Date().toISOString(),
    whatsappStatus: 'Pendiente',
    emailStatus: 'Pendiente',
    deliveryStatus: 'Pendiente',
    buyerEmailStatus: 'Pendiente',
    offer: 'self-test',
    products: ['5 Claves Antes de Competir'],
    utmSource: 'self-test',
    utmCampaign: 'self-test',
    startsAt: '',
    endsAt: '',
  };

  const results = {};
  try {
    const crm = await syncSaleToCrm(sale);
    results.crm = crm;
  } catch (e) { results.crm = { synced:false, error:String(e?.message || e) }; }

  let delivery = { applicable:true, granted:false };
  try {
    delivery = await grantDigitalAccess({ slug:'5-claves', email:TEST_EMAIL, paymentIntentId:TEST_ID });
    results.drive = delivery;
  } catch (e) { results.drive = { granted:false, error:String(e?.message || e) }; }

  try {
    const email = await sendPurchaseDeliveryEmail({ sale, delivery, eventId: TEST_ID });
    results.email = email;
  } catch (e) { results.email = { sent:false, error:String(e?.message || e) }; }

  try {
    const whatsapp = await queueAndSendWhatsApp({ recipient: TEST_PHONE, text: '[PRUEBA AUTOMÁTICA]\n' + saleMessage(sale) });
    results.whatsapp = whatsapp;
  } catch (e) { results.whatsapp = { sent:false, error:String(e?.message || e) }; }

  const ok = Boolean(results.crm?.synced && results.drive?.granted && results.email?.sent && results.whatsapp?.sent);
  return res.status(ok ? 200 : 207).json({ ok, testId: TEST_ID, email: TEST_EMAIL, results });
}
