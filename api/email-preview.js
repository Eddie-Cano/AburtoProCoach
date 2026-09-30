import { buildPurchaseDeliveryEmail } from './_email.js';

const PRODUCTS = {
  '5-claves': '5 Claves Antes de Competir',
  'dia-29': 'El Día 29',
  'romantizar': 'Romantizar la Prep',
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
    telegramWaitlistUrl: 'https://www.aburtoprocoach.com/comunidad-telegram.html',
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(preview.html);
}

