import { buildPurchaseDeliveryEmail } from './_email.js';
import { PACK_PRODUCTS } from '../lib/launch-config.js';

const PRODUCTS = {
  '5-claves': '5 Claves Antes de Competir',
  'dia-29': 'El Día 29',
  'romantizar': 'Romantizar la Prep',
  'starter-pack': 'Starter Pack',
  'founding-100': 'Starter Pack · Founding 100',
};

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido.' });

  const key = String(req.query?.producto || 'dia-29');
  const productName = PRODUCTS[key] || PRODUCTS['dia-29'];
  const preview = buildPurchaseDeliveryEmail({
    name: 'Cliente',
    productName,
    fileUrl: 'https://drive.google.com/',
    ...(key === 'starter-pack' || key === 'founding-100' ? {
      files: PACK_PRODUCTS.map(file => ({ name: file.name, fileUrl: 'https://drive.google.com/' })),
      ...(key === 'founding-100' ? { foundingMember: { active: true, number: 1 } } : {}),
    } : {}),
    telegramWaitlistUrl: process.env.TELEGRAM_WAITLIST_URL || 'https://www.aburtoprocoach.com/comunidad-espera.html',
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(preview.html);
}
