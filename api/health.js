import { googleAccessToken } from './stripe-webhook.js';
import { getManualOffer } from '../lib/manual-offer.js';
import { CRM_SHEET_ID } from '../lib/crm.js';
import {dashboardConfigured,checkDashboardCredentials,dashboardCookie,dashboardClearCookie,isDashboardAuthenticated,sameOrigin,requireDashboard} from '../lib/dashboard-auth.js';

export default async function handler(req, res) {
  if (req.query?.dashboard === 'auth') return handleDashboardAuth(req,res);
  if (req.query?.dashboard === 'stats') return handleDashboardStats(req,res);
  if (req.query?.dashboard === 'traffic') return handleDashboardTraffic(req,res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false });

  const verifiedSenderConfigured = Boolean(process.env.PURCHASE_FROM_EMAIL || process.env.LEAD_FROM_EMAIL);
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
  const buyerEmailConfigured = Boolean(process.env.RESEND_API_KEY && verifiedSenderConfigured);
  const driveDeliveryConfigured = Boolean(
    process.env.GCP_PROJECT_NUMBER && process.env.GCP_WORKLOAD_IDENTITY_POOL_ID &&
    process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID &&
    (process.env.GCP_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL)
  );
  let offer = null;
  let offerReadable = false;
  if (stripeConfigured && buyerEmailConfigured && driveDeliveryConfigured) {
    try {
      offer = await getManualOffer(await googleAccessToken());
      offerReadable = true;
    } catch (error) {
      console.error('Health check could not read manual launch state:', error?.message);
    }
  }
  return res.status(200).json({
    ok: true,
    provider: String(process.env.WHATSAPP_PROVIDER || '').toLowerCase(),
    metaConfigured: Boolean(process.env.META_WHATSAPP_TOKEN && process.env.META_PHONE_NUMBER_ID),
    recipientConfigured: Boolean(process.env.ANDRES_NOTIFICATION_PHONE),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    redisConfigured: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    redisRequiredForDigitalCheckout: false,
    crmWebhookConfigured: Boolean(process.env.GOOGLE_SHEETS_WEBHOOK_URL),
    stripeWebhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    stripeCheckoutConfigured: stripeConfigured,
    emailProvider: 'resend',
    emailApiConfigured: Boolean(process.env.RESEND_API_KEY),
    verifiedSenderConfigured,
    buyerEmailConfigured,
    emailReplyConfigured: Boolean(process.env.PURCHASE_REPLY_TO_EMAIL || process.env.REPLY_TO_EMAIL),
    driveDeliveryConfigured,
    foundingCapacity: 100,
    foundingControl: 'manual_google_sheets',
    foundingDurationHours: null,
    foundingStartConfigured: false,
    manualOfferReadable: offerReadable,
    manualOfferStatus: offer?.manualStatus || 'unavailable',
    packCheckoutConfigured: stripeConfigured && buyerEmailConfigured && driveDeliveryConfigured && offerReadable,
    packCheckoutReady: offer?.checkoutReady === true,
    timestamp: new Date().toISOString(),
  });
}

async function handleDashboardAuth(req,res) {
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

const ranges={
  sales:"'Ventas'!A1:AH2500",
  founders:"'Founding Members'!A1:R2500",
  leads:"'Contactos'!A1:X2500",
  waitlist:"'Lista de espera — Telegram'!A1:L2500",
  settings:"'Configuración lanzamiento'!A1:C15"
};
// Una sola solicitud agrupada reduce el consumo de cuota de Google Sheets.
async function readDashboardSheets(token) {
  const query = new URLSearchParams();
  for (const range of Object.values(ranges)) query.append('ranges', range);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CRM_SHEET_ID}/values:batchGet?${query}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(12000),
    });
    if (response.ok) {
      const data = await response.json();
      const result = data.valueRanges || [];
      if (result.length !== Object.keys(ranges).length) throw new Error('Respuesta incompleta de Google Sheets');
      return result.map(item => item.values || []);
    }
    if (![429, 500, 502, 503].includes(response.status) || attempt === 3)
      throw new Error(`Google Sheets error ${response.status}`);
    const delay = [700, 1800, 3800][attempt];
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
const cell=(row,i)=>String(row?.[i]??'').trim();
const isoDate=x=>{const d=new Date(x);return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);};
function grouped(rows,index){const result=new Map();for(const r of rows){const key=cell(r,index)||'Sin identificar';result.set(key,(result.get(key)||0)+1);}return [...result].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,count])=>({name,count}));}

