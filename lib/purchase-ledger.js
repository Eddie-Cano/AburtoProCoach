import { CRM_SHEET_ID } from './crm.js';

const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${CRM_SHEET_ID}/values/`;
const range = "'Ventas'!A2:AH10000";
const clean = value => String(value ?? '').trim();

async function sheetsGet(rangeName, token) {
  if (!token) throw new Error('Missing Google authorization');
  const response = await fetch(BASE + encodeURIComponent(rangeName), {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Google Sheets read failed: ${response.status}`);
  return (await response.json()).values || [];
}

export async function listSaleRows(token) {
  const rows = await sheetsGet(range, token);
  return rows.map((cells, offset) => ({
    rowNumber: offset + 2,
    checkoutSessionId: clean(cells[3]),
    paymentIntentId: clean(cells[14]),
    email: clean(cells[9]).toLowerCase(),
    productSlug: clean(cells[7]),
    paymentStatus: clean(cells[13]),
    buyerEmailStatus: clean(cells[26]),
    deliveryStatus: clean(cells[27]),
    offer: clean(cells[18]),
    values: cells,
  })).filter(row => row.checkoutSessionId);
}

export async function findSaleBySession(sessionId, token) {
  return (await listSaleRows(token)).find(row => row.checkoutSessionId === sessionId) || null;
}

export async function findSaleByPaymentIntent(paymentIntentId, token) {
  return (await listSaleRows(token)).find(row => row.paymentIntentId === paymentIntentId) || null;
}

export function fullyDelivered(row, digital, requiresOwnerEmail) {
  if (!row) return false;
  const buyerDelivered = !digital || (row.buyerEmailStatus === 'Enviado' && ['Drive + correo enviados','Biblioteca + correo enviados'].includes(row.deliveryStatus));
  const ownerDelivered = !requiresOwnerEmail || row.values[16] === 'Enviado';
  return buyerDelivered && ownerDelivered;
}
