import test from 'node:test';
import assert from 'node:assert/strict';
import { createDriveAuthClient } from '../api/stripe-webhook.js';

const config = {
  GCP_PROJECT_NUMBER: '123456789',
  GCP_WORKLOAD_IDENTITY_POOL_ID: 'vercel',
  GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: 'vercel',
  GCP_SERVICE_ACCOUNT_EMAIL: 'delivery@example.iam.gserviceaccount.com',
};

test('exchanges the Vercel token and requests Drive access for the service account', async t => {
  const previousToken = process.env.VERCEL_OIDC_TOKEN;
  const previousEnvironment = process.env.VERCEL_ENV;
  t.after(() => {
    if (previousToken === undefined) delete process.env.VERCEL_OIDC_TOKEN;
    else process.env.VERCEL_OIDC_TOKEN = previousToken;
    if (previousEnvironment === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousEnvironment;
  });
  const payload = Buffer.from(JSON.stringify({
    aud: 'https://vercel.com/raiz-noble',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  const oidcToken = `test.${payload}.test`;
  process.env.VERCEL_OIDC_TOKEN = oidcToken;
  process.env.VERCEL_ENV = 'production';

  const client = createDriveAuthClient(config);
  const requests = [];
  // Keep the real Google auth library token exchange, replacing only transport.
  const request = async options => {
    requests.push(options);
    if (options.url === 'https://sts.googleapis.com/v1/token') {
      assert.equal(options.data.get('subject_token'), oidcToken);
      assert.equal(options.data.get('audience'),
        '//iam.googleapis.com/projects/123456789/locations/global/workloadIdentityPools/vercel/providers/vercel');
      assert.equal(options.data.get('scope'), 'https://www.googleapis.com/auth/cloud-platform');
      return { data: { access_token: 'federated-test-token', expires_in: 3600, token_type: 'Bearer' } };
    }
    assert.equal(options.url,
      'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/delivery@example.iam.gserviceaccount.com:generateAccessToken');
    assert.equal(options.headers.authorization, 'Bearer federated-test-token');
    assert.deepEqual(options.data.scope, ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets']);
    return { data: { accessToken: 'drive-test-token', expireTime: new Date(Date.now() + 3600000).toISOString() } };
  };
  client.transporter.request = request;
  client.stsCredential.transporter.request = request;

  const headers = await client.getRequestHeaders();
  assert.equal(headers.get('authorization'), 'Bearer drive-test-token');
  assert.equal(requests.length, 2);
});

test('does not start authentication before the Google configuration is complete', () => {
  for (const key of Object.keys(config)) {
    const incomplete = { ...config };
    delete incomplete[key];
    assert.equal(createDriveAuthClient(incomplete), null);
  }
  const legacy = { ...config, GOOGLE_SERVICE_ACCOUNT_EMAIL: config.GCP_SERVICE_ACCOUNT_EMAIL };
  delete legacy.GCP_SERVICE_ACCOUNT_EMAIL;
  assert.ok(createDriveAuthClient(legacy));
});
