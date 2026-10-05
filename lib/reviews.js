import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { CRM_SHEET_ID } from './crm.js';

export const REVIEW_TARGETS = {
  services: 'Servicios de Andrés Aburto',
  '5-habitos': 'El Día 29',
  'romantizar-la-prep': 'Romantizar la Prep',
  '5-claves': '5 Claves Antes de Competir',
  'starter-pack': 'Starter Pack',
};
export const REVIEW_HEADERS = ['ID','Fecha','Categoría','Producto / servicio','Nombre','Calificación','Comentario','Estado','Origen'];
const clean = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
export function validateReview(body) {
  const name = clean(body.name), comment = clean(body.comment);
  if (!Object.hasOwn(REVIEW_TARGETS, body.target) || name.length < 2 || name.length > 100 ||
      comment.length < 10 || comment.length > 2000 || !Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5 || body.consent !== true) {
    throw new Error('Revisa tu nombre, calificación y comentario, y autoriza su publicación.');
  }
  return { name, comment, target: body.target, rating: body.rating };
}
const sign = value => createHmac('sha256', process.env.DASHBOARD_SESSION_SECRET).update(value).digest('hex');
export function reviewTicket(now = Date.now()) {
  const value = `${now}.${randomUUID()}`;
  return `${value}.${sign(value)}`;
}
export function verifyReviewTicket(ticket, now = Date.now()) {
  if (typeof ticket !== 'string' || !/^\d{13}\.[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(ticket)) return false;
  const [timestamp, id, signature] = ticket.split('.');
  const age = now - Number(timestamp);
  return age >= 1500 && age < 3600000 && timingSafeEqual(Buffer.from(signature), Buffer.from(sign(`${timestamp}.${id}`)));
}
export async function sheetRequest(token, path, method = 'GET', body) {
  if (!token) throw new Error('Review store not configured');
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CRM_SHEET_ID}${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? {body: JSON.stringify(body)} : {}), signal: AbortSignal.timeout(12000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('Review store unavailable');
  return data;
}
export async function readReviews(token) {
  const data = await sheetRequest(token, `/values/${encodeURIComponent("'Reseñas'!A2:I10000")}`);
  return (data.values || []).map((row, index) => ({
    id: row[0], createdAt: row[1], category: row[2], target: row[3], name: row[4], rating: Number(row[5]),
    comment: row[6], status: row[7], source: row[8], row: index + 2,
  })).filter(review => review.id && review.name && review.comment && Object.hasOwn(REVIEW_TARGETS, review.target) && review.rating >= 1 && review.rating <= 5);
}
export function publicReview(review) {
  return {id: review.id, createdAt: review.createdAt, target: review.target, name: review.name, rating: review.rating, comment: review.comment, source: 'Sitio de Andrés'};
}
