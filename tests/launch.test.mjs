import test from 'node:test';
import assert from 'node:assert/strict';
import { offerState, LAUNCH, PACK_PRODUCTS } from '../lib/launch-config.js';
import { buildPurchaseDeliveryEmail } from '../api/_email.js';
import { saleValues, memberValues, syncSaleToSheet } from '../lib/crm.js';

const startAt = '2026-10-01T12:00:00-06:00';
const start = Date.parse(startAt);

test('uses exact 30% pricing and closes at 100 members or precisely 72 hours', () => {
  assert.equal(LAUNCH.foundingPrice, LAUNCH.individualTotal * .7);
  assert.equal(offerState({ startAt, now: start - 1 }).stage, 'scheduled');
  assert.equal(offerState({ startAt, now: start, confirmed: 99 }).price, 96040);
  assert.equal(offerState({ startAt, now: start, confirmed: 100 }).price, 105000);
  assert.equal(offerState({ startAt, now: start, confirmed: 99, reserved: 1 }).stage, 'reserved');
  assert.equal(offerState({ startAt, now: start + 72 * 3600000 - 1 }).stage, 'founding');
  const closed = offerState({ startAt, now: start + 72 * 3600000 });
  assert.equal(closed.stage, 'regular');
  assert.equal(closed.foundingAccess, false);
  assert.equal(offerState({ now: start }).checkoutReady, false);
  assert.equal(offerState({ startAt, now: start, configured: false }).checkoutReady, false);
});

test('delivers all three titles and only grants a real member number in the founding email', () => {
  const input = { name: '<Client>', productName: 'Starter Pack', files: PACK_PRODUCTS };
  const founder = buildPurchaseDeliveryEmail({ ...input, foundingMember: { active: true, number: 100 } });
  assert.match(founder.subject, /#100/);
  for (const product of PACK_PRODUCTS) {
    assert.ok(founder.html.includes(product.url));
    assert.ok(founder.text.includes(product.name));
  }
  assert.match(founder.html, /&lt;Client&gt;/);
  assert.match(founder.text, /se adquiere por separado/);
  const regular = buildPurchaseDeliveryEmail(input);
  assert.doesNotMatch(regular.html, /FOUNDING ACCESS CONFIRMADO/);
  assert.doesNotMatch(buildPurchaseDeliveryEmail({ ...input, foundingMember: { active: false, number: 1 } }).subject, /Founding Member/);
  assert.throws(() => buildPurchaseDeliveryEmail({ ...input, files: PACK_PRODUCTS.slice(0, 2) }));
});

test('writes the exact live Sheet schemas and updates a stable checkout row on retry', async t => {
  const sale = { saleId: 'SALE-test', checkoutSessionId: 'cs_test_fixture', paymentIntentId: 'pi_fixture',
    productName: 'Starter Pack', productSlug: 'starter-pack', kind: 'digital', amountMxn: 960.4,
    name: 'Fixture', email: 'fixture@example.com', foundingMember: { active: true, number: 1 },
    deliveries: PACK_PRODUCTS.map(file => ({ slug: file.slug, status: 'Drive concedido' })), buyerEmailStatus: 'Enviado' };
  assert.equal(saleValues(sale).length, 34);
  assert.equal(memberValues(sale).length, 18);
  assert.equal(saleValues(sale)[20], 1);
  const writes = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (options.method === 'GET') return Response.json({ values: [['cs_test_fixture']] });
    writes.push({ url: decodeURIComponent(url), method: options.method, body: JSON.parse(options.body) });
    return Response.json({ updatedRows: 1 });
  });
  assert.equal((await syncSaleToSheet(sale, 'test-only-token')).synced, true);
  assert.equal(writes.length, 2);
  assert.equal(writes[0].method, 'PUT');
  assert.match(writes[0].url, /Ventas'!A2:AH2/);
  assert.match(writes[1].url, /Founding Members'!A2:R2/);
  assert.equal(writes[0].body.values[0][27], 'No aplica');
});
