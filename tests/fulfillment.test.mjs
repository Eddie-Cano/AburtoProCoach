import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import { ExternalAccountClient } from 'google-auth-library';
import handler from '../api/stripe-webhook.js';

test('a paid bundle grants three files, survives email failure, and deduplicates different Stripe events for one checkout', async t => {
  const vars = {
    STRIPE_WEBHOOK_SECRET: 'test-signature-only', UPSTASH_REDIS_REST_URL: 'https://redis.fixture.invalid',
    UPSTASH_REDIS_REST_TOKEN: 'fixture', GCP_PROJECT_NUMBER: '123', GCP_WORKLOAD_IDENTITY_POOL_ID: 'fixture',
    GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: 'fixture', GCP_SERVICE_ACCOUNT_EMAIL: 'fixture@project.iam.gserviceaccount.com',
    RESEND_API_KEY: 'fixture', META_WHATSAPP_TOKEN: 'fixture', META_PHONE_NUMBER_ID: 'fixture', WHATSAPP_PROVIDER: 'meta',
    PURCHASE_FROM_EMAIL: 'Fixture <fixture@example.com>',
    SEND_PACK_SALES_EMAIL: 'true',
  };
  const previous = Object.fromEntries(Object.keys(vars).map(key => [key, process.env[key]]));
  Object.assign(process.env, vars);
  t.after(() => { for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value; });
  t.mock.method(ExternalAccountClient, 'fromJSON', () => ({ getRequestHeaders: async () => new Headers({ authorization: 'Bearer fixture' }) }));
  const kv = new Map(), sets = new Map(), sheet = new Map();
  let driveGrants = 0, buyerEmails = 0, ownerEmails = 0, whatsapp = 0, failOwner = true;
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    if (url === vars.UPSTASH_REDIS_REST_URL) {
      const [command, key, ...args] = JSON.parse(options.body);
      let result = null;
      if (command === 'GET') result = kv.get(key) ?? null;
      else if (command === 'SET') {
        if (!args.includes('NX') || !kv.has(key)) { kv.set(key, args[0]); result = 'OK'; }
      } else if (command === 'DEL') result = Number(kv.delete(key));
      else if (command === 'SCARD') result = sets.get(key)?.size || 0;
      else if (command === 'SADD') { if (!sets.has(key)) sets.set(key, new Set()); sets.get(key).add(args[0]); result = 1; }
      else throw new Error(`Unexpected Redis command ${command}`);
      return Response.json({ result });
    }
    if (url.startsWith('https://sheets.googleapis.com/')) {
      const decoded = decodeURIComponent(url), tab = decoded.includes('Founding Members') ? 'members' : 'sales';
      if (options.method === 'GET') return Response.json({ values: (sheet.get(tab) || []).map(row => [row[tab === 'sales' ? 3 : 2]]) });
      const values = JSON.parse(options.body).values[0];
      if (options.method === 'POST') { if (!sheet.has(tab)) sheet.set(tab, []); sheet.get(tab).push(values); }
      else sheet.get(tab)[Number(decoded.match(/!A(\d+):/)[1]) - 2] = values;
      return Response.json({ updatedRows: 1 });
    }
    if (url.startsWith('https://www.googleapis.com/drive/')) {
      if (options.method === 'POST') { driveGrants++; return Response.json({ id: `permission-${driveGrants}` }); }
      return Response.json(url.includes('/permissions?') ? { permissions: [] } : { id: 'file' });
    }
    if (url === 'https://api.resend.com/emails') {
      const body = JSON.parse(options.body);
      if (body.tags[0].value === 'digital_delivery') {
        buyerEmails++;
        assert.equal(body.to[0], 'fixture@example.com');
        assert.equal((body.text.match(/https:\/\/drive.google.com\/file\/d\//g) || []).length, 3);
      } else {
        if (failOwner) { failOwner = false; return Response.json({ error: 'quota fixture' }, { status: 429 }); }
        ownerEmails++;
      }
      return Response.json({ id: 'fixture-email' });
    }
    if (url.startsWith('https://graph.facebook.com/')) { whatsapp++; return Response.json({ messages: [{ id: 'fixture-message' }] }); }
    throw new Error(`Unexpected network call ${url}`);
  });
  const session = { id: 'cs_fixture_bundle', payment_intent: 'pi_fixture_bundle', livemode: true, payment_status: 'paid', amount_total: 105000,
    currency: 'mxn', created: Math.floor(Date.now() / 1000), metadata: { project: 'andres-aburto', product_slug: 'starter-pack', offer: 'regular' },
    customer_details: { name: 'Fixture', email: 'fixture@example.com' } };
  async function run(id, type = 'checkout.session.completed') {
    const body = Buffer.from(JSON.stringify({ id, type, created: session.created, data: { object: session } }));
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', vars.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.`).update(body).digest('hex');
    const req = Readable.from([body]); req.method = 'POST'; req.headers = { 'stripe-signature': `t=${timestamp},v1=${signature}` };
    const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    await handler(req, res); return res;
  }
  assert.equal((await run('evt_fixture_first')).code, 503);
  assert.equal((await run('evt_fixture_retry')).code, 200);
  assert.equal((await run('evt_fixture_other', 'checkout.session.async_payment_succeeded')).data.duplicate, true);
  assert.equal(driveGrants, 3);
  assert.equal(buyerEmails, 1);
  assert.equal(ownerEmails, 1);
  assert.equal(whatsapp, 1);
  assert.equal(sheet.get('sales').length, 1);
  assert.equal(sheet.get('sales')[0].length, 34);
  assert.equal(sheet.get('sales')[0][26], 'Enviado');
  assert.equal(sheet.get('sales')[0][27], 'Drive + correo enviados');

  // With the default pack settings, one buyer email delivers all three books;
  // the internal owner copy does not consume a second daily email.
  process.env.SEND_PACK_SALES_EMAIL = 'false';
  session.id = 'cs_fixture_bundle_default';
  session.payment_intent = 'pi_fixture_bundle_default';
  assert.equal((await run('evt_fixture_default')).code, 200);
  assert.equal(buyerEmails, 2);
  assert.equal(ownerEmails, 1);
  assert.equal(sheet.get('sales').length, 2);
  assert.equal(sheet.get('sales')[1][16], 'Aviso en Sheets y WhatsApp');
});
