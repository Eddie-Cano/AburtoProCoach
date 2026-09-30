export const CRM_SHEET_ID = '1yE6PJDnBkKTVX1vNLb0dHByWn7FyqkvIn2Er3IMO1FU';

export function saleValues(sale) {
  const status = slug => sale.deliveries?.find(file => file.slug === slug)?.status || 'No aplica';
  return [sale.saleId, sale.createdAt, sale.eventId, sale.checkoutSessionId, sale.paymentLinkId, sale.kind,
    sale.productName, sale.productSlug, sale.name, sale.email, sale.phone, sale.amountMxn, sale.currency,
    sale.paymentStatus, sale.paymentIntentId, sale.whatsappStatus, sale.emailStatus,
    sale.paymentLinkId ? 'Stripe Payment Link' : 'Stripe Checkout',
    sale.offer || '', sale.foundingMember?.active ? 'Sí' : 'No', sale.foundingMember?.number || '',
    sale.foundingMember?.active ? 'Registrado' : 'No aplica', sale.products?.join(' + ') || sale.productName,
    status('5-habitos-dia-29'), status('romantizar-la-prep'), status('5-claves'),
    sale.buyerEmailStatus || 'No aplica', sale.deliveryStatus || 'No aplica', sale.startsAt || '', sale.endsAt || '',
    sale.utmSource || '', sale.utmCampaign || '', new Date().toISOString(),
    sale.foundingMember ? (sale.foundingMember.active ? 'Activo' : 'Revocado') : 'No aplica'];
}

export function memberValues(sale) {
  const status = slug => sale.deliveries?.find(file => file.slug === slug)?.status || 'Pendiente';
  return [sale.foundingMember.number, sale.createdAt, sale.checkoutSessionId, sale.paymentIntentId, sale.name,
    sale.email, sale.amountMxn, sale.foundingMember.active ? 'Activo' : 'Revocado',
    sale.foundingMember.active ? 'Registrado' : 'Revocado', status('5-habitos-dia-29'), status('romantizar-la-prep'),
    status('5-claves'), sale.buyerEmailStatus || 'Pendiente', sale.startsAt || '', sale.endsAt || '',
    sale.posingNoticeStatus || 'Pendiente de lanzamiento', new Date().toISOString(), sale.utmCampaign || ''];
}

// Checkout IDs are the stable primary key. A retry updates the existing row.
export async function syncSaleToSheet(sale, token) {
  if (!token) return { synced: false, reason: 'google_sheets_not_configured' };
  async function api(path, method = 'GET', body) {
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CRM_SHEET_ID}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(12000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error('Google Sheets sync unavailable');
    return data;
  }
  async function upsert(tab, idColumn, finalColumn, values) {
    const range = `'${tab}'!${idColumn}2:${idColumn}10000`;
    const existing = await api(`/values/${encodeURIComponent(range)}`);
    const index = (existing.values || []).findIndex(row => row[0] === sale.checkoutSessionId);
    if (index >= 0) {
      await api(`/values/${encodeURIComponent(`'${tab}'!A${index + 2}:${finalColumn}${index + 2}`)}?valueInputOption=RAW`, 'PUT', { values: [values] });
    } else {
      await api(`/values/${encodeURIComponent(`'${tab}'!A:${finalColumn}`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, 'POST', { values: [values] });
    }
  }
  await upsert('Ventas', 'D', 'AH', saleValues(sale));
  if (sale.foundingMember) await upsert('Founding Members', 'C', 'R', memberValues(sale));
  return { synced: true };
}
