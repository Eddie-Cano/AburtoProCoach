import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/checkout-test.js';

test('checkout Sandbox does not publish Stripe credential errors', async t => {
  const previous = process.env.STRIPE_TEST_SECRET_KEY;
  process.env.STRIPE_TEST_SECRET_KEY = 'fixture';
  t.after(() => {
    if (previous === undefined) delete process.env.STRIPE_TEST_SECRET_KEY;
    else process.env.STRIPE_TEST_SECRET_KEY = previous;
  });
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({error:{message:'Invalid API Key provided: fixture-fragment'}}, {status:401}));
  const log = t.mock.method(console, 'error', () => {});
  const req = {method:'POST', headers:{origin:'https://www.aburtoprocoach.com'}, body:{product:'romantizar-la-prep'}};
  const res = {setHeader(){}, status(code){this.code=code;return this;}, json(body){this.body=body;}};
  await handler(req,res);
  assert.equal(res.code,502);
  assert.match(res.body.error,/revisa la configuración/);
  assert.doesNotMatch(JSON.stringify(res.body),/fixture-fragment/);
  assert.deepEqual(log.mock.calls[0].arguments,['Stripe Sandbox session creation failed:',401]);
});
