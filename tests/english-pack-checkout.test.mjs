import test from 'node:test';
import assert from 'node:assert/strict';
import { ExternalAccountClient } from 'google-auth-library';
import handler from '../api/commerce.js';
import { LAUNCH } from '../lib/launch-config.js';

test('English pack keeps manual Founding control, existing prices, consent and language metadata', async t => {
  const vars = { STRIPE_SECRET_KEY:'fixture',STRIPE_WEBHOOK_SECRET:'fixture',RESEND_API_KEY:'fixture',GCP_PROJECT_NUMBER:'123',GCP_WORKLOAD_IDENTITY_POOL_ID:'fixture',GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID:'fixture',GCP_SERVICE_ACCOUNT_EMAIL:'fixture@example.com' };
  const previous=Object.fromEntries(Object.keys(vars).map(k=>[k,process.env[k]]));Object.assign(process.env,vars);
  t.after(()=>{for(const [k,v]of Object.entries(previous))if(v===undefined)delete process.env[k];else process.env[k]=v;});
  t.mock.method(ExternalAccountClient,'fromJSON',()=>({getRequestHeaders:async()=>new Headers({authorization:'Bearer fixture'})}));
  let status='abierto';const calls=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    if(url.startsWith('https://sheets.googleapis.com/'))return Response.json({values:[['Estado lanzamiento',status],['Plazas asignadas','0']]});
    assert.equal(url,'https://api.stripe.com/v1/checkout/sessions'); calls.push(options.body);
    return Response.json({url:'https://checkout.stripe.com/c/pay/fixture'});
  });
  const invoke=async(price,language='en',accepted=true)=>{
    const res={setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;return this;}};
    await handler({method:'POST',headers:{origin:'https://www.aburtoprocoach.com'},body:{product:'starter-pack',email:'fixture@example.com',language,expectedPrice:price,acceptedConfidentiality:accepted}},res);return res;
  };
  assert.equal((await invoke(LAUNCH.foundingPrice)).code,200);
  assert.equal(calls[0].get('line_items[0][price]'),LAUNCH.foundingStripePrice);
  assert.equal(calls[0].get('locale'),'en');assert.equal(calls[0].get('metadata[language]'),'en');
  assert.equal(calls[0].get('metadata[founding_assignment]'),'manual_sheets');
  assert.equal((await invoke(LAUNCH.foundingPrice,'en',false)).code,400);
  assert.equal((await invoke(LAUNCH.foundingPrice,'fr')).code,400);
  status='cerrado'; assert.equal((await invoke(LAUNCH.foundingPrice)).code,409);
  assert.equal((await invoke(LAUNCH.regularPrice)).code,200);
  assert.equal(calls[1].get('line_items[0][price]'),LAUNCH.regularStripePrice);
  assert.equal(calls[1].get('metadata[offer]'),'regular');
  status='preparando';assert.equal((await invoke(LAUNCH.foundingPrice)).code,409);
  assert.equal(calls.length,2);
});
