const DEFAULT_FROM = 'Aburto Pro Coach <onboarding@resend.dev>';
const DEFAULT_SITE_URL = 'https://www.aburtoprocoach.com';

function cleanText(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return cleanText(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeHttpsUrl(value, fallback = '') {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

function normalizeRecipients(to) {
  const recipients = (Array.isArray(to) ? to : [to])
    .map(value => cleanText(value, 254).toLowerCase())
    .filter(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
  return [...new Set(recipients)];
}

function idempotencyKey(value) {
  return cleanText(value, 220).replace(/[^a-zA-Z0-9_./:-]/g, '-');
}

export function emailConfiguration() {
  const from = cleanText(process.env.PURCHASE_FROM_EMAIL || process.env.LEAD_FROM_EMAIL || DEFAULT_FROM, 254);
  const replyTo = cleanText(process.env.PURCHASE_REPLY_TO_EMAIL || process.env.REPLY_TO_EMAIL || '', 254);
  return {
    provider: 'resend',
    apiConfigured: Boolean(process.env.RESEND_API_KEY),
    verifiedSenderConfigured: Boolean(process.env.PURCHASE_FROM_EMAIL || process.env.LEAD_FROM_EMAIL),
    from,
    replyTo,
  };
}

export function buildPurchaseDeliveryEmail({
  name,
  productName,
  fileUrl,
  telegramWaitlistUrl = process.env.TELEGRAM_WAITLIST_URL || '',
}) {
  const customerName = cleanText(name, 100);
  const product = cleanText(productName, 160) || 'tu producto digital';
  const accessUrl = safeHttpsUrl(fileUrl);
  const waitlistUrl = safeHttpsUrl(telegramWaitlistUrl);
  if (!accessUrl) throw new Error('A valid HTTPS delivery URL is required');

  const greeting = customerName ? `Hola, ${customerName}.` : 'Hola.';
  const subject = `Tu acceso a ${product} ya está listo`;
  const text = [
    greeting,
    '',
    '¡Gracias por tu compra!',
    `Tu pago de ${product} fue confirmado y tu acceso ya está listo.`,
    '',
    `ACCEDER A MI PRODUCTO: ${accessUrl}`,
    '',
    'El acceso está vinculado al mismo correo que utilizaste durante la compra. Abre el enlace con esa cuenta de Google.',
    'Este material es personal. No compartas el enlace ni el acceso con terceros.',
    ...(waitlistUrl ? [
      '',
      '¿Quieres recibir la invitación a la comunidad de Telegram?',
      `Únete a la lista de espera: ${waitlistUrl}`,
    ] : []),
    '',
    'Gracias por confiar en este proceso.',
    'Andrés Aburto · Pro Coach',
  ].join('\n');

  const safeName = escapeHtml(customerName);
  const safeProduct = escapeHtml(product);
  const safeAccessUrl = escapeHtml(accessUrl);
  const safeWaitlistUrl = escapeHtml(waitlistUrl);
  const siteUrl = safeHttpsUrl(process.env.SITE_URL || DEFAULT_SITE_URL, DEFAULT_SITE_URL);
  const logoUrl = `${siteUrl.replace(/\/$/, '')}/assets/logo/aburto-original.png`;

  const waitlistBlock = waitlistUrl ? `
    <tr>
      <td style="padding:0 42px 34px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#151515;border:1px solid #2b2b2b;border-radius:12px">
          <tr>
            <td style="padding:22px 24px">
              <p style="margin:0 0 8px;color:#ffffff;font:700 17px Arial,sans-serif">Comunidad Aburto</p>
              <p style="margin:0 0 16px;color:#c8c8c8;font:14px/1.55 Arial,sans-serif">Si quieres recibir la invitación a la comunidad de Telegram, regístrate voluntariamente en la lista de espera.</p>
              <a href="${safeWaitlistUrl}" style="color:#e9a1a1;font:700 14px Arial,sans-serif;text-decoration:underline">ENTRAR A LA LISTA DE ESPERA →</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>` : '';

  const html = `<!doctype html>
<html lang="es-MX">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#080808">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">Gracias por tu compra. Tu acceso a ${safeProduct} ya está disponible.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#080808">
      <tr>
        <td align="center" style="padding:28px 12px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:640px;background:#0d0d0d;border:1px solid #242424;border-radius:16px;overflow:hidden">
            <tr>
              <td style="height:7px;background:#8f1f27;font-size:0;line-height:0">&nbsp;</td>
            </tr>
            <tr>
              <td align="center" style="padding:34px 42px 22px">
                <img src="${escapeHtml(logoUrl)}" width="180" alt="Aburto Pro Coach" style="display:block;width:180px;max-width:70%;height:auto;border:0">
              </td>
            </tr>
            <tr>
              <td style="padding:8px 42px 0">
                <p style="margin:0 0 10px;color:#a93840;font:700 13px Arial,sans-serif;letter-spacing:1.6px;text-transform:uppercase">Compra confirmada</p>
                <h1 style="margin:0;color:#ffffff;font:800 34px/1.08 Arial,sans-serif;letter-spacing:-1px">TU PRODUCTO<br>YA ESTÁ LISTO.</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 42px 10px;color:#d5d5d5;font:16px/1.65 Arial,sans-serif">
                <p style="margin:0 0 14px">${safeName ? `Hola, <strong style="color:#ffffff">${safeName}</strong>.` : 'Hola.'}</p>
                <p style="margin:0 0 14px">¡Gracias por tu compra! Tu pago de <strong style="color:#ffffff">${safeProduct}</strong> fue confirmado y tu acceso ya está disponible.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:18px 42px 30px">
                <a href="${safeAccessUrl}" style="display:inline-block;background:#951f29;color:#ffffff;font:800 15px Arial,sans-serif;letter-spacing:.5px;text-decoration:none;padding:16px 24px;border-radius:8px">ACCEDER A MI PRODUCTO →</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 42px 30px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#121212;border-left:3px solid #951f29">
                  <tr>
                    <td style="padding:18px 20px;color:#bdbdbd;font:13px/1.6 Arial,sans-serif">
                      El acceso está vinculado al correo utilizado durante la compra. Abre el enlace con esa misma cuenta de Google. Este material es personal; no compartas el enlace ni el acceso con terceros.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${waitlistBlock}
            <tr>
              <td style="padding:28px 42px 36px;border-top:1px solid #232323;color:#8d8d8d;font:12px/1.6 Arial,sans-serif">
                <p style="margin:0 0 6px;color:#d8d8d8;font-weight:700">Gracias por confiar en este proceso.</p>
                <p style="margin:0">Andrés Aburto · Pro Coach</p>
                <p style="margin:12px 0 0">Si no reconoces esta compra, responde a este correo para recibir ayuda.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

export async function sendTransactionalEmail({
  to,
  subject,
  text,
  html,
  idempotencyKey: rawIdempotencyKey,
  tags = [],
}) {
  const config = emailConfiguration();
  if (!config.apiConfigured) return { sent: false, reason: 'resend_not_configured' };

  const recipients = normalizeRecipients(to);
  if (recipients.length === 0) return { sent: false, reason: 'missing_recipient' };

  const key = idempotencyKey(rawIdempotencyKey);
  if (!key) return { sent: false, reason: 'missing_idempotency_key' };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': key,
    },
    body: JSON.stringify({
      from: config.from,
      to: recipients,
      subject: cleanText(subject, 200),
      text: String(text || ''),
      ...(html ? { html: String(html) } : {}),
      ...(config.replyTo ? { reply_to: config.replyTo } : {}),
      ...(tags.length ? { tags } : {}),
    }),
    signal: AbortSignal.timeout(10000),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error('Transactional email provider rejected the request');
    error.code = `resend_${response.status}`;
    throw error;
  }
  return { sent: true, id: String(data?.id || '') };
}

export async function sendPurchaseDeliveryEmail({ sale, delivery, eventId }) {
  if (!delivery?.granted || !sale?.email) {
    return { sent: false, reason: delivery?.reason || 'delivery_not_granted' };
  }
  const content = buildPurchaseDeliveryEmail({
    name: sale.name,
    productName: sale.productName,
    fileUrl: delivery.fileUrl,
  });
  return sendTransactionalEmail({
    to: sale.email,
    ...content,
    idempotencyKey: `aburto/delivery/${eventId}`,
    tags: [
      { name: 'category', value: 'digital_delivery' },
      { name: 'product', value: cleanText(sale.productSlug || 'digital', 200).replace(/[^a-zA-Z0-9_-]/g, '-') },
    ],
  });
}

