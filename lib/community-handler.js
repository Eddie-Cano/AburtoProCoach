import {randomInt,randomBytes,randomUUID,createHmac,timingSafeEqual} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {sendTransactionalEmail} from '../api/_email.js';

const COOKIE='__Host-aburto_team';
const MAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nowISO=()=>new Date().toISOString();
const emailOf=x=>String(x||'').trim().toLowerCase().slice(0,254);
const hex=(...parts)=>createHmac('sha256',process.env.COMMUNITY_TOKEN_PEPPER).update(parts.join(':')).digest('hex');
const sameHash=(a,b)=>{const x=Buffer.from(a,'hex'),y=Buffer.from(b,'hex');return x.length===y.length&&timingSafeEqual(x,y);};
const asNumber=(value,min,max,fallback)=>{const n=Number(value);return Number.isInteger(n)&&n>=min&&n<=max?n:fallback;};
const error=(res,code,message)=>res.status(code).json({ok:false,error:message});
const safeMember=m=>({id:m.id,email:m.email,name:m.display_name,bio:m.bio,role:m.role,founding:m.founding,joinedAt:m.joined_at});
const clientIP=req=>String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim().slice(0,100);
const cookie=(token,age)=>`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
const privateAction=new Set(['profile','message','delete','pin','room','invite','members','member_update']);
function getBody(req) {
 if(typeof req.body==='string')return JSON.parse(req.body);
 return req.body??{};
}
function safeUrl(path){return typeof path==='string'&&path.startsWith('/')&&!path.startsWith('//');}
async function memberFromSession(sql,req){
 const token=String(req.headers.cookie||'').match(/(?:^|;\s*)__Host-aburto_team=([a-f0-9]{64})(?:;|$)/)?.[1];
 if(!token)return null;
 const hash=hex('session',token);
 const rows=await sql`SELECT m.id,m.email,m.display_name,m.bio,m.role,m.founding,m.status,m.joined_at
  FROM aburto_team.sessions s JOIN aburto_team.members m ON m.id=s.member_id
  WHERE s.token_hash=${hash} AND s.expires_at>now() AND m.status='active' LIMIT 1`;
 return rows[0]??null;
}
function canModerate(m){return ['moderator','coach','admin'].includes(m.role);}
function isStaff(m){return ['coach','admin'].includes(m.role);}
async function authorizedChannels(sql,m){
 return sql`SELECT c.slug,c.title,c.description,c.category,c.access,c.sort_order,c.locked FROM aburto_team.channels c
  WHERE c.access='all'
     OR (c.access='founding' AND ${m.founding})
     OR (c.access='staff' AND ${canModerate(m)})
     OR (c.access='coaching' AND EXISTS
        (SELECT 1 FROM aburto_team.channel_members cm WHERE cm.channel_slug=c.slug AND cm.member_id=${m.id}))
     OR ${isStaff(m)}
  ORDER BY c.sort_order,c.title`;
}
async function allowedChannel(sql,m,slug){
 if(!/^[a-z0-9-]{2,60}$/.test(slug))return null;
 const channels=await authorizedChannels(sql,m);
 return channels.find(c=>c.slug===slug)??null;
}
async function countRate(sql,key,limit,seconds){
 const entries=await sql`INSERT INTO aburto_team.rate_limits (bucket,period_start,count)
  VALUES (${key},now(),1) ON CONFLICT (bucket) DO UPDATE
  SET period_start=CASE WHEN aburto_team.rate_limits.period_start < now()-(${seconds}*interval '1 second') THEN now() ELSE aburto_team.rate_limits.period_start END,
      count=CASE WHEN aburto_team.rate_limits.period_start < now()-(${seconds}*interval '1 second') THEN 1 ELSE aburto_team.rate_limits.count+1 END
  RETURNING count`;
 return entries[0].count<=limit;
}
export const communityCatalog={
 resources:[
  {id:'posing-timer',type:'tool',name:'Temporizador de poses',description:'Practica tu presentación con las herramientas de Andrés.',href:'/#herramientas',access:'all',status:'disponible'},
  {id:'calculadoras',type:'tool',name:'Calculadoras deportivas',description:'Estimaciones de energía y actividad disponibles en la web.',href:'/#herramientas',access:'all',status:'disponible'},
  {id:'posing-intensivo',type:'course',name:'Posing Intensivo',description:'Curso preparado para revisión por Andrés. Se habilitará cuando él autorice.',href:null,access:'coaching',status:'en revision'},
  {id:'cinco-claves',type:'digital',name:'5 Claves antes de competir',description:'Guía digital de Andrés Aburto.',href:'/#productos',access:'all',status:'catalogo'},
  {id:'dia-29',type:'digital',name:'El Día 29',description:'Diario de hábitos y progreso.',href:'/#productos',access:'all',status:'catalogo'},
  {id:'romantizar',type:'digital',name:'Romantizar la Prep',description:'Recetario para la preparación.',href:'/#productos',access:'all',status:'catalogo'}
 ],
 merch:[
  {id:'playera',name:'Playera ABURTO TEAM',type:'Ropa',status:'Próximamente'},
  {id:'hoodie',name:'Hoodie ABURTO TEAM',type:'Ropa',status:'Próximamente'},
  {id:'gorra',name:'Gorra ABURTO TEAM',type:'Accesorios',status:'Próximamente'},
  {id:'shaker',name:'Shaker ABURTO TEAM',type:'Accesorios',status:'Próximamente'},
  {id:'joggers',name:'Joggers ABURTO TEAM',type:'Ropa',status:'Próximamente'},
  {id:'botella',name:'Botella ABURTO TEAM',type:'Accesorios',status:'Próximamente'}
 ]
};

export default async function communityHandler(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('X-Robots-Tag','noindex, nofollow');
 if(!process.env.COMMUNITY_DATABASE_URL||!process.env.COMMUNITY_TOKEN_PEPPER)return error(res,503,'La comunidad aún no está configurada.');
 if(!['GET','POST'].includes(req.method))return error(res,405,'Método no permitido.');
 if(req.method==='POST'){
  const origin=String(req.headers.origin||'');
  const host=String(req.headers.host||'');
  if(!origin||origin!==`https://${host}`)return error(res,403,'Origen no permitido.');
  const length=Number(req.headers['content-length']||0);
  if(length>10000)return error(res,413,'Solicitud demasiado grande.');
 }
 const action=String(req.query?.action||'me').slice(0,40);
 let body={};
 try{if(req.method==='POST')body=getBody(req);}catch{return error(res,400,'Solicitud inválida.');}
 if(!body||typeof body!=='object'||Array.isArray(body))return error(res,400,'Solicitud inválida.');
 const sql=neon(process.env.COMMUNITY_DATABASE_URL);
 try {
  if(req.method==='POST'&&action==='request_code'){
   const email=emailOf(body.email);
   if(!MAIL.test(email))return error(res,400,'Escribe un correo electrónico válido.');
   if(!(await countRate(sql,hex('otp-ip',clientIP(req)),15,3600)))return error(res,429,'Demasiadas solicitudes. Intenta más tarde.');
   if(!(await countRate(sql,hex('otp-email',email),6,3600)))return error(res,429,'Espera antes de solicitar otro acceso.');
   const code=String(randomInt(100000,1000000));
   const digest=hex('verify',email,code);
   const rows=await sql`INSERT INTO aburto_team.login_codes(email,code_hash,sent_at,expires_at,attempts,requests,first_request_at)
     VALUES(${email},${digest},now(),now()+interval '10 minutes',0,1,now())
     ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash,sent_at=now(),expires_at=excluded.expires_at,attempts=0,
     requests=CASE WHEN aburto_team.login_codes.first_request_at<now()-interval '1 hour' THEN 1 ELSE aburto_team.login_codes.requests+1 END,
     first_request_at=CASE WHEN aburto_team.login_codes.first_request_at<now()-interval '1 hour' THEN now() ELSE aburto_team.login_codes.first_request_at END
     WHERE aburto_team.login_codes.sent_at<now()-interval '60 seconds' AND
       (aburto_team.login_codes.requests<6 OR aburto_team.login_codes.first_request_at<now()-interval '1 hour')
     RETURNING email`;
   if(!rows.length)return error(res,429,'Puedes pedir otro código después de 60 segundos.');
   const message=await sendTransactionalEmail({to:email,subject:'Tu código de acceso · ABURTO TEAM',
    text:`Tu código para entrar a ABURTO TEAM es: ${code}\n\nVence en 10 minutos. Si no lo pediste, ignora este mensaje. Nunca compartas este código.\n\nAndrés Aburto Pro Coach`,
    idempotencyKey:`aburto/team/otp/${hex('mail',email,code).slice(0,30)}`,
    tags:[{name:'category',value:'community_verification'}]});
   if(!message.sent)return error(res,503,'El envío de correo no está disponible.');
   return res.status(200).json({ok:true,message:'Te enviamos un código al correo. Revisa también spam.'});
  }
  if(req.method==='POST'&&action==='verify_code'){
   const email=emailOf(body.email),code=String(body.code||'').trim();
   if(!MAIL.test(email)||!/^[0-9]{6}$/.test(code))return error(res,400,'Código inválido.');
   if(!(await countRate(sql,hex('verify-ip',clientIP(req)),30,3600)))return error(res,429,'Demasiados intentos.');
   const challenge=await sql`SELECT code_hash FROM aburto_team.login_codes WHERE email=${email} AND expires_at>now() AND attempts<5`;
   if(!challenge.length)return error(res,401,'Código incorrecto o vencido.');
   const expected=hex('verify',email,code);
   if(!sameHash(challenge[0].code_hash,expected)){
    await sql`UPDATE aburto_team.login_codes SET attempts=attempts+1 WHERE email=${email}`;
    return error(res,401,'Código incorrecto o vencido.');
   }
   const consumed=await sql`DELETE FROM aburto_team.login_codes WHERE email=${email} AND code_hash=${expected}
      AND expires_at>now() AND attempts<5 RETURNING email`;
   if(!consumed.length)return error(res,401,'Código ya utilizado.');
   const admin=email===emailOf(process.env.DASHBOARD_ADMIN_EMAIL);
   const coach=email===emailOf(process.env.ANDRES_DASHBOARD_EMAIL);
   const role=admin?'admin':coach?'coach':'member';
   const proposed=String(body.name||'').trim().slice(0,60);
   const name=proposed.length>=2?proposed:email.split('@')[0].slice(0,60);
   const people=await sql`INSERT INTO aburto_team.members(email,display_name,role)
    VALUES(${email},${name},${role})
    ON CONFLICT(email) DO UPDATE SET last_seen=now() RETURNING *`;
   const person=people[0];
   if(person.status!=='active')return error(res,403,'Este acceso está suspendido.');
   const token=randomBytes(32).toString('hex');
   const hash=hex('session',token);
   await sql`INSERT INTO aburto_team.sessions(token_hash,member_id,expires_at)
    VALUES(${hash},${person.id},now()+interval '30 days')`;
   res.setHeader('Set-Cookie',cookie(token,2592000));
   return res.status(200).json({ok:true,user:safeMember(person)});
  }
  if(req.method==='POST'&&action==='logout'){
   const token=String(req.headers.cookie||'').match(/(?:^|;\s*)__Host-aburto_team=([a-f0-9]{64})(?:;|$)/)?.[1];
   if(token)await sql`DELETE FROM aburto_team.sessions WHERE token_hash=${hex('session',token)}`;
   res.setHeader('Set-Cookie',cookie('',0));
   return res.status(200).json({ok:true});
  }
  const m=await memberFromSession(sql,req);
  if(!m)return error(res,401,'Inicia sesión con tu correo verificado.');
  if(req.method==='GET'&&action==='me')return res.status(200).json({ok:true,user:safeMember(m)});
  if(req.method==='GET'&&action==='bootstrap'){
   const channels=await authorizedChannels(sql,m);
   return res.status(200).json({ok:true,user:safeMember(m),channels,resources:communityCatalog.resources.filter(x=>x.access==='all'||isStaff(m)||m.founding),merch:communityCatalog.merch});
  }
  if(req.method==='GET'&&action==='messages'){
   const channel=await allowedChannel(sql,m,String(req.query?.channel||''));
   if(!channel)return error(res,403,'No tienes acceso a este canal.');
   const after=asNumber(req.query.after,0,2147483647,0);
   const rows=after
    ? await sql`SELECT msg.id,msg.body,msg.created_at,msg.pinned, m.display_name AS author,m.role,m.id AS author_id
         FROM aburto_team.messages msg JOIN aburto_team.members m ON m.id=msg.member_id
         WHERE msg.channel_slug=${channel.slug} AND msg.deleted_at IS NULL AND msg.id>${after}
         ORDER BY msg.id ASC LIMIT 80`
    : await sql`SELECT * FROM (SELECT msg.id,msg.body,msg.created_at,msg.pinned, m.display_name AS author,m.role,m.id AS author_id
         FROM aburto_team.messages msg JOIN aburto_team.members m ON m.id=msg.member_id
         WHERE msg.channel_slug=${channel.slug} AND msg.deleted_at IS NULL ORDER BY msg.id DESC LIMIT 80) t ORDER BY id ASC`;
   return res.status(200).json({ok:true,channel,messages:rows});
  }
  if(req.method==='POST'&&action==='message'){
   const channel=await allowedChannel(sql,m,String(body.channel||''));
   if(!channel)return error(res,403,'No tienes acceso a este canal.');
   if(channel.locked&&!canModerate(m))return error(res,403,'Canal de solo lectura.');
   const text=String(body.text||'').trim();
   if(!text||text.length>2000)return error(res,400,'El mensaje debe tener entre 1 y 2000 caracteres.');
   if(!(await countRate(sql,hex('message',m.id),30,60)))return error(res,429,'Has enviado demasiados mensajes. Espera un minuto.');
   const messages=await sql`INSERT INTO aburto_team.messages(channel_slug,member_id,body)
     VALUES(${channel.slug},${m.id},${text}) RETURNING id,created_at`;
   return res.status(201).json({ok:true,id:messages[0].id});
  }
  if(req.method==='POST'&&action==='profile'){
   const name=String(body.name||'').trim(),bio=String(body.bio||'').trim();
   if(name.length<2||name.length>60||bio.length>240)return error(res,400,'Revisa el nombre o la biografía.');
   const rows=await sql`UPDATE aburto_team.members SET display_name=${name},bio=${bio} WHERE id=${m.id} RETURNING *`;
   return res.status(200).json({ok:true,user:safeMember(rows[0])});
  }
  if(req.method==='POST'&&action==='delete'){
   const id=asNumber(body.id,1,2147483647,-1);
   const rows=await sql`UPDATE aburto_team.messages SET deleted_at=now()
    WHERE id=${id} AND deleted_at IS NULL AND (member_id=${m.id} OR ${canModerate(m)}) RETURNING id,member_id`;
   if(!rows.length)return error(res,403,'No puedes eliminar ese mensaje.');
   await sql`INSERT INTO aburto_team.audit_events(actor_id,action,target) VALUES(${m.id},'delete_message',${String(id)})`;
   return res.status(200).json({ok:true});
  }
  if(req.method==='POST'&&action==='pin'){
   if(!canModerate(m))return error(res,403,'No tienes permisos de moderación.');
   const id=asNumber(body.id,1,2147483647,-1);
   const rows=await sql`UPDATE aburto_team.messages SET pinned=NOT pinned WHERE id=${id} AND deleted_at IS NULL RETURNING id,pinned`;
   if(!rows.length)return error(res,404,'Mensaje no encontrado.');
   return res.status(200).json({ok:true,pinned:rows[0].pinned});
  }
  if(req.method==='GET'&&action==='members'){
   if(!isStaff(m))return error(res,403,'Solo para equipo de Andrés.');
   const rows=await sql`SELECT id,email,display_name,role,founding,status,joined_at FROM aburto_team.members ORDER BY joined_at DESC LIMIT 200`;
   return res.status(200).json({ok:true,members:rows});
  }
  if(req.method==='POST'&&action==='member_update'){
   if(m.role!=='admin')return error(res,403,'Solo Raíz Noble puede asignar estos permisos.');
   const id=String(body.id||'');
   if(!/^[0-9a-f-]{36}$/.test(id)||id===m.id)return error(res,400,'Selecciona otro miembro.');
   const role=String(body.role||'');
   const status=String(body.status||'');
   const founding=body.founding===true;
   if(!['member','moderator'].includes(role)||!['active','suspended'].includes(status))return error(res,400,'Permiso inválido.');
   const rows=await sql`UPDATE aburto_team.members SET role=${role},founding=${founding},status=${status}
    WHERE id=${id} AND role NOT IN ('admin','coach') RETURNING id`;
   if(!rows.length)return error(res,403,'Cuenta protegida o inexistente.');
   await sql`INSERT INTO aburto_team.audit_events(actor_id,action,target) VALUES(${m.id},'member_update',${id})`;
   return res.status(200).json({ok:true});
  }
  if(req.method==='POST'&&action==='room'){
   if(!isStaff(m))return error(res,403,'Solo Andrés o Raíz Noble pueden crear salas.');
   const title=String(body.title||'').trim().slice(0,60),memberId=String(body.memberId||'');
   if(title.length<3||!/^[0-9a-f-]{36}$/.test(memberId))return error(res,400,'Indica nombre de sala y atleta.');
   const id='coaching-'+randomUUID().slice(0,12);
   await sql`INSERT INTO aburto_team.channels(slug,title,description,category,access,sort_order)
       VALUES(${id},${title},'Sala privada de coaching','EXCLUSIVOS','coaching',92)`;
   const invited=await sql`INSERT INTO aburto_team.channel_members(channel_slug,member_id,added_by)
       SELECT ${id},id,${m.id} FROM aburto_team.members WHERE id=${memberId} AND status='active'
       ON CONFLICT DO NOTHING RETURNING member_id`;
   if(!invited.length){await sql`DELETE FROM aburto_team.channels WHERE slug=${id}`;return error(res,404,'Atleta no encontrado.');}
   return res.status(201).json({ok:true,channel:id});
  }
  if(req.method==='POST'&&action==='invite'){
   if(!isStaff(m))return error(res,403,'Solo administración.');
   const slug=String(body.channel||''),memberId=String(body.memberId||'');
   const channel=await allowedChannel(sql,m,slug);
   if(!channel||channel.access!=='coaching'||!/^[0-9a-f-]{36}$/.test(memberId))return error(res,400,'Sala o miembro inválido.');
   const rows=await sql`INSERT INTO aburto_team.channel_members(channel_slug,member_id,added_by)
     SELECT ${slug},id,${m.id} FROM aburto_team.members WHERE id=${memberId} AND status='active'
     ON CONFLICT DO NOTHING RETURNING member_id`;
   return res.status(200).json({ok:true,added:rows.length>0});
  }
  return error(res,404,'Función no encontrada.');
 }catch(e){
  console.error('aburto-team-api',e.code||e.message);
  return error(res,503,'La comunidad no pudo procesar la solicitud. Intenta nuevamente.');
 }
}
