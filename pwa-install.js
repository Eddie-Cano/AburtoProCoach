(()=>{
 'use strict';
 if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
 window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(err=>console.warn('PWA registration unavailable:',err)));
 let installEvent=null;
 const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
 const create=()=>{
  if(standalone()||document.getElementById('aburto-install'))return;
  const panel=document.createElement('aside');panel.id='aburto-install';panel.setAttribute('aria-label','Instalar aplicación');
  panel.style.cssText='position:fixed;bottom:16px;left:16px;right:16px;max-width:420px;margin:auto;z-index:9999;background:#171316;border:1px solid #9d2035;border-radius:13px;padding:15px;color:#fff;box-shadow:0 15px 40px #000b;font:14px/1.4 system-ui';
  panel.innerHTML='<div style="display:flex;gap:12px;align-items:center"><img src="/assets/logo/aburto-original.png" width="42" height="42" style="object-fit:contain" alt=""><div style="flex:1"><strong>ABURTO PRO COACH</strong><div id="aburto-install-help" style="margin-top:3px;color:#c5bdc0"></div></div><button type="button" id="aburto-install-close" style="border:0;color:#fff;background:transparent;font-size:22px;cursor:pointer" aria-label="Cerrar aviso">×</button></div><button type="button" id="aburto-install-action" style="margin-top:12px;background:#ad273d;color:#fff;border:0;border-radius:7px;padding:10px 15px;font-weight:700;cursor:pointer">Instalar aplicación</button>';
  document.body.append(panel);panel.querySelector('#aburto-install-close').addEventListener('click',()=>{sessionStorage.setItem('aburto-pwa-dismiss','1');panel.remove()});
  const help=panel.querySelector('#aburto-install-help'),action=panel.querySelector('#aburto-install-action');
  if(installEvent){help.textContent='Instala la app en tu pantalla de inicio.';action.addEventListener('click',async()=>{const e=installEvent;installEvent=null;panel.remove();await e.prompt();});}
  else if(ios){help.textContent='En Safari toca Compartir y después “Agregar a pantalla de inicio”.';action.textContent='Entendido';action.addEventListener('click',()=>panel.remove());}
  else{help.textContent='En el menú de tu navegador busca “Instalar app” o “Agregar a pantalla de inicio”.';action.textContent='Entendido';action.addEventListener('click',()=>panel.remove());}
 };
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installEvent=event;if(!sessionStorage.getItem('aburto-pwa-dismiss'))create();});
 window.addEventListener('appinstalled',()=>{installEvent=null;document.getElementById('aburto-install')?.remove()});
 if(ios&&!standalone())window.addEventListener('load',()=>{if(!sessionStorage.getItem('aburto-pwa-dismiss'))create()});
})();
