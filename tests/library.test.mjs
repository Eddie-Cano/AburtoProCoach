import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {Writable} from 'node:stream';
import {ExternalAccountClient} from 'google-auth-library';
import handler from '../api/library.js';
import {accessHash,libraryCookie,cookieAccessId,PRIVACY_VERSION,AGREEMENT_VERSION} from '../lib/library.js';

test('private library enforces personal access, consent, entitlement, revocation and streams large PDFs',async t=>{
 const vars={DASHBOARD_SESSION_SECRET:'library-test-secret',GCP_PROJECT_NUMBER:'123',GCP_WORKLOAD_IDENTITY_POOL_ID:'fixture',GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID:'fixture',GCP_SERVICE_ACCOUNT_EMAIL:'fixture@project.iam.gserviceaccount.com'};
 const previous=Object.fromEntries(Object.keys(vars).map(k=>[k,process.env[k]]));Object.assign(process.env,vars);t.after(()=>{for(const[k,v]of Object.entries(previous))v===undefined?delete process.env[k]:process.env[k]=v;});
 t.mock.method(ExternalAccountClient,'fromJSON',()=>({getRequestHeaders:async()=>new Headers({authorization:'Bearer fixture'})}));
 const token=randomBytes(32).toString('base64url'),id='a'.repeat(32),row=[id,new Date().toISOString(),'Fixture','fixture@icloud.com','5-habitos-dia-29','es','Prueba','Activo',accessHash(token),'Pendiente','','','','','','',new Date(Date.now()+86400000).toISOString()];
 let downloads=0,updates=0;
 t.mock.method(globalThis,'fetch',async(url,options={})=>{
  if(url.startsWith('https://sheets.googleapis.com/')){if(options.method==='POST'){updates++;return Response.json({});}return Response.json({values:[row]});}
  if(url.startsWith('https://www.googleapis.com/drive/')){downloads++;return new Response(new ReadableStream({start(controller){for(let i=0;i<6;i++)controller.enqueue(new Uint8Array(1024*1024));controller.close();}}),{headers:{'Content-Type':'application/pdf'}});}
  throw Error('Unexpected request');
 });
 async function run({auth=token,cookie='',method='GET',query={},body={}}={}){
  const res=new Writable({write(chunk,encoding,done){this.bytes=(this.bytes||0)+chunk.length;done();}});res.headers={};res.setHeader=(k,v)=>res.headers[k]=v;res.status=code=>{res.code=code;return res;};res.json=data=>{res.data=data;return res;};res.flushHeaders=()=>{res.headersSent=true;};
  await handler({method,query,body,headers:{authorization:auth?'Bearer '+auth:'',cookie,origin:'https://www.aburtoprocoach.com'}},res);return res;
 }
 assert.equal((await run({auth:''})).code,401);
 assert.equal((await run({auth:randomBytes(32).toString('base64url')})).code,401);
 assert.equal((await run()).data.ready,false);
 assert.equal((await run({query:{download:'5-habitos-dia-29'}})).code,403);
 assert.equal((await run({method:'POST',body:{privacy:true}})).code,400);
 const accepted=await run({method:'POST',body:{privacy:true,agreement:true,privacyVersion:PRIVACY_VERSION,agreementVersion:AGREEMENT_VERSION}});
 assert.equal(accepted.data.ready,true);assert.equal(updates,1);
 const cookie=accepted.headers['Set-Cookie'].split(';')[0];assert.equal(cookieAccessId({headers:{cookie}}),id);
 assert.equal((await run({cookie,query:{download:'romantizar-la-prep'}})).code,404);
 const file=await run({cookie,auth:'',query:{download:'5-habitos-dia-29'}});assert.equal(file.code,200);assert.equal(file.bytes,6*1024*1024);assert.equal(downloads,1);
 row[7]='Revocado';assert.equal((await run({cookie,query:{download:'5-habitos-dia-29'}})).code,401);row[7]='Activo';row[16]='2020-01-01';assert.equal((await run()).code,401);
 assert.equal(cookieAccessId({headers:{cookie:libraryCookie(id,Date.now()-7200000)}}),'');
 assert.equal(cookieAccessId({headers:{cookie:cookie.replace(id,'b'.repeat(32))}}),'');
});
