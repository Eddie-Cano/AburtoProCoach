import {createHmac,createHash,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';

const cookieName='__Host-aburto_dashboard';
const ttl=43200;
const normalizeEmail=value=>String(value||'').trim().toLowerCase();
const validEmail=email=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&email.length<=254;
const equal=(a,b)=>{
  const x=Buffer.from(String(a)),y=Buffer.from(String(b));
  return x.length===y.length&&timingSafeEqual(x,y);
};
const adminEmail=()=>normalizeEmail(process.env.DASHBOARD_ADMIN_EMAIL);
const coachEmail=()=>normalizeEmail(process.env.ANDRES_DASHBOARD_EMAIL);
const fingerprint=email=>createHash('sha256').update(email).digest('hex').slice(0,32);
export function dashboardConfigured(){
  const e=process.env,email=adminEmail(),coach=coachEmail();
  return Boolean(validEmail(email)&&validEmail(coach)&&email!==coach
    &&e.DASHBOARD_PASSWORD?.length>=12&&e.DASHBOARD_SESSION_SECRET?.length>=32);
}
export function dashboardCoachConfigured(){
  return dashboardConfigured()&&Boolean(process.env.ANDRES_DASHBOARD_PASSWORD?.length>=12);
}
export function checkDashboardCredentials(user,pass){
  if(!dashboardConfigured())return null;
  const email=normalizeEmail(user);
  const role=equal(email,adminEmail())?'admin':equal(email,coachEmail())&&dashboardCoachConfigured()?'coach':null;
  if(!role)return null;
  const secret=role==='coach'?process.env.ANDRES_DASHBOARD_PASSWORD:process.env.DASHBOARD_PASSWORD;
  const a=scryptSync(secret,'aburto-dashboard-'+role,64);
  const b=scryptSync(String(pass||''),'aburto-dashboard-'+role,64);
  return timingSafeEqual(a,b)?{role,user:email}:null;
}
const sign=s=>createHmac('sha256',process.env.DASHBOARD_SESSION_SECRET).update(s).digest('hex');
export function dashboardCookie(role='admin'){
  if(!dashboardConfigured()||!['admin','coach'].includes(role))throw Error('Rol inválido');
  if(role==='coach'&&!dashboardCoachConfigured())throw Error('Rol no configurado');
  const user=role==='admin'?adminEmail():coachEmail();
  const val=['v3',role,fingerprint(user),Math.floor(Date.now()/1000)+ttl,randomBytes(20).toString('hex')].join('.');
  return cookieName+'='+val+'.'+sign(val)+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+ttl;
}
export function dashboardClearCookie(){return cookieName+'=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';}
export function dashboardSession(req){
  if(!dashboardConfigured())return null;
  const token=String(req.headers?.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if(!token)return null;
  const p=token.split('.');
  if(p.length!==6||p[0]!=='v3'||!['admin','coach'].includes(p[1])||!/^[a-f0-9]{32}$/.test(p[2])||!/^[0-9]{10}$/.test(p[3])||!/^[a-f0-9]{40}$/.test(p[4])||!/^[a-f0-9]{64}$/.test(p[5]))return null;
  const user=p[1]==='coach'?coachEmail():adminEmail();
  if(p[1]==='coach'&&!dashboardCoachConfigured())return null;
  const now=Date.now()/1000,exp=Number(p[3]);
  if(!equal(p[2],fingerprint(user))||exp<=now||exp>now+ttl+60||!equal(sign(p.slice(0,5).join('.')),p[5]))return null;
  return {role:p[1],user};
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
