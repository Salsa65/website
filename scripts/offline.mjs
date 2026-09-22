import { readdirSync, writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const root = resolve("out");
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(resolve(dir, e.name)) : [resolve(dir, e.name)],
  );
}
const assets = files(root)
  .map((f) => f.slice(root.length + 1))
  .filter(
    (f) =>
      f === "index.html" ||
      f === "manifest.webmanifest" ||
      f === "icons/redbound.svg" ||
      f.startsWith("_next/static/"),
  );
const hash = createHash("sha256");
for (const f of assets) hash.update(readFileSync(resolve(root, f)));
const version = "redbound-" + hash.digest("hex").slice(0, 16);
const worker = `const CACHE=${JSON.stringify(version)};
const ROOT=new URL('./',self.location).href;
const ASSETS=${JSON.stringify(assets)}.map(p=>new URL(p,ROOT).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('redbound-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match(new URL('index.html',ROOT).href)));return;}
if(ASSETS.includes(event.request.url))event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));});`;
writeFileSync(resolve(root, "redbound-sw.js"), worker);
console.log("Created versioned Redbound offline cache.");
