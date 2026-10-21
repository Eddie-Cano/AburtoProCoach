// Temporary, expiring recovery for one previously paid order. Removed after delivery.
import {createHash, timingSafeEqual} from 'node:crypto';
import {processVerifiedStripeEvent, googleAccessToken} from '../api/stripe-webhook.js';
import {readAccesses, purchaseAccessId, updateAccess} from './library.js';

const TOKEN_HASH = 'cda32df53bb3ccc3362fbf29456bab4b4dbae6394846cc800abe39373579146d';
const EXPIRES_AT = 1792549931952;
const PAYMENT = 'pi_3UQnm01f6JXFxDAP0Opce3Yd';
const PRODUCT = 'romantizar-la-prep';
const COPY = 'raiznoblemx@gmail.com';
const hash = x => createHash('sha256').update(x).digest('hex');

async function stripe(path) {
  const r = await fetch('https://api.stripe.com/v1/'+path, {
    headers:{Authorization:'Bearer '+process.env.STRIPE_SECRET_KEY},
    signal:AbortSignal.timeout(12000),
  });
  if(!r.ok) throw Error('Stripe lookup failed: '+r.status);
  return r.json();
}

export async function verifiedRecoverySession() {
  const payment = await stripe('payment_intents/'+PAYMENT+'?expand[]=latest_charge');
  if(payment.livemode!==true || payment.status!=='succeeded' || payment.amount_received!==52600 || payment.currency!=='mxn') throw Error('Payment is not eligible');
  const charge=payment.latest_charge;
  if(!charge || typeof charge!=='object' || charge.refunded || charge.disputed || Number(charge.amount_refunded)>0) throw Error('Payment was refunded or disputed');
  const sessions=await stripe('checkout/sessions?payment_intent='+PAYMENT+'&limit=2');
  if(sessions.data?.length!==1) throw Error('Expected exactly one Checkout Session');
  const session=sessions.data[0];
  if(session.payment_status!=='paid' || session.livemode!==true || session.payment_intent!==PAYMENT || session.amount_total!==52600 || session.currency!=='mxn') throw Error('Checkout payment does not match');
  if(hash(String(session.customer_details?.email||'').toLowerCase())!==EXPECTED_EMAIL_HASH) throw Error('Buyer does not match');
  if(session.metadata?.project!=='andres-aburto' || session.metadata?.product_slug!==PRODUCT || (session.metadata?.language||'es')!=='es') throw Error('Checkout product metadata does not match');
  return session;
}

const EXPECTED_EMAIL_HASH = '9435ef5174a5445f5308da8e79775efccfd3857c8ae96c3f9d7620fbc8155df6';

export async function recoverPaidDelivery(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  if(!['GET','POST'].includes(req.method)) return res.status(405).json({error:'Method not allowed'});
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  const digest=Buffer.from(hash(token),'hex'), expected=Buffer.from(TOKEN_HASH,'hex');
  if(Date.now()>EXPIRES_AT || !timingSafeEqual(digest,expected)) return res.status(404).json({error:'Not found'});
  try {
    const session=await verifiedRecoverySession();
    if(req.method==='POST') {
      const result={code:200,data:null,setHeader(){},status(n){this.code=n;return this;},json(v){this.data=v;return this;}};
      // This is an operator recovery, not a fabricated Stripe webhook event.
      await processVerifiedStripeEvent({id:'operator-recovery:'+PAYMENT,type:'checkout.session.completed',data:{object:session}},req,result,false,{cc:COPY});
      if(result.code!==200) return res.status(result.code).json({error:result.data?.error||'Delivery pending'});
    }
    const googleToken=await googleAccessToken();
    const record=(await readAccesses(googleToken)).find(r=>r.id===purchaseAccessId(session.id));
    let providerEvent='not_sent';
    if(record?.mailId) {
      const r=await fetch('https://api.resend.com/emails/'+encodeURIComponent(record.mailId),{headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY},signal:AbortSignal.timeout(12000)});
      if(r.ok) {
        const mail=await r.json();providerEvent=mail.last_event||'sent';
        await updateAccess(googleToken,record,{deliveryState:providerEvent});
      } else providerEvent='provider_status_unavailable';
    }
    return res.status(200).json({paid:true,product:PRODUCT,registered:!!record,mailState:record?.mailState||'Pendiente',mailId:record?.mailId||null,providerEvent,lastVisit:record?.lastVisit||null,lastDownload:record?.lastDownload||null,copy:COPY});
  } catch(error) {
    console.error('Paid delivery recovery:',error.message);
    return res.status(503).json({error:error.message});
  }
}
