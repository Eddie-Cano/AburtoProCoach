import { LAUNCH, offerState } from './launch-config.js';
import { CRM_SHEET_ID } from './crm.js';

const RANGE = "'Configuración lanzamiento'!A1:C25";
const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${CRM_SHEET_ID}/values/${encodeURIComponent(RANGE)}`;

export async function getManualOffer(token) {
  if (!token) throw new Error('Google authorization is not configured for launch management');
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Launch sheet is not accessible');
  const data = await response.json();
  const rows = new Map((data.values || []).map(r => [String(r[0] || '').trim().toLowerCase(), r[1]]));
  const manualStatus = String(rows.get('estado lanzamiento') || '').trim().toLowerCase();
  const configured = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.RESEND_API_KEY);
  const confirmed = Math.max(0, Math.min(100, Number.parseInt(String(rows.get('plazas asignadas') || '0'), 10) || 0));
  const stage = manualStatus === 'abierto' ? 'founding'
    : manualStatus === 'cerrado' ? 'regular'
    : 'scheduled';
  // Google Sheets status is the merchant's explicit switch. No clock or automatic reservation controls the offer.
  const offer = {
    ...offerState({ startAt: LAUNCH.defaultStartAt, confirmed, reserved: 0, configured }),
    stage,
    checkoutReady: configured && stage !== 'scheduled',
    foundingAccess: stage === 'founding',
    price: stage === 'regular' ? LAUNCH.regularPrice : LAUNCH.foundingPrice,
    discountPercent: stage === 'regular' ? 23 : 30,
    remaining: Math.max(0, LAUNCH.maxMembers - confirmed),
    startsAt: null,
    endsAt: null,
    manualControl: true,
    manualStatus: manualStatus || 'en preparación',
    // Avoid implying exact live availability: the owner maintains these counts manually.
    countSource: 'google_sheets_manual',
  };
  return { ...offer, configured };
}
