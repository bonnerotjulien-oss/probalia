const CACHE='probalia-shell-v4.8.0';
const FILES=['./','./index.html','./style.css','./risk.css','./combo.css','./builder.css','./auto.css','./calibration.css','./top.css','./pwa.css','./dashboard.css','./calendar.css','./warm.css','./performance.css','./tactical.css','./intelligence.css','./app.js','./model.js','./learning.js','./tactics.js','./tactical-ui.js','./intelligence.js','./intelligence-ui.js','./calibration.js','./season.js','./weekend.js','./calendar.js','./ledger.js','./performance.js','./freshness.js','./builder.js','./odds.js','./auto.js','./top.js','./pwa.js','./manifest.webmanifest','./icons/icon.svg','./icons/icon-180.png','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))),self.clients.claim()])));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==location.origin)return;
  if(['/data/results.json','/data/fixtures.json','/data/odds.json','/data/predictions.json','/data/model-settings.json','/data/tactics.json','/data/intelligence.json','/data/tactical-news.json'].some(s=>url.pathname.endsWith(s))){event.respondWith(fetch(event.request,{cache:'no-store'}));return}
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{})}return response}).catch(()=>caches.match(event.request).then(cached=>cached|| (event.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));
});
