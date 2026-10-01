export const CRM_SHEET_ID = '1yE6PJDnBkKTVX1vNLb0dHByWn7FyqkvIn2Er3IMO1FU';

export function saleValues(sale) {
  const status = slug => sale.deliveries?.find(file => file.slug === slug)?.status || 'No aplica';
  return [sale.saleId, sale.createdAt, sale.eventId, sale.checkoutSessionId, sale.paymentLinkId, sale.kind,
    sale.productName, sale.productSlug, sale.name, sale.email, sale.phone, sale.amountMxn, sale.currency,
    sale.paymentStatus, sale.paymentIntentId, sale.whatsappStatus, sale.emailStatus,
    sale.paymentLinkId ? 'Stripe Payment Link' : 'Stripe Checkout',
    sale.offer || '', sale.foundingMember?.active ? 'Sí' : sale.offer === 'founding' ? 'Pendiente de asignación' : 'No', sale.foundingMember?.number || '',
    sale.foundingMember?.active ? 'Registrado' : sale.offer === 'founding' ? 'Pendiente de asignación' : 'No aplica', sale.products?.join(' + ') || sale.productName,
    status('5-habitos-dia-29'), status('romantizar-la-prep'), status('5-claves'),
    sale.buyerEmailStatus || 'No aplica', sale.deliveryStatus || 'No aplica', sale.startsAt || '', sale.endsAt || '',
    sale.utmSource || '', sale.utmCampaign || '', new Date().toISOString(),
    sale.foundingMember ? (sale.foundingMember.active ? 'Activo' : 'Revocado') : sale.offer === 'founding' ? 'Pendiente de asignación manual' : 'No aplica'];
}

export function memberValues(sale) {
  const status = slug => sale.deliveries?.find(file => file.slug === slug)?.status || 'Pendiente';
  const assigned = Number.isInteger(Number(sale.foundingMember?.number)) && Number(sale.foundingMember?.number) > 0;
  const currentStatus = assigned ? (sale.foundingMember?.active ? 'Activo' : 'Revocado') : 'Pendiente de asignación';
  return [assigned ? sale.foundingMember.number : '', sale.createdAt, sale.checkoutSessionId, sale.paymentIntentId, sale.name,
    sale.email, sale.amountMxn, currentStatus,
    assigned ? 'Registrado' : 'Pendiente de asignación manual', status('5-habitos-dia-29'), status('romantizar-la-prep'),
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
      let output = values;
      if (tab === 'Founding Members') {
        const before = await api(`/values/${encodeURIComponent(`'${tab}'!A${index + 2}:${finalColumn}${index + 2}`)}`);
        const previous = before.values?.[0] || [];
        // A = manually assigned member number; H/I = owner-managed membership statuses.
        output = [...values];
        if (previous[0]) output[0] = previous[0];
        if (previous[7] && previous[7] !== 'Pendiente de asignación') output[7] = previous[7];
        if (previous[8] && previous[8] !== 'Pendiente de asignación manual') output[8] = previous[8];
      }
      await api(`/values/${encodeURIComponent(`'${tab}'!A${index + 2}:${finalColumn}${index + 2}`)}?valueInputOption=RAW`, 'PUT', { values: [output] });
    } else {
      await api(`/values/${encodeURIComponent(`'${tab}'!A:${finalColumn}`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, 'POST', { values: [values] });
    }
  }
  await upsert('Ventas', 'D', 'AH', saleValues(sale));
  if (sale.foundingMember || sale.offer === 'founding') await upsert('Founding Members', 'C', 'R', memberValues(sale));
  return { synced: true };
}
