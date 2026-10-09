/* Privacy-first PWA: no caching of HTML, authenticated content, chat, APIs, payments or files. */
const CACHE='aburto-shell-v1';
const OFFLINE='/offline.html';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll([OFFLINE,'/assets/pwa/icon.svg'])));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('aburto-shell-')&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||request.mode!=='navigate')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/dashboard/')||url.pathname.startsWith('/biblioteca')||url.pathname.startsWith('/productos/'))return;
 event.respondWith(fetch(request).catch(()=>caches.match(OFFLINE)));
});
