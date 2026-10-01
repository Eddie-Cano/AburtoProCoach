import {requireDashboard} from '../../lib/dashboard-auth.js';
import {googleAccessToken} from '../stripe-webhook.js';
import {CRM_SHEET_ID} from '../../lib/crm.js';

const ranges={
  sales:"'Ventas'!A1:AH2500",
  founders:"'Founding Members'!A1:R2500",
  leads:"'Contactos'!A1:X2500",
  waitlist:"'Lista de espera — Telegram'!A1:L2500",
  settings:"'Configuración lanzamiento'!A1:C15"
};
async function readSheet(token,range){
  const url=`https://sheets.googleapis.com/v4/spreadsheets/${CRM_SHEET_ID}/values/${encodeURIComponent(range)}`;
  const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(12000)});
  if(!response.ok) throw Error(`Google Sheets error ${response.status}`);
  const json=await response.json();
  return json.values||[];
}
const cell=(row,i)=>String(row?.[i]??'').trim();
const isoDate=x=>{const d=new Date(x);return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);};
function grouped(rows,index){const result=new Map();for(const r of rows){const key=cell(r,index)||'Sin identificar';result.set(key,(result.get(key)||0)+1);}return [...result].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,count])=>({name,count}));}

export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({error:'Método no permitido.'});
  if(!requireDashboard(req,res)) return;
  try{
    const token=await googleAccessToken();
    if(!token) return res.status(503).json({error:'Sin acceso a Google Sheets.'});
    const [allSales,allFounders,allLeads,allWaitlist,allSettings]=await Promise.all(Object.values(ranges).map(r=>readSheet(token,r)));
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
