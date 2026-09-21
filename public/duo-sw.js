const CACHE='reforge-duo-v2';
const BASE=new URL(self.registration.scope).pathname.replace(/\/$/,'');
const at=(path)=>BASE+path;
const SHELL=[at('/duo/'),at('/duo-manifest.webmanifest'),at('/icons/reforge-192.svg'),at('/icons/reforge-512.svg')];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).catch(()=>undefined));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim();});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>undefined);return response;}).catch(()=>caches.match(event.request).then(hit=>hit||caches.match(at('/duo/')))));
});