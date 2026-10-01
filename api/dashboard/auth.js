import {dashboardConfigured,checkDashboardCredentials,dashboardCookie,dashboardClearCookie,isDashboardAuthenticated,sameOrigin} from '../../lib/dashboard-auth.js';

export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method==='GET') return res.status(200).json({configured:dashboardConfigured(),authenticated:isDashboardAuthenticated(req),user:isDashboardAuthenticated(req)?'AburtoPC':null});
  if(req.method!=='POST') return res.status(405).json({error:'Método no permitido.'});
  if(!sameOrigin(req)) return res.status(403).json({error:'Origen no permitido.'});
  if(!dashboardConfigured()) return res.status(503).json({error:'El acceso privado está pendiente de configuración segura.'});
  const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
  if(body.action==='logout'){
    res.setHeader('Set-Cookie',dashboardClearCookie());
    return res.status(200).json({ok:true});
  }
  if(body.action!=='login') return res.status(400).json({error:'Acción desconocida.'});
  if(String(body.username||'').length>80 || String(body.password||'').length>256)
    return res.status(400).json({error:'Credenciales no válidas.'});
  if(!checkDashboardCredentials(body.username,body.password))
    return res.status(401).json({error:'Usuario o contraseña incorrectos.'});
  res.setHeader('Set-Cookie',dashboardCookie());
  return res.status(200).json({ok:true,user:'AburtoPC'});
}
