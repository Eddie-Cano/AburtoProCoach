(()=>{'use strict';const $=id=>document.getElementById(id),params=new URLSearchParams(location.hash.slice(1));
let token=params.get('acceso')||sessionStorage.getItem('aburto-library-token')||'',data;
if(params.get('acceso')){sessionStorage.setItem('aburto-library-token',token);history.replaceState(null,'',location.pathname);}
async function api(options={}){const response=await fetch('/api/library',{cache:'no-store',credentials:'same-origin',...options,headers:{...(token?{Authorization:'Bearer '+token}:{}),...options.headers}});const body=await response.json();if(!response.ok)throw Error(body.error||'No pudimos conectar con tu biblioteca.');return body;}
function render(){
 $('library').hidden=false;$('recipient').textContent=data.name?data.name+' · '+data.email:data.email;
 $('expires').textContent='Acceso vigente hasta '+new Date(data.expiresAt).toLocaleDateString('es-MX');
 $('consent').hidden=data.ready;$('ready').hidden=!data.ready;$('products').replaceChildren();
 data.products.forEach((product,i)=>{const card=document.createElement('article');card.className='product';
 const number=document.createElement('span');number.className='number';number.textContent='0'+(i+1)+' / '+(data.language==='en'?'EDICIÓN EN INGLÉS':'EDICIÓN EN ESPAÑOL');
 const title=document.createElement('h2');title.textContent=product.name;const description=document.createElement('p');description.textContent='PDF · acceso personal';
 const link=document.createElement(data.ready?'a':'span');link.className='download'+(data.ready?'':' locked');link.textContent=data.ready?'DESCARGAR MI PRODUCTO ↗':'ACEPTA LAS CONDICIONES PARA ABRIR';if(data.ready){link.href=product.download;link.setAttribute('download','');}
 card.append(number,title,description,link);$('products').append(card);});$('status').textContent='';
}
$('consent').addEventListener('submit',async e=>{e.preventDefault();$('activate').disabled=true;$('status').textContent='Habilitando tu biblioteca…';try{data=await api({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({privacy:$('privacy').checked,agreement:$('agreement').checked,privacyVersion:data.privacyVersion,agreementVersion:data.agreementVersion})});render();}catch(error){$('status').textContent=error.message;}finally{$('activate').disabled=false;}});
if(!token)$('status').textContent='Abre el enlace personal que recibiste por correo. Los productos se muestran únicamente con un acceso válido.';
else api().then(result=>{data=result;render();}).catch(error=>{$('status').textContent=error.message;});
})();
