const CACHE='reforge-v1';
self.addEventListener('install', e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/']))));
self.addEventListener('activate', e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e=>{ if(e.request.method==='GET' && new URL(e.request.url).origin===location.origin){e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request)))}});
