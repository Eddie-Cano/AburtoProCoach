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


function buildEnglishDeliveryEmail({ name, productName, fileUrl, files, foundingMember, telegramWaitlistUrl }) {
  const product = cleanText(productName, 160) || 'your digital product';
  const entries = Array.isArray(files) && files.length ? files : [{ name: product, fileUrl }];
  if (entries.length > 1 && entries.length !== 3) throw new Error('The pack requires three files');
  const products = entries.map(file => ({ name: cleanText(file.name, 160), url: safeHttpsUrl(file.fileUrl || file.url) }));
  if (products.some(file => !file.url)) throw new Error('A valid HTTPS delivery URL is required');
  const greeting = cleanText(name, 100) ? `Hello, ${cleanText(name, 100)}.` : 'Hello.';
  const number = Number(foundingMember?.number);
  const founder = foundingMember?.active === true && Number.isInteger(number) && number >= 1 && number <= 100;
  const waitlist = safeHttpsUrl(telegramWaitlistUrl);
  const subject = `Your access to ${product} is ready${founder ? ` · Founding Member #${number}` : ''}`;
  const bonus = founder ? `Founding Access confirmed · Member #${number}. You will receive a private announcement, early purchase access and an exclusive price for Posing Intensivo. The course is purchased separately when it launches; the member price will be announced before opening.` : '';
  const text = [greeting, '', 'Thank you for your purchase!', `Your payment for ${product} has been confirmed. Your English edition is ready.`, '', ...products.map(file => `${file.name}: ${file.url}`), '', 'Access is linked to the email you used at checkout. Open the links with that Google account.', 'This material is for personal use. Do not share the links or access with others.', bonus, ...(waitlist ? ['', 'Want an invitation to the Telegram community?', `Join the waitlist: ${waitlist}`] : []), '', 'Thank you for trusting this process.', 'Andrés Aburto · Pro Coach'].filter(line => line !== undefined).join('\n');
  const button = (url, label) => `<a href="${escapeHtml(url)}" style="display:inline-block;background:#df252d;color:#fff;padding:14px 22px;text-decoration:none;font-weight:bold;border-radius:4px">${escapeHtml(label)}</a>`;
  const html = `<!doctype html><html lang="en"><body style="margin:0;background:#111;color:#eee;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:30px 16px"><table role="presentation" width="600" style="max-width:600px;width:100%;background:#1b1b1b" cellpadding="28"><tr><td style="border-top:4px solid #df252d"><p style="color:#df252d;font-weight:bold;letter-spacing:2px">ABURTO PRO COACH</p><h1>Your access is ready.</h1><p>${escapeHtml(greeting)}</p><p>Thank you for your purchase! Your payment for <strong>${escapeHtml(product)}</strong> has been confirmed.</p><p>Your complete English edition is ready:</p>${products.map(file => `<div style="margin:24px 0"><h2 style="font-size:20px">${escapeHtml(file.name)}</h2>${button(file.url, 'Open my product')}</div>`).join('')}<p>Access is linked to the email you used at checkout. Open the links with that Google account.</p><p style="color:#bbb">This material is for personal use. Do not share the links or access with others.</p>${bonus ? `<h2>Founding Access confirmed</h2><p>${escapeHtml(bonus)}</p>` : ''}${waitlist ? `<h2>The next chapter.</h2><p>Want an invitation to the Telegram community?</p>${button(waitlist, 'Join the waitlist')}` : ''}<p style="margin-top:32px">Thank you for trusting this process.<br><strong>Andrés Aburto · Pro Coach</strong></p></td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}

export function buildPurchaseDeliveryEmail({
  language = 'es',
  name,
  productName,
  fileUrl,
  files,
  foundingMember,
  telegramWaitlistUrl = process.env.TELEGRAM_WAITLIST_URL || 'https://www.aburtoprocoach.com/comunidad-espera.html',
}) {
  if (language === 'en') return buildEnglishDeliveryEmail({ name, productName, fileUrl, files, foundingMember, telegramWaitlistUrl });
  if (Array.isArray(files) && files.length > 1) return buildPackDeliveryEmail({ name, productName, files, foundingMember, telegramWaitlistUrl });
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

export function buildPackDeliveryEmail({ name, productName = 'Starter Pack', files, foundingMember, telegramWaitlistUrl = process.env.TELEGRAM_WAITLIST_URL || 'https://www.aburtoprocoach.com/comunidad-espera.html' }) {
  if (!Array.isArray(files) || files.length !== 3) throw new Error('The Starter Pack requires three delivered products');
  const products = files.map(file => ({ name: cleanText(file.name, 160), url: safeHttpsUrl(file.fileUrl || file.url) }));
  if (products.some(file => !file.url || !file.name)) throw new Error('Invalid pack access URL');
  const number = Number(foundingMember?.number);
  const founder = foundingMember?.active === true && Number.isInteger(number) && number >= 1 && number <= 100;
  const memberId = String(number).padStart(3, '0');
  const waitlistUrl = safeHttpsUrl(telegramWaitlistUrl);
  const subject = founder ? `Founding Member #${memberId}: tus tres accesos ya están listos` : 'Tu Starter Pack: tus tres accesos ya están listos';
  const text = [name ? `Hola, ${cleanText(name, 100)}.` : 'Hola.', '', '¡Gracias por tu compra!',
    `Tu pago del ${cleanText(productName, 160)} fue confirmado. Ya tienes acceso a los tres productos:`, '',
    ...products.map(file => `${file.name}: ${file.url}`), '',
    ...(founder ? [`ERES FOUNDING MEMBER #${memberId} / 100`, 'Tu Founding Access está registrado: aviso privado, acceso anticipado y un precio exclusivo para comprar Posing Intensivo cuando se lance.', 'Te avisaremos en el correo de tu compra. La fecha y el precio exclusivo se anunciarán antes de abrir. Posing Intensivo se adquiere por separado.', ''] : []),
    'Abre los archivos en Google Drive con el mismo correo que utilizaste al comprar. El acceso es personal.',
    ...(waitlistUrl ? ['', `Lista de espera de Telegram (registro voluntario): ${waitlistUrl}`] : []),
    '', 'Gracias por confiar en este proceso.', 'Andrés Aburto · Formación aplicada al fitness.',
    'Para recibir ayuda, responde a este correo.',
  ].join('\n');
  const site = safeHttpsUrl(process.env.SITE_URL || DEFAULT_SITE_URL, DEFAULT_SITE_URL).replace(/\/$/, '');
  const buttons = products.map((file, i) => `<tr><td style="padding:0 28px 15px"><a href="${escapeHtml(file.url)}" style="display:block;background:#951f29;border-radius:6px;padding:18px;color:white;text-decoration:none;font:700 15px Arial,sans-serif">0${i + 1} · ABRIR ${escapeHtml(file.name.toUpperCase())} →</a></td></tr>`).join('');
  const bonus = founder ? `<tr><td style="padding:10px 28px 28px"><div style="background:#211217;border:1px solid #60303d;padding:24px"><p style="margin:0;color:#ef9ba7;font:700 12px Arial,sans-serif;letter-spacing:1px">FOUNDING MEMBER #${memberId} / 100</p><h2 style="color:#f5e7d5;font:800 25px Arial,sans-serif;margin:15px 0">FOUNDING ACCESS CONFIRMADO.</h2><p style="color:#d5c2c6;font:14px/1.7 Arial,sans-serif;margin:0">Recibirás aviso privado, acceso anticipado y un precio exclusivo para comprar <strong>Posing Intensivo</strong> cuando abra. Te avisaremos en el correo de tu compra antes del lanzamiento público.</p><p style="color:#a99097;font:12px/1.7 Arial,sans-serif;margin:16px 0 0">Posing Intensivo se adquiere por separado. La fecha y el precio exclusivo se anunciarán antes de abrir.</p></div></td></tr>` : '';
  const html = `<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:#080808"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 10px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#100d0e;border:1px solid #35262b;border-top:6px solid #951f29;border-radius:10px"><tr><td align="center" style="padding:30px 28px"><img src="${escapeHtml(site)}/assets/logo/aburto-original.png" width="185" alt="Aburto Pro Coach" style="width:185px;height:auto"></td></tr><tr><td style="padding:0 28px 20px"><p style="color:#ef8291;font:700 12px Arial,sans-serif;letter-spacing:1px">COMPRA CONFIRMADA · STARTER PACK</p><h1 style="color:#f5e7d5;font:800 35px/1.05 Arial,sans-serif;margin:16px 0">TRES HERRAMIENTAS.<br>YA SON TUYAS.</h1><p style="color:#d3c4c0;font:15px/1.7 Arial,sans-serif">${name ? `Hola, ${escapeHtml(cleanText(name, 100))}. ` : ''}¡Gracias por tu compra! Tu pago fue confirmado y tus tres accesos ya están listos.</p><img src="${escapeHtml(site)}/assets/products/starter-pack-founding-100.webp" width="580" alt="Los tres libros del Starter Pack" style="display:block;width:100%;height:auto;margin:22px 0 4px"></td></tr>${buttons}${bonus}<tr><td style="padding:8px 28px 24px;color:#b4a6a2;font:13px/1.7 Arial,sans-serif">Abre cada archivo con la cuenta de Google asociada al correo de tu compra. El acceso es personal.${waitlistUrl ? `<p style="margin:16px 0 10px;color:#f5e7d5;font-weight:700">¿Te gustaría formar parte de la comunidad Aburto?</p><p>Regístrate voluntariamente para recibir la invitación cuando abramos. No se te agregará automáticamente a ningún grupo.</p><a href="${escapeHtml(waitlistUrl)}" style="display:inline-block;background:#951f29;border-radius:6px;padding:16px 18px;margin-top:8px;color:#ffffff;text-decoration:none;font:700 14px Arial,sans-serif">UNIRME A LA LISTA DE ESPERA →</a>` : ''}</td></tr><tr><td style="border-top:1px solid #35262b;padding:24px 28px;color:#b4a6a2;font:13px/1.7 Arial,sans-serif">Gracias por confiar en este proceso.<br><strong style="color:#f5e7d5">Andrés Aburto · Formación aplicada al fitness.</strong><p>Para recibir ayuda con tu compra, responde a este correo.</p></td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}

export async function sendTransactionalEmail({
  to,
  cc,
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
      ...(cc ? {cc: normalizeRecipients(cc)} : {}),
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
  let content = buildPurchaseDeliveryEmail({
    language: sale.language,
    name: sale.name,
    productName: sale.productName,
    fileUrl: delivery.fileUrl,
    files: delivery.files,
    foundingMember: sale.foundingMember,
  });
  if (delivery.library) {
    for (const key of ['text','html']) content[key] = content[key].replace(/Abre los archivos en Google Drive con el mismo correo que utilizaste al comprar\./g, 'Abre tu biblioteca personal y acepta ambos documentos. No necesitas una cuenta de Google.').replace(/Access is linked to the email you used at checkout\. Open the links with that Google account\./g, 'Open your personal library in any browser, then accept the privacy notice and confidentiality agreement. No Google account is required.').replace(/El acceso está vinculado al mismo correo que utilizaste durante la compra\. Abre el enlace con esa cuenta de Google\./g, 'Abre tu biblioteca personal y acepta el aviso de privacidad y el acuerdo de confidencialidad. No necesitas una cuenta de Google.').replace(/El acceso está vinculado al correo utilizado durante la compra\. Abre el enlace con esa misma cuenta de Google\./g, 'Abre tu biblioteca personal y acepta ambos documentos. No necesitas una cuenta de Google.').replace(/Abre cada archivo con la cuenta de Google asociada al correo de tu compra\./g, 'Abre tu biblioteca personal y acepta ambos documentos para descargar. No necesitas una cuenta de Google.');
  }
  return sendTransactionalEmail({
    to: sale.email,
    ...content,
    idempotencyKey: `aburto/delivery/${sale.checkoutSessionId || eventId}`,
    tags: [
      { name: 'category', value: 'digital_delivery' },
      { name: 'product', value: cleanText(sale.productSlug || 'digital', 200).replace(/[^a-zA-Z0-9_-]/g, '-') },
    ],
  });
}
