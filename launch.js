(() => {
  const money = cents => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
  const form = document.querySelector('[data-checkout-form]');
  let offer = null;
  function text(selector, value) { document.querySelectorAll(selector).forEach(node => { node.textContent = value; }); }
  function message(value, error = false) {
    const node = document.querySelector('[data-checkout-status]');
    if (node) { node.textContent = value; node.classList.toggle('error', error); }
  }
  function render(data) {
    offer = data;
    text('[data-pack-price]', money(data.price));
    text('[data-pack-discount]', `${data.discountPercent}%${data.stage === 'regular' ? ' aprox.' : ''} de descuento`);
    const status = !data.configured ? 'Lanzamiento en preparación. La apertura será manual.'
      : data.stage === 'scheduled' ? 'La venta se habilitará cuando el equipo abra Founding 100.'
      : data.stage === 'reserved' ? 'Los lugares disponibles están en proceso de pago. Vuelve a consultar en unos minutos.'
      : data.stage === 'regular' ? 'La edición Founding 100 ha cerrado. El Starter Pack continúa por $1,050 MXN.'
      : 'Registro Founding 100 abierto · Cupos administrados manualmente.';
    text('[data-offer-status]', status);
    text('[data-confirmed-members]', '100');
    text('[data-members-label]', 'plazas máximas · control manual');
    const button = form?.querySelector('button[type="submit"]');
    if (button) {
      button.disabled = !data.checkoutReady;
      button.textContent = !data.configured || data.stage === 'scheduled' ? 'Apertura próximamente'
        : data.stage === 'reserved' ? 'Pagos en proceso' : data.stage === 'regular' ? 'Comprar Starter Pack' : 'Ser Founding Member';
    }
    if (button && data.checkoutReady && window.AbProProductLanguage?.() === 'en') button.textContent = data.stage === 'founding' ? 'Buy English Pack · Founding 100' : 'Buy English Starter Pack';
    if (data.stage === 'regular') {
      document.querySelectorAll('[data-founding-benefit]').forEach(node => { node.hidden = true; });
      text('[data-purchase-description]', 'Los tres libros digitales en una compra. Acceso personal por correo.');
    }
    tick();
  }
  function tick() {
    if (!offer) return;
    text('[data-launch-clock]', offer.stage === 'regular' ? 'Edición cerrada' : offer.stage === 'founding' ? 'Abierto' : 'Próximamente');
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
    const consent = form.querySelector('[data-legal-consent]');
    if (!consent?.checked) {
      consent?.setCustomValidity('Debes aceptar el Aviso de Privacidad y el Acuerdo de Confidencialidad para continuar.');
      consent?.reportValidity();
      return;
    }
    consent.setCustomValidity('');
    button.disabled = true;
    message('Comprobando el precio y la disponibilidad…');
    try {
      const response = await fetch('/api/commerce', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: 'starter-pack', email: form.elements.email.value.trim(), expectedPrice: offer?.price,
          acceptedConfidentiality: true, language: window.AbProProductLanguage?.() || 'es',
          utmSource: window.AbProAnalytics?.getCampaign().source || new URLSearchParams(location.search).get('utm_source') || '',
          utmCampaign: window.AbProAnalytics?.getCampaign().campaign || new URLSearchParams(location.search).get('utm_campaign') || '' }),
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
  window.addEventListener('productlanguagechange', () => { if (offer) render(offer); });
  refresh();
  setInterval(refresh, 30000);
})();
