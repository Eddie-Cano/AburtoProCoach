export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false });

  const provider = String(process.env.WHATSAPP_PROVIDER || '').toLowerCase();
  return res.status(200).json({
    ok: true,
    provider,
    metaConfigured: Boolean(process.env.META_WHATSAPP_TOKEN && process.env.META_PHONE_NUMBER_ID),
    graphVersionConfigured: Boolean(process.env.META_GRAPH_VERSION),
    recipientConfigured: Boolean(process.env.ANDRES_NOTIFICATION_PHONE),
    copyRecipientConfigured: Boolean(process.env.RAIZ_NOTIFICATION_PHONE),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    redisConfigured: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    crmWebhookConfigured: Boolean(process.env.GOOGLE_SHEETS_WEBHOOK_URL),
    crmWebhookSecretConfigured: Boolean(process.env.GOOGLE_SHEETS_WEBHOOK_SECRET || process.env.CRM_WEBHOOK_SECRET),
    stripeWebhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    buyerEmailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.LEAD_FROM_EMAIL),
    driveDeliveryConfigured: Boolean(
      (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY &&
        (process.env.GCP_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL)) ||
      (process.env.GCP_PROJECT_NUMBER && process.env.GCP_WORKLOAD_IDENTITY_POOL_ID &&
        process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID && process.env.GCP_SERVICE_ACCOUNT_EMAIL)
    ),
    timestamp: new Date().toISOString(),
  });
}
