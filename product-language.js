(() => {
  let language = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'es';
  const selectors = document.querySelectorAll('[data-product-language]');
  const consentCopies = new Map([...document.querySelectorAll('.legal-consent > span')].map(node => [node, node.innerHTML]));

  window.AbProProductLanguage = () => language;
  function render() {
    selectors.forEach(select => { select.value = language; });
    document.querySelectorAll('[data-language-note]').forEach(note => {
      note.textContent = language === 'en' ? 'You will receive the complete English edition. Same price in MXN.' : 'Recibirás la edición completa en español. El precio es el mismo en ambos idiomas.';
    });
    consentCopies.forEach((original, node) => {
      node.innerHTML = language === 'en' ? 'I have read and accept the <a href="/aviso-de-privacidad.html" target="_blank" rel="noopener noreferrer">Privacy Notice</a>, <a href="/terminos-de-compra.html" target="_blank" rel="noopener noreferrer">Purchase Terms</a> and <a href="/acuerdo-de-confidencialidad.html" target="_blank" rel="noopener noreferrer">Confidentiality Agreement</a> (documents in Spanish).' : original;
    });
  }
  selectors.forEach(select => select.addEventListener('change', () => {
    language = select.value === 'en' ? 'en' : 'es';
    const url = new URL(location.href); url.searchParams.set('lang', language);
    history.replaceState(null, '', url); render();
    window.dispatchEvent(new Event('productlanguagechange'));
  }));
  window.AbProSetProductLanguage = value => {
    language = value === 'en' ? 'en' : 'es';
    const url = new URL(location.href); url.searchParams.set('lang', language);
    history.replaceState(null, '', url); render();
    window.dispatchEvent(new Event('productlanguagechange'));
  };
  document.querySelectorAll('[data-purchase-language]').forEach(button => button.addEventListener('click', () => window.AbProSetProductLanguage(button.dataset.purchaseLanguage)));
  render();
})();
