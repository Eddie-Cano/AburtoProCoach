import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedRecoverySession,recoverPaidDelivery} from '../lib/paid-delivery-recovery.js';
import {sendPurchaseDeliveryEmail} from '../api/_email.js';

test('recovery rejects unauthenticated requests before reading or sending anything',async t=>{
  t.mock.method(globalThis,'fetch',()=>{throw Error('No network allowed');});
  const res={setHeader(){},status(s){this.code=s;return this;},json(d){this.data=d;}};
  await recoverPaidDelivery({method:'POST',headers:{}},res);
  assert.equal(res.code,404);
});

test('recovery only accepts the matching live, paid, unrefunded order',async t=>{
  let refunded=false,wrongProduct=false;
  t.mock.method(globalThis,'fetch',async url=>{
    if(url.includes('/payment_intents/'))return Response.json({livemode:true,status:'succeeded',amount_received:52600,currency:'mxn',latest_charge:{refunded,disputed:false,amount_refunded:0}});
    return Response.json({data:[{id:'cs_fixture_recovery',livemode:true,payment_status:'paid',payment_intent:'pi_3UQnm01f6JXFxDAP0Opce3Yd',amount_total:52600,currency:'mxn',customer_details:{email:'juanfdez.mx@gmail.com'},metadata:{project:'andres-aburto',product_slug:wrongProduct?'starter-pack':'romantizar-la-prep',language:'es'}}]});
  });
  assert.equal((await verifiedRecoverySession()).id,'cs_fixture_recovery');
  wrongProduct=true;await assert.rejects(verifiedRecoverySession(),/metadata/);
  wrongProduct=false;refunded=true;await assert.rejects(verifiedRecoverySession(),/refunded/);
});

test('the original branded purchase email includes the requested owner copy',async t=>{
  for(const [k,v] of Object.entries({RESEND_API_KEY:'fixture',PURCHASE_FROM_EMAIL:'Andres <compras@aburtoprocoach.com>'})){const old=process.env[k];process.env[k]=v;t.after(()=>{if(old===undefined)delete process.env[k];else process.env[k]=old;});}
  t.mock.method(globalThis,'fetch',async(url,options)=>{const b=JSON.parse(options.body);assert.deepEqual(b.to,['buyer@example.com']);assert.deepEqual(b.cc,['raiznoblemx@gmail.com']);assert.match(b.html,/Aburto/i);return Response.json({id:'fixture-mail'});});
  const r=await sendPurchaseDeliveryEmail({sale:{email:'buyer@example.com',name:'Buyer',productName:'Romantizar la Prep',productSlug:'romantizar-la-prep',checkoutSessionId:'cs_fixture'},delivery:{granted:true,library:true,fileUrl:'https://www.aburtoprocoach.com/biblioteca.html#acceso=fixture'},eventId:'fixture',cc:'raiznoblemx@gmail.com'});
  assert.equal(r.sent,true);
});

