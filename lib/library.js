import {createHash, createHmac, timingSafeEqual} from 'node:crypto';
import {PACK_PRODUCTS} from './launch-config.js';
import {englishEdition} from './product-editions.js';
import {sheetRequest} from './reviews.js';

export const LIBRARY_TAB = 'Biblioteca privada';
export const PRIVACY_VERSION = '2026-10-06';
export const AGREEMENT_VERSION = '2026-10-01';
export const LIBRARY_HEADERS = ['ID','Fecha de emisión','Nombre','Correo','Producto','Idioma','Tipo','Estado','Hash del acceso','Estado del correo','ID del correo','Aceptación de condiciones','Versión privacidad','Versión confidencialidad','Último acceso','Última descarga iniciada','Vencimiento','Estado de entrega'];
const cookieName = '__Host-aburto_library';
const hash = value => createHash('sha256').update(value).digest('hex');
const sign = value => createHmac('sha256', process.env.DASHBOARD_SESSION_SECRET).update('library-v1:' + value).digest('hex');
const equal = (a,b) => {const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
export function libraryProducts(slug, language='es') {
  const canonical = slug === '5-claves-antes-de-competir' ? '5-claves' : slug === '5-habitos' ? '5-habitos-dia-29' : slug;
  if (!['es','en'].includes(language)) throw Error('Idioma inválido.');
  const products = canonical === 'starter-pack' ? PACK_PRODUCTS : PACK_PRODUCTS.filter(p=>p.slug===canonical);
  if (!products.length) throw Error('Producto inválido.');
  return products.map(p=>language==='en'?englishEdition(p.slug):p);
}
export function accessHash(token) {return typeof token==='string' && /^[A-Za-z0-9_-]{43}$/.test(token) ? hash(token) : '';}
export function libraryUrl(token, product='') {
  return 'https://www.aburtoprocoach.com/biblioteca.html#acceso='+token+(product?'&producto='+encodeURIComponent(product):'');
}
export async function readAccesses(googleToken) {
  const data = await sheetRequest(googleToken, '/values/'+encodeURIComponent("'Biblioteca privada'!A2:R10000"));
  return (data.values||[]).map((v,i)=>({id:v[0],createdAt:v[1],name:v[2]||'',email:v[3],product:v[4],language:v[5],kind:v[6],state:v[7],tokenHash:v[8],mailState:v[9],mailId:v[10],acceptedAt:v[11],privacyVersion:v[12],agreementVersion:v[13],lastVisit:v[14],lastDownload:v[15],expiresAt:v[16],deliveryState:v[17]||'Sin verificar',row:i+2})).filter(r=>r.id);
}
export function activeAccess(record, now=Date.now()) {return !!record && record.state==='Activo' && Date.parse(record.expiresAt)>now;}
export function findAccess(records, token) {const digest=accessHash(token);return digest?records.find(r=>equal(r.tokenHash||'',digest)):undefined;}
export async function updateAccess(googleToken, record, changes) {
  const columns={state:'H',tokenHash:'I',mailState:'J',mailId:'K',acceptedAt:'L',privacyVersion:'M',agreementVersion:'N',lastVisit:'O',lastDownload:'P',deliveryState:'R'};
  const data=Object.entries(changes).map(([key,value])=>({range:`'${LIBRARY_TAB}'!${columns[key]}${record.row}`,values:[[String(value)]]}));
  if(data.some(d=>d.range.includes('undefined'))) throw Error('Cambio inválido.');
  await sheetRequest(googleToken,'/values:batchUpdate','POST',{valueInputOption:'RAW',data});
}
export async function issueAccess({id,name='',email,product,language='es',kind='Prueba',googleToken,purchase=false}) {
  libraryProducts(product,language);
  email=String(email||'').trim().toLowerCase(); name=String(name||'').trim().slice(0,100);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!['Prueba','Cortesía','Compra'].includes(kind))throw Error('Revisa el correo y el tipo de entrega.');
  if(!/^[a-f0-9]{32}$/.test(id||''))throw Error('Identificador inválido.');
  const records=await readAccesses(googleToken), existing=records.find(r=>r.id===id);
  const token=createHmac('sha256',process.env.DASHBOARD_SESSION_SECRET).update('library-access:'+id).digest('base64url');
  if(existing){
    if(existing.email!==email||existing.product!==product||existing.language!==language)throw Error('La entrega ya existe con otros datos.');
    if(accessHash(token)===existing.tokenHash)return {record:existing,token};
    throw Error('Este envío ya está registrado. Usa Reenviar desde el panel.');
  }
  const now=new Date().toISOString(), expiresAt=new Date(Date.now()+(kind==='Compra'?3650:90)*86400000).toISOString();
  const values=[id,now,name,email,product,language,kind,'Activo',accessHash(token),'Pendiente','','','','','','',expiresAt];
  await sheetRequest(googleToken,'/values/'+encodeURIComponent("'Biblioteca privada'!A:Q")+':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS','POST',{values:[values]});
  const record=(await readAccesses(googleToken)).find(r=>r.id===id);
  if(!record)throw Error('No se pudo guardar la entrega.');
  return {record,token};
}
export function purchaseAccessId(sessionId){return hash('purchase:'+sessionId).slice(0,32);}
export function libraryCookie(id, now=Date.now()) {
  const value=id+'.'+(Math.floor(now/1000)+3600)+'.'+PRIVACY_VERSION+'.'+AGREEMENT_VERSION;
  return `${cookieName}=${value}.${sign(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`;
}
export function cookieAccessId(req, now=Date.now()) {
  const token=String(req.headers?.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if(!token)return '';
  const p=token.split('.');
  if(p.length!==5||!/^\d+$/.test(p[1])||!/^[a-f0-9]{32}$/.test(p[0])||!/^[a-f0-9]{64}$/.test(p[4])||p[2]!==PRIVACY_VERSION||p[3]!==AGREEMENT_VERSION||Number(p[1])<=now/1000||Number(p[1])>now/1000+3660)return '';
  return equal(sign(p.slice(0,4).join('.')),p[4])?p[0]:'';
}
