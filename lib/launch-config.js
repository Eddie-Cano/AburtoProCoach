export const LAUNCH = Object.freeze({
  id: 'founding-100-v1',
  maxMembers: 100,
  durationHours: 120,
  individualTotal: 137200,
  foundingPrice: 96040,
  regularPrice: 105000,
  currency: 'mxn',
  defaultStartAt: '2026-10-01T06:00:00.000Z',
  foundingStripePrice: 'price_1ULHh51f6JXFxDAPX5atXQGN',
  regularStripePrice: 'price_1ULHh51f6JXFxDAPbNWWAb6h',
});

export const PACK_PRODUCTS = Object.freeze([
  { slug: '5-habitos-dia-29', name: 'El Día 29', fileId: '1kCBeH1GCDlCKwisuImkvFZ6XPAP3YU9R' },
  { slug: 'romantizar-la-prep', name: 'Romantizar la Prep', fileId: '1Se6_demNzrfofYmlg5zlWkm7CGZsin-H' },
  { slug: '5-claves', name: '5 Claves Antes de Competir', fileId: '1nLlZJqc6Z0PWgF3Ba2ZVRNJnB-jhDmZX' },
].map(product => Object.freeze({ ...product, url: `https://drive.google.com/file/d/${product.fileId}/view` })));

export function offerState({ startAt, now = Date.now(), confirmed = 0, reserved = 0, configured = true }) {
  const start = Date.parse(startAt || '');
  const end = start + LAUNCH.durationHours * 60 * 60 * 1000;
  const stage = !Number.isFinite(start) || now < start ? 'scheduled'
    : now >= end || confirmed >= LAUNCH.maxMembers ? 'regular'
    : confirmed + reserved >= LAUNCH.maxMembers ? 'reserved' : 'founding';
  return {
    stage,
    checkoutReady: configured && stage !== 'scheduled' && stage !== 'reserved',
    startsAt: Number.isFinite(start) ? new Date(start).toISOString() : null,
    endsAt: Number.isFinite(end) ? new Date(end).toISOString() : null,
    serverNow: new Date(now).toISOString(),
    maxMembers: LAUNCH.maxMembers,
    confirmed,
    reserved,
    remaining: Math.max(0, LAUNCH.maxMembers - confirmed - reserved),
    price: stage === 'regular' ? LAUNCH.regularPrice : LAUNCH.foundingPrice,
    regularPrice: LAUNCH.regularPrice,
    individualTotal: LAUNCH.individualTotal,
    discountPercent: stage === 'regular' ? 23 : 30,
    foundingAccess: stage === 'founding',
  };
}
