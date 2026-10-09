import {createHmac,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';

const cookieName='__Host-aburto_dashboard';
const username='AburtoPC';
const coachUsername='AndresAburto';
const ttl=43200;
const equal=(a,b)=>{
  const x=Buffer.from(String(a)),y=Buffer.from(String(b));
  return x.length===y.length&&timingSafeEqual(x,y);
};
export function dashboardConfigured(){
  const e=process.env;
  return Boolean(e.DASHBOARD_PASSWORD && e.DASHBOARD_SESSION_SECRET && e.DASHBOARD_PASSWORD.length>=12 && e.DASHBOARD_SESSION_SECRET.length>=32);
}
export function dashboardCoachConfigured(){
  return dashboardConfigured() && Boolean(process.env.ANDRES_DASHBOARD_PASSWORD?.length>=16);
}
export function checkDashboardCredentials(user,pass){
  if(!dashboardConfigured())return null;
  const role=equal(user,username)?'admin':equal(user,coachUsername)&&dashboardCoachConfigured()?'coach':null;
  if(!role)return null;
  const secret=role==='coach'?process.env.ANDRES_DASHBOARD_PASSWORD:process.env.DASHBOARD_PASSWORD;
  const a=scryptSync(secret,'aburto-dashboard-'+role,64);
  const b=scryptSync(String(pass||''),'aburto-dashboard-'+role,64);
  return timingSafeEqual(a,b)?{role,user:role==='coach'?coachUsername:username}:null;
}
const sign=s=>createHmac('sha256',process.env.DASHBOARD_SESSION_SECRET).update(s).digest('hex');
export function dashboardCookie(role='admin'){
  if(!['admin','coach'].includes(role))throw Error('Rol inválido');
  const val=['v2',role,Math.floor(Date.now()/1000)+ttl,randomBytes(20).toString('hex')].join('.');
  return cookieName+'='+val+'.'+sign(val)+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+ttl;
}
export function dashboardClearCookie(){return cookieName+'=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';}
export function dashboardSession(req){
  if(!dashboardConfigured())return null;
  const token=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if(!token)return null;
  const parts=token.split('.');
  if(parts.length!==5||parts[0]!=='v2'||!['admin','coach'].includes(parts[1])||!/^[0-9]{10}$/.test(parts[2])||!/^[a-f0-9]{40}$/.test(parts[3])||!/^[a-f0-9]{64}$/.test(parts[4]))return null;
  const exp=Number(parts[2]),now=Date.now()/1000;
  if(exp<=now||exp>now+ttl+60||!equal(sign(parts.slice(0,4).join('.')),parts[4]))return null;
  if(parts[1]==='coach'&&!dashboardCoachConfigured())return null;
  return {role:parts[1],user:parts[1]==='coach'?coachUsername:username};
}
export function isDashboardAuthenticated(req){return Boolean(dashboardSession(req));}
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
