import { googleAccessToken } from './stripe-webhook.js';
import { getManualOffer } from '../lib/manual-offer.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false });

  const verifiedSenderConfigured = Boolean(process.env.PURCHASE_FROM_EMAIL || process.env.LEAD_FROM_EMAIL);
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
  const buyerEmailConfigured = Boolean(process.env.RESEND_API_KEY && verifiedSenderConfigured);
  const driveDeliveryConfigured = Boolean(
    process.env.GCP_PROJECT_NUMBER && process.env.GCP_WORKLOAD_IDENTITY_POOL_ID &&
    process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID &&
    (process.env.GCP_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL)
  );
  let offer = null;
  let offerReadable = false;
  if (stripeConfigured && buyerEmailConfigured && driveDeliveryConfigured) {
    try {
      offer = await getManualOffer(await googleAccessToken());
      offerReadable = true;
    } catch (error) {
      console.error('Health check could not read manual launch state:', error?.message);
    }
  }
  return res.status(200).json({
    ok: true,
    provider: String(process.env.WHATSAPP_PROVIDER || '').toLowerCase(),
    metaConfigured: Boolean(process.env.META_WHATSAPP_TOKEN && process.env.META_PHONE_NUMBER_ID),
    recipientConfigured: Boolean(process.env.ANDRES_NOTIFICATION_PHONE),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    redisConfigured: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    redisRequiredForDigitalCheckout: false,
    crmWebhookConfigured: Boolean(process.env.GOOGLE_SHEETS_WEBHOOK_URL),
    stripeWebhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    stripeCheckoutConfigured: stripeConfigured,
    emailProvider: 'resend',
    emailApiConfigured: Boolean(process.env.RESEND_API_KEY),
    verifiedSenderConfigured,
    buyerEmailConfigured,
    emailReplyConfigured: Boolean(process.env.PURCHASE_REPLY_TO_EMAIL || process.env.REPLY_TO_EMAIL),
    driveDeliveryConfigured,
    foundingCapacity: 100,
    foundingControl: 'manual_google_sheets',
    foundingDurationHours: null,
    foundingStartConfigured: false,
    manualOfferReadable: offerReadable,
    manualOfferStatus: offer?.manualStatus || 'unavailable',
    packCheckoutConfigured: stripeConfigured && buyerEmailConfigured && driveDeliveryConfigured && offerReadable,
    packCheckoutReady: offer?.checkoutReady === true,
    timestamp: new Date().toISOString(),
  });
}
