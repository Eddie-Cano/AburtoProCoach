(() => {
  if (new URLSearchParams(location.search).get('lang') !== 'en') return;
  document.documentElement.lang = 'en';
  document.title = 'Your purchase | Aburto Pro Coach';
  const main = document.querySelector('main.confirmation');
  if (!main) return;
  main.querySelector('h1').innerHTML = 'THANK YOU FOR<br>BUILDING WITH US.';
  const paragraphs = main.querySelectorAll(':scope > p');
  paragraphs[0].textContent = 'If you completed your payment, you will receive confirmation and access to your English products by email after it is verified. Please check your spam or promotions folder too.';
  paragraphs[1].innerHTML = '<span aria-hidden="true">ⓘ</span> <strong>Paid by SPEI or bank transfer?</strong> Confirmation can take approximately 1–2 business days. Your access will be sent when Stripe confirms payment. OXXO and other delayed payment methods can take different amounts of time.';
  paragraphs[2].textContent = 'For Founding 100 purchases, your member number will be assigned manually after payment is verified.';
  paragraphs[3].innerHTML = 'For help with your purchase, email <a href="mailto:raiznoblemx@gmail.com">raiznoblemx@gmail.com</a> from the email address you used at checkout.';
  const invitation = main.querySelector(':scope > div:not(.ey)');
  invitation.querySelector('h2').textContent = 'JOIN OUR COMMUNITY';
  invitation.querySelector('p').textContent = 'Join the waitlist voluntarily and we will email you when Andrés Aburto’s community opens.';
  invitation.querySelector('a').textContent = 'JOIN THE WAITLIST →';
  main.querySelector(':scope > a').textContent = 'Back to the library ↗';
})();