async function handleDashboardStats(req,res){
  if(req.method!=='GET') return res.status(405).json({error:'Método no permitido.'});
  if(!requireDashboard(req,res)) return;
  try{
    const token=await googleAccessToken();
    if(!token) return res.status(503).json({error:'Sin acceso a Google Sheets.'});
    const [allSales,allFounders,allLeads,allWaitlist,allSettings]=await readDashboardSheets(token);
    const paid=allSales.slice(1).filter(r=>
      cell(r,3).startsWith('cs_') &&
      !cell(r,6).startsWith('[SANDBOX]') &&
      ['paid','no_payment_required'].includes(cell(r,13).toLowerCase()) &&
      !['reembolsado','en disputa'].includes(cell(r,13).toLowerCase())
    );
    const refunded=allSales.slice(1).filter(r=>['reembolsado','en disputa'].includes(cell(r,13).toLowerCase()));
    const leads=allLeads.slice(1).filter(r=>cell(r,0) && !cell(r,0).startsWith('EJEMPLO-'));
    const waitlist=allWaitlist.slice(1).filter(r=>cell(r,0) && !cell(r,0).startsWith('EJEMPLO-'));
    const members=allFounders.slice(1).filter(r=>cell(r,2).startsWith('cs_'));
    const foundingPaid=paid.filter(r=>cell(r,18).toLowerCase()==='founding');
    const assigned=members.filter(r=>/^\d+$/.test(cell(r,0))&&cell(r,7).toLowerCase()==='activo');
    const pendingDelivery=paid.filter(r=>!['Drive + correo enviados','Entregado','Completado'].includes(cell(r,27)) && cell(r,5)==='digital');
    const byDay=new Map();
    for(const r of paid){const key=isoDate(cell(r,1));if(!key)continue;const v=byDay.get(key)||{date:key,sales:0,revenue:0};v.sales++;v.revenue+=Number(cell(r,11))||0;byDay.set(key,v);}
    const settings=new Map(allSettings.slice(1).map(r=>[cell(r,0).toLowerCase(),cell(r,1)]));
    const report={
      asOf:new Date().toISOString(),
      metrics:{
        sales:paid.length,
        revenueMxn:paid.reduce((n,r)=>n+(Number(cell(r,11))||0),0),
        foundingPurchases:foundingPaid.length,
        foundingAssigned:assigned.length,
        foundingCapacity:100,
        pendingDelivery:pendingDelivery.length,
        leads:leads.length,
        communityWaitlist:waitlist.length,
        refundsOrDisputes:refunded.length
      },
      offer:{status:settings.get('estado lanzamiento')||'Sin configurar',assignedCount:Number(settings.get('plazas asignadas'))||0},
      recentSales:paid.slice().sort((a,b)=>cell(b,1).localeCompare(cell(a,1))).slice(0,15).map(r=>({
        at:cell(r,1),product:cell(r,6),name:cell(r,8),email:cell(r,9),amountMxn:Number(cell(r,11))||0,delivery:cell(r,27),source:cell(r,30),campaign:cell(r,31),offer:cell(r,18)
      })),
      charts:{daily:[...byDay.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-30),
        products:grouped(paid,6),sources:grouped(paid,30),campaigns:grouped(paid,31)},
      analytics:{trafficConfigured:false,message:'Para medir visitantes, países, ciudades y redes sociales se debe conectar Google Analytics 4 o Vercel Analytics. No hay medición histórica instalada en este panel.'}
    };
    return res.status(200).json(report);
  }catch(error){
    console.error('dashboard stats:',error?.message);
    return res.status(503).json({error:'No pudimos cargar los datos. Intenta nuevamente.'});
  }
}


