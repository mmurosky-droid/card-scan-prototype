/* Collectors Desk v0.11 - offline cache. The app and the reader (about 11 MB of bundled reader files) are kept on this device after the first visit,
   so reading cards works with no connection. Nothing is sent anywhere. Pages and scripts are fetched fresh when online, and the saved copy is used when offline. */
'use strict';
var VER='0.11', RVER='0.10.4', CACHE='collectors-desk-'+VER, BIGRE=/\/ocr\/|card-reader|ocr-players/;
var CORE=['./','index.html','binder.css?v='+VER,'binder.js?v='+VER,'listing.js?v='+VER,'reader-adapter.js?v='+RVER,'card-reader.js?v='+RVER,'card-reader-worker.js?v='+RVER,'ebay-cam.js?v='+VER,
 'ocr-dict.js?v=0.10','ocr-parse.js?v=0.10','ocr.js?v=0.10','ocr-digits.js?v=0.10','ocr-serial.js?v=0.10','ocr-text.js?v=0.10','ocr-guess.js?v=0.10','ocr-read.js?v=0.10','cleanup.js?v='+VER,'ocr-players.js?v='+RVER,'ocr-auto.js?v='+RVER];
var OCR=['ocr/tesseract.min.js','ocr/worker.min.js','ocr/eng.traineddata.gz'];
self.addEventListener('install',function(e){ e.waitUntil(caches.open(CACHE).then(function(c){ return Promise.all(CORE.map(function(u){ return c.add(u).catch(function(){}); })); }).then(function(){ return self.skipWaiting(); })); });
self.addEventListener('activate',function(e){ e.waitUntil(caches.keys().then(function(ks){ return Promise.all(ks.filter(function(k){ return k.indexOf('collectors-desk-')===0&&k!==CACHE; }).map(function(k){ return caches.delete(k); })); }).then(function(){ return self.clients.claim(); })); });
/* the page asks for the reader files to be saved for offline use once it is idle (it says whether this phone can run the faster core) */
self.addEventListener('message',function(e){ var m=e.data||{}; if(m.warm){ var list=OCR.concat(['ocr/'+(m.simd?'tesseract-core-simd-lstm.wasm.js':'tesseract-core-lstm.wasm.js')]);
  e.waitUntil(caches.open(CACHE).then(function(c){ return Promise.all(list.map(function(u){ return c.match(u).then(function(h){ if(!h) return c.add(u).catch(function(){}); }); })); }).then(function(){ return self.clients.matchAll(); }).then(function(cl){ cl.forEach(function(x){ x.postMessage({warmed:true}); }); })); } });
self.addEventListener('fetch',function(e){
  var r=e.request; if(r.method!=='GET') return; var u=new URL(r.url); if(u.origin!==self.location.origin) return;
  if(BIGRE.test(u.pathname)){ /* big, versioned: saved copy first */
    e.respondWith(caches.match(r,{ignoreSearch:true}).then(function(h){ return h||fetch(r).then(function(n){ if(n&&n.ok){ var cp=n.clone(); caches.open(CACHE).then(function(c){ c.put(r,cp); }); } return n; }); })); return; }
  /* everything else: fresh when online, saved copy when not */
  e.respondWith(fetch(r).then(function(n){ if(n&&n.ok&&n.type==='basic'){ var cp=n.clone(); caches.open(CACHE).then(function(c){ c.put(r,cp); }); } return n; }).catch(function(){ return caches.match(r).then(function(h){ return h||caches.match(r,{ignoreSearch:true}).then(function(h2){ return h2||(r.mode==='navigate'?caches.match('index.html'):Response.error()); }); }); }));
});
