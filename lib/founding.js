import { createHash, randomUUID } from 'node:crypto';
import { LAUNCH, offerState } from './launch-config.js';
import { redis, redisConfigured } from './redis.js';

const prefix = `aburto:${LAUNCH.id}`;
export const foundingKeys = [ `${prefix}:members`, `${prefix}:reservations`, `${prefix}:emails`, `${prefix}:sequence` ];
export const emailHash = email => createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex');

// One atomic operation gates capacity and prevents simultaneous duplicate buyers.
// Reservations are only released after a signed Stripe expiration or a definitive
// creation failure. A slow payment webhook cannot free an already-paid place.
export const RESERVE_SCRIPT = `
if redis.call('HEXISTS',KEYS[1],ARGV[1]) == 1 then return {'member'} end
local pending = redis.call('HGET',KEYS[3],ARGV[1])
if pending then return {'pending',pending} end
local used = redis.call('HLEN',KEYS[1])+redis.call('HLEN',KEYS[2])
if used >= tonumber(ARGV[3]) then return {'full'} end
redis.call('HSET',KEYS[2],ARGV[2],ARGV[4])
redis.call('HSET',KEYS[3],ARGV[1],ARGV[2])
return {'reserved',ARGV[2]}
`;

export const RELEASE_SCRIPT = `
local raw = redis.call('HGET',KEYS[2],ARGV[1])
if not raw then return 0 end
local r = cjson.decode(raw)
if r.sessionId and r.sessionId ~= ARGV[2] then return 0 end
redis.call('HDEL',KEYS[2],ARGV[1])
redis.call('HDEL',KEYS[3],r.emailHash)
return 1
`;

export const CONFIRM_SCRIPT = `
local existing = redis.call('HGET',KEYS[1],ARGV[2])
if existing then return existing end
local raw = redis.call('HGET',KEYS[2],ARGV[1])
if not raw then return '' end
local r = cjson.decode(raw)
if r.sessionId ~= ARGV[3] or r.emailHash ~= ARGV[2] or tonumber(r.amount) ~= tonumber(ARGV[4]) then return '' end
if tonumber(r.expiresAt) < tonumber(ARGV[5]) then return '' end
if redis.call('HLEN',KEYS[1]) >= tonumber(ARGV[6]) then return '' end
local n = redis.call('INCR',KEYS[4])
local member = cjson.decode(ARGV[7]); member.number = n
local result = cjson.encode(member)
redis.call('HSET',KEYS[1],ARGV[2],result)
redis.call('HDEL',KEYS[2],ARGV[1])
redis.call('HDEL',KEYS[3],r.emailHash)
return result
`;

export async function getOffer() {
  const configured = redisConfigured();
  let confirmed = 0, reserved = 0;
  if (configured) {
    [confirmed, reserved] = await Promise.all([redis('HLEN', foundingKeys[0]), redis('HLEN', foundingKeys[1])]);
  }
  const googleEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  const checkoutConfigured = configured && Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.RESEND_API_KEY &&
    /^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/.test(googleEmail) && process.env.GCP_PROJECT_NUMBER && process.env.GCP_WORKLOAD_IDENTITY_POOL_ID && process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID);
  return { ...offerState({ startAt: process.env.FOUNDING_START_AT || LAUNCH.defaultStartAt, confirmed: Number(confirmed), reserved: Number(reserved), configured: checkoutConfigured }), configured: checkoutConfigured };
}

export async function reserveMember(email, offer) {
  const id = randomUUID(), now = Math.floor(Date.now() / 1000);
  const end = Math.floor(Date.parse(offer.endsAt) / 1000);
  if (end <= now) return { state: 'closed' };
  // Opening a checkout during the 72-hour window preserves its quoted price
  // until that checkout expires. Stripe requires a minimum 30-minute session.
  const reservation = { id, emailHash: emailHash(email), amount: LAUNCH.foundingPrice, createdAt: now, expiresAt: Math.max(now + 1860, Math.min(now + 3600, end)) };
  const result = await redis('EVAL', RESERVE_SCRIPT, 4, ...foundingKeys, reservation.emailHash, id, LAUNCH.maxMembers, JSON.stringify(reservation));
  if (result[0] === 'pending') {
    const existing = JSON.parse(await redis('HGET', foundingKeys[1], result[1]) || '{}');
    return { state: 'pending', reservation: existing };
  }
  return { state: result[0], reservation: result[0] === 'reserved' ? reservation : null };
}

export async function bindReservation(reservation, session) {
  await redis('HSET', foundingKeys[1], reservation.id, JSON.stringify({ ...reservation, sessionId: session.id, url: session.url }));
}

export async function releaseReservation(id, sessionId = '') {
  return redis('EVAL', RELEASE_SCRIPT, 4, ...foundingKeys, id, sessionId);
}

export async function confirmMember(session, paidAt = Math.floor(Date.now() / 1000)) {
  if (session.metadata?.offer !== 'founding') return null;
  if (session.currency !== LAUNCH.currency || Number(session.amount_total) !== LAUNCH.foundingPrice) throw new Error('Invalid founding payment amount');
  const email = String(session.customer_details?.email || session.customer_email || '').trim().toLowerCase();
  if (!email) throw new Error('Missing founding email');
  const member = { checkoutSessionId: session.id, email, paidAt: new Date(Number(paidAt) * 1000).toISOString(), active: true };
  const result = await redis('EVAL', CONFIRM_SCRIPT, 4, ...foundingKeys, session.metadata.reservation_id || '', emailHash(email), session.id, session.amount_total, paidAt, LAUNCH.maxMembers, JSON.stringify(member));
  if (!result) throw new Error('Founding reservation could not be confirmed');
  return JSON.parse(result);
}
