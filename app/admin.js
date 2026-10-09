(()=>{
'use strict';
const $=id=>document.getElementById(id);
const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);return e};
async function load(){
 const team=window.Team;if(!team||!['admin','coach'].includes(team.S.user?.role))return;
 const wrap=$('memberList');wrap.textContent='Cargando atletas…';
 try{
  const data=await team.api('members');wrap.replaceChildren();
  const rooms=$('inviteChannel');rooms.replaceChildren();
  const blankRoom=el('option','Seleccionar sala');blankRoom.value='';rooms.append(blankRoom);
  for(const c of team.S.channels.filter(c=>c.access==='coaching'&&c.slug!=='coaching')){const option=el('option',c.title);option.value=c.slug;rooms.append(option)}
  const copy=$('inviteMember');copy.replaceChildren();const empty=el('option','Seleccionar atleta');empty.value='';copy.append(empty);
  const select=$('roomMember');select.replaceChildren();
  const init=el('option','Seleccionar atleta');init.value='';select.append(init);
  for(const m of data.members||[]){
   if(!['admin','coach'].includes(m.role)){const option=el('option',m.display_name+' · '+m.email);option.value=m.id;select.append(option);const other=el('option',m.display_name+' · '+m.email);other.value=m.id;copy.append(other)}
   const row=el('div');row.className='member-row';
   const info=el('div');info.append(el('strong',m.display_name),el('small',m.email+' · '+m.role+(m.founding?' · Founding':'')));row.append(info);
   if(team.S.user.role==='admin'&&!['admin','coach'].includes(m.role)){
    const box=el('div');box.className='member-controls';
    const role=el('select');for(const v of ['member','moderator']){const o=el('option',v);o.value=v;o.selected=m.role===v;role.append(o)}
    const founding=el('select');for(const [value,label] of [['false','Regular'],['true','Founding']]){const o=el('option',label);o.value=value;o.selected=String(m.founding)===value;founding.append(o)}
    const status=el('select');for(const v of ['active','suspended']){const o=el('option',v);o.value=v;o.selected=m.status===v;status.append(o)}
    const save=el('button','Guardar');
    save.type='button';save.onclick=async()=>{save.disabled=true;try{await team.api('member_update',{id:m.id,role:role.value,founding:founding.value==='true',status:status.value});team.notify('Permisos actualizados');await load()}catch(e){team.notify(e.message)}finally{save.disabled=false}};
    box.append(role,founding,status,save);row.append(box);
   }
   wrap.append(row);
  }
 }catch(e){wrap.textContent=e.message}
}
$('roomForm').addEventListener('submit',async e=>{
 e.preventDefault();const team=window.Team;if(!team)return;
 const submit=$('roomForm').querySelector('[type="submit"]');submit.disabled=true;
 try{const data=await team.api('room',{title:$('roomTitle').value,memberId:$('roomMember').value});
  $('roomTitle').value='';team.notify('Sala privada creada');await team.bootstrap();team.view('admin');
 }catch(error){team.notify(error.message)}finally{submit.disabled=false}
});
$('inviteForm').addEventListener('submit',async e=>{
 e.preventDefault();const team=window.Team;const button=$('inviteForm').querySelector('[type="submit"]');button.disabled=true;
 try{await team.api('invite',{channel:$('inviteChannel').value,memberId:$('inviteMember').value});team.notify('Acceso privado actualizado');}
 catch(error){team.notify(error.message)}finally{button.disabled=false}
});
window.TeamAdmin={load};
})();