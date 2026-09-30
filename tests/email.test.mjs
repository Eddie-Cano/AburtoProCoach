import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPurchaseDeliveryEmail } from '../api/_email.js';

test('builds the complete Spanish purchase delivery email', () => {
  const email = buildPurchaseDeliveryEmail({
    name: 'Andrea',
    productName: 'El Día 29',
    fileUrl: 'https://drive.google.com/file/d/example/view',
    telegramWaitlistUrl: 'https://www.aburtoprocoach.com/comunidad-telegram.html',
  });

  assert.equal(email.subject, 'Tu acceso a El Día 29 ya está listo');
  assert.match(email.text, /¡Gracias por tu compra!/);
  assert.match(email.text, /ACCEDER A MI PRODUCTO/);
  assert.match(email.text, /lista de espera/);
  assert.match(email.html, /TU PRODUCTO<br>YA ESTÁ LISTO/);
  assert.match(email.html, /El Día 29/);
});

test('escapes customer-controlled values and rejects unsafe delivery URLs', () => {
  const email = buildPurchaseDeliveryEmail({
    name: '<script>alert(1)</script>',
    productName: 'Libro & guía',
    fileUrl: 'https://drive.google.com/file/d/example/view',
  });

  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.html, /&lt;script&gt;/);
  assert.match(email.html, /Libro &amp; guía/);
  assert.doesNotMatch(email.html, /Comunidad Aburto/);
  assert.throws(() => buildPurchaseDeliveryEmail({ fileUrl: 'javascript:alert(1)' }));
});

