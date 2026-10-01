import {createHmac,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';

const cookieName='__Host-aburto_dashboard';
const username='AburtoPC';
const ttl=43200;
const equal=(a,b)=>{
  const x=Buffer.from(String(a)),y=Buffer.from(String(b));
  return x.length===y.length&&timingSafeEqual(x,y);
};
export function dashboardConfigured(){
  const e=process.env;
  return Boolean(e.DASHBOARD_PASSWORD && e.DASHBOARD_SESSION_SECRET && e.DASHBOARD_PASSWORD.length>=12 && e.DASHBOARD_SESSION_SECRET.length>=32);
}
export function checkDashboardCredentials(user,pass){
  if(!dashboardConfigured())return false;
  const a=scryptSync(process.env.DASHBOARD_PASSWORD,'aburto-v1',64);
  const b=scryptSync(String(pass||''),'aburto-v1',64);
  return equal(user,username)&&timingSafeEqual(a,b);
}
const sign=s=>createHmac('sha256',process.env.DASHBOARD_SESSION_SECRET).update(s).digest('hex');
export function dashboardCookie(){
  const val=['v1',Math.floor(Date.now()/1000)+ttl,randomBytes(20).toString('hex')].join('.');
  return cookieName+'='+val+'.'+sign(val)+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+ttl;
}
export function dashboardClearCookie(){return cookieName+'=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';}
export function isDashboardAuthenticated(req){
  if(!dashboardConfigured())return false;
  const token=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if(!token)return false;
  const parts=token.split('.');
  if(parts.length!==4||parts[0]!=='v1'||!/^\d{10}$/.test(parts[1])||!/^[a-f0-9]{40}$/.test(parts[2])||!/^[a-f0-9]{64}$/.test(parts[3]))return false;
  const exp=Number(parts[1]),now=Date.now()/1000;
  return exp>now && exp<now+ttl+60 && equal(sign(parts.slice(0,3).join('.')),parts[3]);
}
export function requireDashboard(req,res){
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(!isDashboardAuthenticated(req)){
    res.status(401).json({error:'Inicia sesión.'});return false;
  }
  return true;
}
export function sameOrigin(req){
  const origin=String(req.headers.origin||'');
  return ['https://www.aburtoprocoach.com','https://aburtoprocoach.com',...(process.env.VERCEL_URL?['https://'+process.env.VERCEL_URL]:[])].includes(origin);
}
