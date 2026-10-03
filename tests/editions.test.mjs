import test from 'node:test';
import assert from 'node:assert/strict';
import checkout from '../api/checkout.js';
import { deliveryProducts } from '../api/stripe-webhook.js';
import { buildPurchaseDeliveryEmail } from '../api/_email.js';

const request = (product, language, consent = true) => ({ method: 'POST', headers: { origin: 'https://www.aburtoprocoach.com' }, body: { product, language, acceptedConfidentiality: consent } });
const response = () => ({setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;return this;}});
test('English and Spanish checkouts preserve prices and consent; language changes the Stripe name, locale and retry key', async t => {
  const previous = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = 'fixture-not-a-real-key';
  t.after(() => { if (previous === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = previous; });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => { calls.push({ params: options.body, key: options.headers['Idempotency-Key'] }); return Response.json({url:'https://checkout.stripe.com/c/pay/fixture'}); });
  for (const [slug, amount] of [['5-claves',32000],['romantizar-la-prep',52600],['5-habitos-dia-29',52600]]) {
    for (const language of ['es','en']) {
      const res = response(); await checkout(request(slug,language),res); assert.equal(res.code,200);
      const {params} = calls.at(-1);
      assert.equal(params.get('locale'),language); assert.equal(params.get('metadata[language]'),language);
      assert.equal(params.get('line_items[0][price_data][unit_amount]'),String(amount));
      assert.equal(params.get('line_items[0][price_data][currency]'),'mxn');
      assert.match(params.get('success_url'),new RegExp(`lang=${language}`));
      assert.equal(params.get('metadata[legal_acceptance]'),'privacy_confidentiality_v1');
      if (language === 'en') assert.match(params.get('line_items[0][price_data][product_data][name]'),/English Edition/);
    }
    assert.notEqual(calls.at(-1).key,calls.at(-2).key);
  }
  for (const req of [request('5-claves','fr'),request('5-claves','en',false),request('no-product','en')]) { const res=response();await checkout(req,res);assert.equal(res.code,400); }
  assert.equal(calls.length,6);
});
test('English delivery selects the exact Drive editions; old purchases still receive Spanish files', () => {
  const en=deliveryProducts('starter-pack','en'), es=deliveryProducts('starter-pack');
  assert.deepEqual(en.map(p=>p.fileId),['1rt38Os4YTE11Hn4GZmxqWv_tc4nrtqnI','1Bt8N0wOgF72DUey7qB32g5WQqCtwKWbj','1R0csgbDOx88np_C2ieDWAy7ktFViUF-i']);
  for (let i=0;i<3;i++) { assert.notEqual(en[i].fileId,es[i].fileId);assert.equal(deliveryProducts(en[i].slug,'en')[0].fileId,en[i].fileId); }
  assert.equal(deliveryProducts('5-claves-antes-de-competir','en')[0].fileId,en[2].fileId);
  assert.throws(()=>deliveryProducts('starter-pack','fr'));
  const email=buildPurchaseDeliveryEmail({language:'en',name:'<Customer>',productName:'Starter Pack — English Edition',files:en});
  assert.match(email.html,/&lt;Customer&gt;/); assert.match(email.text,/Join the waitlist/);
  for(const file of en) assert.ok(email.html.includes(file.url));
  assert.doesNotMatch(email.text,/Founding Access confirmed/);
  assert.throws(()=>buildPurchaseDeliveryEmail({language:'en',fileUrl:'javascript:alert(1)'}));
});
