(()=>{
'use strict';
const $=id=>document.getElementById(id);
const S={user:null,channels:[],resources:[],channel:'general',view:'chat',timer:null,usageTimer:null,loading:false,previous:''};
const el=(tag,cls='',value)=>{const x=document.createElement(tag);x.className=cls;if(value!==undefined)x.textContent=String(value);return x};
const notify=t=>{$('toast').textContent=t;$('toast').classList.add('visible');setTimeout(()=>$('toast').classList.remove('visible'),4200)};
async function api(action,data,params={}){
 const q=new URLSearchParams({community:'1',action,...params});
 const r=await fetch('/api/access?'+q,{method:data?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});
 const b=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(Error(b.error||'Error de conexión'),{status:r.status});return b;
}
function view(name){
 if(name==='admin'&&!['admin','coach'].includes(S.user?.role))return;
 S.view=name;
 document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id===name+'View'));
 document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===name));
 const labels={resources:['▤','Herramientas','Calculadoras deportivas'],store:['▣','Cursos','Formación y guías de Andrés'],profile:['♙','Mi perfil','Cuenta verificada'],admin:['⚙','Administración','Gestión privada']};
 if(name==='chat')channel(S.channel,false);else {const d=labels[name];$('viewSymbol').textContent=d[0];$('viewTitle').textContent=d[1];$('viewDescription').textContent=d[2];}
 $('channelPane').classList.remove('open');if(name==='admin')window.TeamAdmin?.load();
}
function channel(slug,change=true){
 const c=S.channels.find(x=>x.slug===slug)||S.channels[0];if(!c)return;
 S.channel=c.slug;if(change){S.view='chat';document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id==='chatView'));document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view==='chat'));}
 document.querySelectorAll('.channel-link').forEach(x=>x.classList.toggle('active',x.dataset.channel===c.slug));
 $('viewSymbol').textContent='#';$('viewTitle').textContent=c.title;$('viewDescription').textContent=c.description;
 $('messageInput').placeholder='Mensaje en #'+c.title+'…';$('messageInput').disabled=c.locked&&!['admin','coach','moderator'].includes(S.user?.role);
 $('channelPane').classList.remove('open');S.previous='';loadMessages();
}
function renderChannels(){
 const box=$('channelList');box.replaceChildren();let category='';
 S.channels.forEach(c=>{
  if(c.category!==category){category=c.category;box.append(el('div','channel-category',category));}
  const b=el('button','channel-link');b.type='button';b.dataset.channel=c.slug;b.append(el('span','channel-hash','#'),el('span','',c.title));
  if(c.access!=='all')b.append(el('span','lock','⌑'));b.addEventListener('click',()=>channel(c.slug));box.append(b);
 });
}
function renderMessages(messages){
 const box=$('messages'),bottom=box.scrollHeight-box.clientHeight-box.scrollTop<180;
 const key=messages.map(x=>x.id+':'+x.pinned).join('|');if(key===S.previous)return;S.previous=key;box.replaceChildren();
 if(!messages.length){const d=el('div','empty-feed');d.append(el('span','','PRIMER PASO'),el('h2','','TU VOZ\\nCUENTA.'),el('p','','Sé el primero en escribir en este canal.'));box.append(d);return;}
 for(const m of messages){
  const row=el('article','message'),avatar=el('div','message-avatar',(m.author||'A')[0].toUpperCase()),content=el('div');
  const head=el('div','message-heading');head.append(el('strong','',m.author));
  if(['admin','coach','moderator'].includes(m.role))head.append(el('span','message-admin',m.role.toUpperCase()));
  head.append(el('time','',new Date(m.created_at).toLocaleString('es-MX')));
  if(m.pinned)head.append(el('span','pin-mark','◆ FIJADO'));
  content.append(head,el('div','message-body',m.body));
  const controls=el('div','message-actions');
  if(m.author_id===S.user.id||['admin','coach','moderator'].includes(S.user.role)){
   const del=el('button','','Eliminar');del.type='button';del.onclick=async()=>{if(!confirm('¿Eliminar mensaje?'))return;try{await api('delete',{id:Number(m.id)});S.previous='';loadMessages()}catch(e){notify(e.message)}};
   controls.append(del);
  }
  if(['admin','coach','moderator'].includes(S.user.role)){
   const pin=el('button','',m.pinned?'Desfijar':'Fijar');pin.type='button';pin.onclick=async()=>{try{await api('pin',{id:Number(m.id)});S.previous='';loadMessages()}catch(e){notify(e.message)}};controls.append(pin);
  }
  content.append(controls);row.append(avatar,content);box.append(row);
 }
 if(bottom)box.scrollTop=box.scrollHeight;
}
async function loadMessages(){
 if(S.loading||S.view!=='chat'||!S.user)return;S.loading=true;const current=S.channel;
 try{const d=await api('messages',null,{channel:current});if(S.channel===current)renderMessages(d.messages);$('connectionLabel').textContent='Conectado · sincronizado'}
 catch(e){$('connectionLabel').textContent='Sincronización pendiente';notify(e.message)}
 finally{S.loading=false}
}
function card(item,icon){
 const x=el('article','catalog-card');x.append(el('span','card-symbol',icon),el('h2','',item.name),el('p','',item.description||item.type||'ABURTO TEAM'));
 const f=el('div','card-foot');f.append(el('span','card-tag',item.status||'próximamente'));
 if(typeof item.href==='string'&&item.href.startsWith('/')&&!item.href.startsWith('//')){const a=el('a','','Explorar ↗');a.href=item.href;f.append(a)}
 x.append(f);return x;
}
function setupCatalog(){
 $('resourceCards').replaceChildren(...S.resources.filter(x=>x.type==='tool').map(x=>card(x,'⚡')));
 $('courseCards').replaceChildren(...S.resources.filter(x=>x.type==='course').map(x=>card(x,'◈')));
 $('digitalCards').replaceChildren(...S.resources.filter(x=>x.type==='digital').map(x=>card(x,'▣')));
}
function installMode(){
 try{if(window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true)return 'standalone';}catch{}
 return 'browser';
}
function mobilePlatform(){
 const ua=navigator.userAgent||'';
 return /iphone|ipad|ipod/i.test(ua)?'ios':/android/i.test(ua)?'android':'other';
}
async function trackUsage(event,overrideMode){
 if(!S.user)return;
 try{await api('usage',{event,mode:overrideMode||installMode(),platform:mobilePlatform()})}
 catch(error){if(error.status===401)clearInterval(S.usageTimer)}
}
window.addEventListener('appinstalled',()=>{
 if(S.user)trackUsage('installed','appinstalled');
 else try{sessionStorage.setItem('aburto-team-pending-install','1')}catch{}
});
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden&&S.user){trackUsage('active');if(S.view==='chat')loadMessages()}
});
function setupProfile(){
 const m=S.user;if(!m)return;
 $('headerProfile').textContent=m.name[0].toUpperCase();$('profileAvatar').textContent=m.name[0].toUpperCase();$('profileHandle').textContent=m.name;
 $('profileEmail').textContent=m.email;$('profileRole').textContent=m.role.toUpperCase()+(m.founding?' · FOUNDING':'');$('profileName').value=m.name;$('profileBio').value=m.bio||'';
 $('adminTab').classList.toggle('hidden',!['admin','coach'].includes(m.role));
}
async function bootstrap(){
 const d=await api('bootstrap');S.user=d.user;S.channels=d.channels;S.resources=d.resources;
 if(!S.channels.some(x=>x.slug===S.channel))S.channel=S.channels[0]?.slug||'general';
 renderChannels();setupCatalog();setupProfile();$('authOverlay').classList.add('hidden');view('chat');
 clearInterval(S.timer);S.timer=setInterval(()=>{if(!document.hidden)loadMessages()},6000);
 clearInterval(S.usageTimer);
 S.usageTimer=setInterval(()=>{if(!document.hidden&&S.user)trackUsage('active')},300000);
 trackUsage('open');
 try{if(sessionStorage.getItem('aburto-team-pending-install')==='1'){sessionStorage.removeItem('aburto-team-pending-install');trackUsage('installed','appinstalled')}}catch{}
}
window.Team={S,api,bootstrap,view,notify};
document.querySelectorAll('[data-view]').forEach(x=>x.addEventListener('click',()=>view(x.dataset.view)));
$('headerProfile').onclick=()=>view('profile');
$('channelToggle').onclick=()=>{$('channelPane').classList.toggle('open')};
$('emailForm').onsubmit=async e=>{e.preventDefault();$('requestButton').disabled=true;try{const d=await api('request_code',{email:$('loginEmail').value,name:$('loginName').value});$('authFeedback').textContent=d.message;$('emailForm').classList.add('hidden');$('codeForm').classList.remove('hidden');$('loginCode').focus()}catch(err){$('authFeedback').textContent=err.message}finally{$('requestButton').disabled=false}};
$('codeForm').onsubmit=async e=>{e.preventDefault();$('verifyButton').disabled=true;try{await api('verify_code',{email:$('loginEmail').value,code:$('loginCode').value,name:$('loginName').value});$('loginCode').value='';await bootstrap()}catch(err){$('authFeedback').textContent=err.message}finally{$('verifyButton').disabled=false}};
$('changeEmail').onclick=()=>{$('emailForm').classList.remove('hidden');$('codeForm').classList.add('hidden');$('authFeedback').textContent=''};
$('messageForm').onsubmit=async e=>{e.preventDefault();const input=$('messageInput');if(!input.value.trim())return;$('sendButton').disabled=true;try{await api('message',{channel:S.channel,text:input.value.trim()});input.value='';S.previous='';await loadMessages()}catch(err){notify(err.message)}finally{$('sendButton').disabled=false}};
$('messageInput').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('messageForm').requestSubmit()}};
$('profileForm').onsubmit=async e=>{e.preventDefault();try{const r=await api('profile',{name:$('profileName').value,bio:$('profileBio').value});S.user=r.user;setupProfile();notify('Perfil actualizado')}catch(err){notify(err.message)}};
$('logoutButton').onclick=async()=>{try{await api('logout',{})}catch{}clearInterval(S.timer);clearInterval(S.usageTimer);S.user=null;$('authOverlay').classList.remove('hidden');$('codeForm').classList.add('hidden');$('emailForm').classList.remove('hidden');$('authFeedback').textContent=''};
(async()=>{try{await bootstrap()}catch(err){$('authOverlay').classList.remove('hidden');if(err.status!==401)$('authFeedback').textContent=err.message}})();
})();