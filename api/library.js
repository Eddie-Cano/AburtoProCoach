import {createHmac} from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {googleAccessToken} from './stripe-webhook.js';
import {requireDashboard,sameOrigin} from '../lib/dashboard-auth.js';
import {sendTransactionalEmail} from './_email.js';
import {buildLibraryEmail} from '../lib/library-email.js';
import {readAccesses,findAccess,activeAccess,libraryProducts,issueAccess,updateAccess,libraryCookie,cookieAccessId,accessHash,PRIVACY_VERSION,AGREEMENT_VERSION} from '../lib/library.js';

export const config={maxDuration:300};
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Método no permitido.'});
  const admin=req.query?.admin==='1';
  if(admin&&!requireDashboard(req,res))return;
  if(req.method==='POST'&&!sameOrigin(req))return res.status(403).json({error:'Origen no permitido.'});
  try{
    const googleToken=await googleAccessToken();
    let body={};
    if(req.method==='POST'){
      if(typeof req.body==='string'&&req.body.length>4000)return res.status(413).json({error:'Solicitud demasiado grande.'});
      try{body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};}catch{return res.status(400).json({error:'Solicitud inválida.'});}
    }
    if(!body||typeof body!=='object'||Array.isArray(body))return res.status(400).json({error:'Solicitud inválida.'});
    if(admin){
      const records=await readAccesses(googleToken);
      if(req.method==='GET')return res.status(200).json({accesses:records.slice(-100).reverse().map(({tokenHash,row,...r})=>r)});
      if(body.action==='revoke'){
        const record=records.find(r=>r.id===body.id);
        if(!record)return res.status(404).json({error:'Entrega no encontrada.'});
        await updateAccess(googleToken,record,{state:'Revocado'});
        return res.status(200).json({ok:true});
      }
      let access;
      if(body.action==='issue'){
        if(!['Prueba','Cortesía'].includes(body.kind))return res.status(400).json({error:'Tipo de entrega inválido.'});
        access=await issueAccess({...body,googleToken});
      }else if(body.action==='resend'){
        const record=records.find(r=>r.id===body.id);
        if(!activeAccess(record))return res.status(404).json({error:'Entrega no activa.'});
        const token=createHmac('sha256',process.env.DASHBOARD_SESSION_SECRET).update('library-access:'+record.id).digest('base64url');
        await updateAccess(googleToken,record,{tokenHash:accessHash(token),mailState:'Pendiente'});
        access={record,token};
      }else return res.status(400).json({error:'Acción inválida.'});
      const {record,token}=access;
      if(record.mailState==='Enviado'&&body.action==='issue')return res.status(200).json({ok:true,id:record.id,sent:true,duplicate:true});
      try{
        const result=await sendTransactionalEmail({to:record.email,cc:'raiznoblemx@gmail.com',...buildLibraryEmail(record,token),idempotencyKey:'aburto/library/'+record.id+'/'+accessHash(token).slice(0,16)+(body.action==='resend'?'/'+new Date().toISOString().slice(0,13):''),tags:[{name:'category',value:'library_delivery'}]});
        if(!result.sent)throw Error('Correo no configurado.');
        await updateAccess(googleToken,record,{mailState:'Enviado',mailId:result.id});
        return res.status(201).json({ok:true,id:record.id,sent:true});
      }catch(error){
        await updateAccess(googleToken,record,{mailState:'Pendiente: proveedor de correo'});
        return res.status(503).json({error:'El acceso quedó registrado, pero el correo sigue pendiente. Usa Reenviar.',id:record.id});
      }
    }
    const records=await readAccesses(googleToken);
    const bearer=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
    const cookieId=cookieAccessId(req);
    const record=bearer?findAccess(records,bearer):records.find(r=>r.id===cookieId);
    if(!activeAccess(record))return res.status(401).json({error:'Tu enlace no es válido, venció o fue revocado. Solicita un nuevo acceso al equipo.'});
    if(req.method==='POST'&&body.action==='send'){
      if(!bearer)return res.status(403).json({error:'Abre tu enlace personal.'});
      if(record.mailState==='Enviado')return res.status(200).json({sent:true,duplicate:true});
      const result=await sendTransactionalEmail({to:record.email,cc:'raiznoblemx@gmail.com',...buildLibraryEmail(record,bearer),idempotencyKey:'aburto/library/'+record.id+'/'+accessHash(bearer).slice(0,16),tags:[{name:'category',value:'library_delivery'}]});
      if(!result.sent)return res.status(503).json({error:'Correo pendiente.'});
      await updateAccess(googleToken,record,{mailState:'Enviado',mailId:result.id});
      return res.status(200).json({sent:true});
    }
    if(req.method==='GET'&&req.query?.delivery==='1'){
      if(!bearer)return res.status(403).json({error:'Abre tu enlace personal.'});
      let status=record.mailState;
      if(record.mailId&&process.env.RESEND_API_KEY){
        const response=await fetch('https://api.resend.com/emails/'+encodeURIComponent(record.mailId),{headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY},signal:AbortSignal.timeout(10000)});
        if(response.ok){const result=await response.json();status=result.last_event||status;}
      }
      return res.status(200).json({status});
    }
    const products=libraryProducts(record.product,record.language);
    if(req.query?.download){
      if(req.method!=='GET'||cookieId!==record.id)return res.status(403).json({error:'Primero acepta las condiciones en tu biblioteca.'});
      const product=products.find(p=>p.slug===req.query.download);
      if(!product)return res.status(404).json({error:'Este producto no pertenece a tu acceso.'});
      const range=String(req.headers.range||'');
      if(range&&!/^bytes=\d+-\d*$/.test(range))return res.status(416).end();
      const upstream=await fetch(`https://www.googleapis.com/drive/v3/files/${product.fileId}?alt=media&supportsAllDrives=true`,{headers:{Authorization:'Bearer '+googleToken,...(range?{Range:range}:{})},signal:AbortSignal.timeout(240000)});
      if(!upstream.ok||!upstream.body)return res.status(upstream.status===416?416:503).json({error:'No pudimos abrir el archivo. Intenta de nuevo.'});
      await updateAccess(googleToken,record,{lastDownload:new Date().toISOString()});
      res.status(upstream.status===206?206:200);
      res.setHeader('Content-Type','application/pdf');
      res.setHeader('Content-Disposition',`attachment; filename="${product.slug}-${record.language}.pdf"`);
      res.setHeader('Accept-Ranges','bytes');
      if(upstream.headers.get('content-range'))res.setHeader('Content-Range',upstream.headers.get('content-range'));
      // Flushing headers and piping chunks avoids Vercel's buffered-response size cap.
      res.flushHeaders();
      await pipeline(Readable.fromWeb(upstream.body),res);
      return;
    }
    if(req.method==='POST'){
      if(body.privacy!==true||body.agreement!==true||body.privacyVersion!==PRIVACY_VERSION||body.agreementVersion!==AGREEMENT_VERSION)return res.status(400).json({error:'Lee y acepta ambos documentos para continuar.'});
      const now=new Date().toISOString();
      await updateAccess(googleToken,record,{acceptedAt:now,privacyVersion:PRIVACY_VERSION,agreementVersion:AGREEMENT_VERSION,lastVisit:now});
      res.setHeader('Set-Cookie',libraryCookie(record.id));
    }
    return res.status(200).json({name:record.name,email:record.email,kind:record.kind,language:record.language,expiresAt:record.expiresAt,ready:req.method==='POST'||cookieId===record.id,privacyVersion:PRIVACY_VERSION,agreementVersion:AGREEMENT_VERSION,products:products.map(p=>({slug:p.slug,name:p.name,download:'/api/library?download='+encodeURIComponent(p.slug)}))});
  }catch(error){
    console.error('private library:',error.code||error.message);
    if(res.headersSent){res.destroy();return;}
    return res.status(503).json({error:'No pudimos conectar con tu biblioteca. Intenta de nuevo en unos minutos.'});
  }
}
