(() => {
  const buttons = document.querySelectorAll('[data-digital-checkout]');
  if (!buttons.length) return;

  async function openCheckout(button) {
    if (button.dataset.loading === 'true') return;
    const original = button.textContent;
    button.dataset.loading = 'true';
    button.setAttribute('aria-disabled', 'true');
    button.textContent = 'Abriendo checkout…';
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: button.dataset.digitalCheckout,
          utmSource: new URLSearchParams(location.search).get('utm_source') || '',
          utmCampaign: new URLSearchParams(location.search).get('utm_campaign') || '',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No pudimos abrir el checkout.');
      const url = new URL(data.url);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('Checkout inválido.');
      location.assign(url.href);
    } catch (error) {
      button.textContent = error.message || 'Intenta nuevamente';
      setTimeout(() => { button.textContent = original; }, 2500);
    } finally {
      button.dataset.loading = 'false';
      button.removeAttribute('aria-disabled');
    }
  }

  buttons.forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      openCheckout(button);
    });
  });
})();