/* Dashboard-only proxy for aggregated Web Analytics: private token never reaches the browser. */
const ANALYTICS_PROJECT_ID = 'prj_kNMgCXsFfCKXtQrfH71zc3N3yqUW';
const ANALYTICS_TEAM_ID = 'team_eCJ1Cx04udAnpF218fCP4z5B';
let cachedTraffic = null;
let cachedTrafficUntil = 0;

async function queryWebAnalytics(token,endpoint,parameters={}) {
  const query = new URLSearchParams({
    projectId:ANALYTICS_PROJECT_ID,
    teamId:ANALYTICS_TEAM_ID,
    ...parameters
  });
  const response=await fetch(
    'https://api.vercel.com/v1/query/web-analytics/visits/'+endpoint+'?'+query.toString(),
    {headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(8000)}
  );
  if (!response.ok) throw new Error('Vercel Analytics HTTP '+response.status);
  return (await response.json()).data;
}
const trafficRows=(rows,dimension)=>Array.isArray(rows)?rows.slice(0,10).map(row=>({
  name:String(row[dimension]||'Sin identificar'),
  visitors:Number(row.visitors)||0,
  pageviews:Number(row.pageviews)||0
})):[];
async function handleDashboardTraffic(req,res) {
  if(req.method!=='GET')return res.status(405).json({error:'Método no permitido.'});
  if(!requireDashboard(req,res))return;
  const token=String(process.env.VERCEL_ANALYTICS_TOKEN||'').trim();
  if(!token)return res.status(200).json({
    configured:false,
    message:'Activa Web Analytics en Vercel y configura VERCEL_ANALYTICS_TOKEN en Production.'
  });
  if(cachedTraffic && Date.now()<cachedTrafficUntil)return res.status(200).json(cachedTraffic);
  try {
    const since=new Date(Date.now()-29*86400000).toISOString().slice(0,10);
    const until=new Date().toISOString().slice(0,10);
    const range={since,until};
    const reports=await Promise.allSettled([
      queryWebAnalytics(token,'count'),
      queryWebAnalytics(token,'aggregate',{...range,by:'day',limit:'35'}),
      queryWebAnalytics(token,'aggregate',{...range,by:'country',limit:'8'}),
      queryWebAnalytics(token,'aggregate',{...range,by:'referrerHostname',limit:'8'}),
      queryWebAnalytics(token,'aggregate',{...range,by:'requestPath',limit:'8'}),
      queryWebAnalytics(token,'aggregate',{...range,by:'deviceType',limit:'5'})
    ]);
    const success=index=>reports[index].status==='fulfilled'?reports[index].value:null;
    const errors=reports.filter(p=>p.status==='rejected').map(p=>String(p.reason?.message||'')).slice(0,2);
    const total=success(0);
    if(!total && !success(1)&&!success(2))
      return res.status(200).json({configured:true,available:false,message:errors[0]||'Analytics no está disponible todavía.'});
    const days=Array.isArray(success(1))?success(1).map(row=>({
      date:String(row.timestamp||'').slice(0,10),
      visitors:Number(row.visitors)||0,
      pageviews:Number(row.pageviews)||0
    })).filter(row=>row.date):[];
    const payload={
      configured:true,available:true,
      period:{since,until,dayCount:30},
      totals:total?{visitors:Number(total.visitors)||0,pageviews:Number(total.pageviews)||0}:null,
      days,
      countries:trafficRows(success(2),'country'),
      referrers:trafficRows(success(3),'referrerHostname'),
      pages:trafficRows(success(4),'requestPath'),
      devices:trafficRows(success(5),'deviceType'),
      partial:errors.length>0,
      updatedAt:new Date().toISOString()
    };
    cachedTraffic=payload;
    cachedTrafficUntil=Date.now()+120000;
    return res.status(200).json(payload);
  }catch(error) {
    console.error('Web Analytics read unavailable:',error?.message);
    return res.status(200).json({configured:true,available:false,message:'No fue posible consultar Web Analytics.'});
  }
}
