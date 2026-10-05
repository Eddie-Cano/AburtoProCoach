import { googleAccessToken } from './stripe-webhook.js';
import { requireDashboard, sameOrigin } from '../lib/dashboard-auth.js';
import { readReviews, publicReview, validateReview, reviewTicket, verifyReviewTicket, sheetRequest } from '../lib/reviews.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const admin = req.query?.admin === '1';
  if (!['GET','POST','PATCH'].includes(req.method)) return res.status(405).json({error:'Método no permitido.'});
  if ((admin || req.method === 'PATCH') && !requireDashboard(req, res)) return;
  if (req.method !== 'GET' && !sameOrigin(req)) return res.status(403).json({error:'Origen no permitido.'});
  try {
    const token = await googleAccessToken();
    const reviews = await readReviews(token);
    if (req.method === 'GET') {
      if (admin) return res.status(200).json({reviews: reviews.slice(-200).reverse().map(({row,...review}) => review)});
      return res.status(200).json({reviews: reviews.filter(r => r.status === 'Publicada').map(publicReview), ticket: reviewTicket()});
    }
    if (typeof req.body === 'string' && req.body.length > 10000) return res.status(413).json({error:'El comentario es demasiado largo.'});
    let body;
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { return res.status(400).json({error:'Solicitud inválida.'}); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({error:'Solicitud inválida.'});
    if (req.method === 'PATCH') {
      if (!['Publicada','Oculta','Pendiente'].includes(body.status)) return res.status(400).json({error:'Estado inválido.'});
      const review = reviews.find(r => r.id === body.id);
      if (!review) return res.status(404).json({error:'Reseña no encontrada.'});
      await sheetRequest(token, `/values/${encodeURIComponent(`'Reseñas'!H${review.row}`)}?valueInputOption=RAW`, 'PUT', {values:[[body.status]]});
      return res.status(200).json({ok:true});
    }
    if (body.website || !verifyReviewTicket(body.ticket)) return res.status(400).json({error:'Actualiza la página e intenta de nuevo.'});
    let input;
    try { input = validateReview(body); } catch(error) { return res.status(400).json({error:error.message}); }
    const id = body.ticket.split('.')[1];
    if (reviews.some(r => r.id === id)) return res.status(200).json({ok:true, status:'Pendiente'});
    if (reviews.some(r => r.name.toLowerCase() === input.name.toLowerCase() && r.target === input.target &&
      (r.comment === input.comment || Date.now() - Date.parse(r.createdAt) < 900000))) {
      return res.status(429).json({error:'Ya recibimos tu reseña para esta opción. Espera unos minutos antes de enviar otra.'});
    }
    await sheetRequest(token, `/values/${encodeURIComponent("'Reseñas'!A:I")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, 'POST', {
      values:[[id, new Date().toISOString(), input.target === 'services' ? 'Servicios' : 'Producto digital', input.target, input.name, input.rating, input.comment, 'Pendiente', 'Sitio de Andrés']],
    });
    return res.status(201).json({ok:true, status:'Pendiente'});
  } catch(error) {
    console.error('reviews unavailable', error.message);
    return res.status(503).json({error:'No pudimos conectar con las reseñas. Intenta de nuevo en unos minutos.'});
  }
}
