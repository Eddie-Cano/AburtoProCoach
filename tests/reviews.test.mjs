import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReview, reviewTicket, verifyReviewTicket, readReviews, publicReview, sheetRequest} from '../lib/reviews.js';
import handler from '../api/reviews.js';

test('accepts reviews without contact details and rejects unavailable products, invalid ratings, missing consent and long content',()=>{
  const body={target:'5-habitos',name:'Edgar',comment:'Me ayudó a organizar mis hábitos.',rating:4,consent:true};
  assert.deepEqual(validateReview(body),{target:'5-habitos',name:'Edgar',comment:body.comment,rating:4});
  for(const change of [{target:'posing'},{target:'__proto__'},{name:'A'},{rating:0},{rating:6},{rating:4.5},{consent:false},{comment:'Corta'},{comment:'x'.repeat(2001)}])assert.throws(()=>validateReview({...body,...change}));
});
test('tickets cannot be modified, submitted instantly or reused after expiry',t=>{
  const before=process.env.DASHBOARD_SESSION_SECRET;process.env.DASHBOARD_SESSION_SECRET='test-session-secret-abcdefghijklmnopqrstuvwxyz';
  t.after(()=>{if(before===undefined)delete process.env.DASHBOARD_SESSION_SECRET;else process.env.DASHBOARD_SESSION_SECRET=before});
  const now=Date.now(), ticket=reviewTicket(now);
  assert.equal(verifyReviewTicket(ticket,now),false);
  assert.equal(verifyReviewTicket(ticket,now+2000),true);
  assert.equal(verifyReviewTicket(ticket,now+3600001),false);
  assert.equal(verifyReviewTicket(ticket.slice(0,-1)+(ticket.endsWith('0')?'1':'0'),now+2000),false);
});
test('reads persistent reviews, hides internal sheet details and writes literal values safely',async t=>{
  const before=globalThis.fetch;t.after(()=>{globalThis.fetch=before});
  const calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({values:[['id','2026-10-05','Producto digital','5-claves','=Nombre',5,'<script>Experiencia</script>','Publicada','Sitio de Andrés'],['bad','date','Producto','unknown','Test',5,'Bad','Publicada']]}),{status:200})};
  const reviews=await readReviews('test-token');assert.equal(reviews.length,1);assert.equal(reviews[0].row,2);
  const review=publicReview(reviews[0]);assert.equal('row' in review,false);assert.equal('status' in review,false);
  await sheetRequest('test-token','/values/test:append?valueInputOption=RAW','POST',{values:[['=Nombre','<script>Experiencia</script>']]});
  assert.match(calls[1].url,/valueInputOption=RAW/);assert.equal(JSON.parse(calls[1].options.body).values[0][0],'=Nombre');
});
test('moderation is authenticated and cross-origin submissions are rejected before storage access',async()=>{
  function res(){return{code:200,setHeader(){},status(n){this.code=n;return this},json(body){this.body=body;return this}}}
  for(const req of [{method:'GET',headers:{},query:{admin:'1'}},{method:'PATCH',headers:{},query:{}}]){const r=res();await handler(req,r);assert.equal(r.code,401);}
  const r=res();await handler({method:'POST',headers:{origin:'https://other.example'},query:{}},r);assert.equal(r.code,403);
});
