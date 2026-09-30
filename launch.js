(() => {
  const money = cents => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
  const form = document.querySelector('[data-checkout-form]');
  let offer = null;
  let serverOffset = 0;
  function text(selector, value) { document.querySelectorAll(selector).forEach(node => { node.textContent = value; }); }
  function message(value, error = false) {
    const node = document.querySelector('[data-checkout-status]');
    if (node) { node.textContent = value; node.classList.toggle('error', error); }
  }
  function render(data) {
    offer = data;
    serverOffset = Date.parse(data.serverNow) - Date.now();
    text('[data-pack-price]', money(data.price));
    text('[data-pack-discount]', `${data.discountPercent}%${data.stage === 'regular' ? ' aprox.' : ''} de descuento`);
    const status = !data.configured ? 'Lanzamiento en preparación. La fecha de apertura se anunciará aquí.'
      : data.stage === 'scheduled' ? 'Apertura próxima. La ventana de lanzamiento comienza en la fecha oficial.'
      : data.stage === 'reserved' ? 'Los lugares disponibles están en proceso de pago. Vuelve a consultar en unos minutos.'
      : data.stage === 'regular' ? 'La edición Founding 100 ha cerrado. El Starter Pack continúa por $1,050 MXN.'
      : `${data.remaining} lugares disponibles · ${data.confirmed} miembros confirmados de 100.`;
    text('[data-offer-status]', status);
    text('[data-confirmed-members]', data.configured ? `${data.confirmed}/100` : '100');
    text('[data-members-label]', data.configured ? 'miembros confirmados' : 'miembros en esta edición');
    const button = form?.querySelector('button[type="submit"]');
    if (button) {
      button.disabled = !data.checkoutReady;
      button.textContent = !data.configured || data.stage === 'scheduled' ? 'Apertura próximamente'
        : data.stage === 'reserved' ? 'Pagos en proceso' : data.stage === 'regular' ? 'Comprar Starter Pack' : 'Ser Founding Member';
    }
    if (data.stage === 'regular') {
      document.querySelectorAll('[data-founding-benefit]').forEach(node => { node.hidden = true; });
      text('[data-purchase-description]', 'Los tres libros digitales en una compra. Acceso personal por correo.');
    }
    tick();
  }
  function tick() {
    if (!offer) return;
    if (!offer.configured || offer.stage === 'scheduled') return text('[data-launch-clock]', 'Apertura');
    if (offer.stage === 'regular') return text('[data-launch-clock]', 'Cerrado');
    const seconds = Math.max(0, Math.floor((Date.parse(offer.endsAt) - Date.now() - serverOffset) / 1000));
    const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60);
    text('[data-launch-clock]', `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`);
    if (!seconds && offer.stage !== 'regular') refresh();
  }
  async function refresh() {
    try {
      const response = await fetch('/api/commerce', { cache: 'no-store' });
      if (!response.ok) throw new Error('unavailable');
      render(await response.json());
    } catch {
      offer = null;
      text('[data-offer-status]', 'Estamos preparando la apertura. Consulta de nuevo en unos minutos.');
      const button = form?.querySelector('button[type="submit"]');
      if (button) { button.disabled = true; button.textContent = 'Apertura próximamente'; }
    }
  }
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    message('Comprobando el precio y la disponibilidad…');
    try {
      const response = await fetch('/api/commerce', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: 'starter-pack', email: form.elements.email.value.trim(), expectedPrice: offer?.price,
          utmSource: new URLSearchParams(location.search).get('utm_source') || '',
          utmCampaign: new URLSearchParams(location.search).get('utm_campaign') || '' }),
      });
      const data = await response.json();
      if (data.offer) render(data.offer);
      if (!response.ok) { message(data.error || 'No pudimos abrir el pago. Intenta nuevamente.', true); return; }
      const url = new URL(data.url);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('invalid checkout');
      location.assign(url.href);
    } catch { message('No pudimos abrir el pago. Intenta nuevamente.', true); }
    finally { if (offer) button.disabled = !offer.checkoutReady; }
  });
  refresh();
  setInterval(refresh, 30000);
  setInterval(tick, 1000);
})();
