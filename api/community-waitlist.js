import { randomUUID } from 'node:crypto';
import { googleAccessToken } from './stripe-webhook.js';
import { CRM_SHEET_ID } from '../lib/crm.js';

const TAB = 'Lista de espera — Telegram';
const clean = (v, n = 200) => String(v ?? '').trim().slice(0, n);
const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sheetPath = suffix => `https://sheets.googleapis.com/v4/spreadsheets/${CRM_SHEET_ID}/values/${encodeURIComponent(TAB + '!' + suffix)}`;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  const origin = clean(req.headers.origin);
  if (origin && !['https://www.aburtoprocoach.com','https://aburtoprocoach.com',
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : [])].includes(origin)) {
    return res.status(403).json({ error: 'Origen no permitido.' });
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const name = clean(body.name, 100);
    const email = clean(body.email, 254).toLowerCase();
    const phone = clean(body.phone, 35);
    if (name.length < 2 || !emailOk.test(email) || phone.replace(/\D/g,'').length < 10 ||
        phone.replace(/\D/g,'').length > 15 || body.consent !== true) {
      return res.status(400).json({ error: 'Completa tu nombre, correo, teléfono válido y consentimiento.' });
    }
    const token = await googleAccessToken();
    if (!token) return res.status(503).json({ error: 'El registro no está disponible en este momento.' });
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const existing = await fetch(sheetPath('D2:D10000'), { headers, signal: AbortSignal.timeout(10000) });
    if (!existing.ok) throw new Error('sheet lookup failed');
    const rows = (await existing.json()).values || [];
    if (rows.some(row => String(row[0] || '').trim().toLowerCase() === email)) {
      return res.status(200).json({ ok: true, alreadyRegistered: true });
    }
    const now = new Date().toISOString();
    const source = clean(body.source, 60) || 'Correo post-compra';
    const row = [
      `TG-${randomUUID()}`,now,name,email,phone,
      clean(body.product, 120) || 'Productos digitales Aburto', '',
      source, 'En lista de espera', '', 'Sí', 'Alta voluntaria desde aburtoprocoach.com'
    ];
    const url = sheetPath('A:L') + '?valueInputOption=RAW&insertDataOption=INSERT_ROWS';
    const result = await fetch(url, {
      method: 'POST', headers, body: JSON.stringify({ values: [row] }),
      signal: AbortSignal.timeout(12000)
    });
    if (!result.ok) throw new Error('sheet insert failed');
    return res.status(200).json({ ok: true, alreadyRegistered: false });
  } catch (error) {
    console.error('community waitlist registration failed:', error?.message);
    return res.status(503).json({ error: 'No pudimos registrar tu solicitud. Intenta de nuevo en unos minutos.' });
  }
}
