/* Collectors Desk v0.10.4 - runs the card reader in a Web Worker so the screen never freezes. Offline. Nothing is sent anywhere.
   Messages in : {id, op:'read'|'region', blob, back, box, kind, base, dictUrl, sport}
   Messages out: {hello:true} | {id, progress:<string|object>} | {id, done:true, r} | {id, error:'...'} | {fatal:'...'} */
'use strict';
var loaded=false;
try{ importScripts(new URL('card-reader.js?v=0.10.4',self.location.href).href); loaded=!!(self.CardReader&&self.CardReader.read); }catch(e){ postMessage({fatal:String(e&&e.message||e)}); }
if(loaded) postMessage({hello:true}); else if(!self.CardReader) postMessage({fatal:'the reader file did not load'});
function plain(o){ try{ return JSON.parse(JSON.stringify(o)); }catch(e){ return null; } }
onmessage=async function(e){
  var m=e.data||{}, id=m.id;
  if(!loaded){ postMessage({id:id,error:'the reader file did not load'}); return; }
  try{
    /* "signal" is a small object whose .aborted turns true when the soft time budget is spent, so the reader stops by itself and hands back what it has so far */
    var t0=Date.now(), soft=m.softMs||0, sig={}; Object.defineProperty(sig,'aborted',{get:function(){ return !!(soft&&Date.now()-t0>soft); }});
    var o={base:m.base,dictUrl:m.dictUrl,sport:m.sport,backImage:m.back||undefined,signal:sig,onProgress:function(p){ try{ postMessage({id:id,progress:p}); }catch(x){} }};
    if(m.op==='region'){ var r2=await self.CardReader.readRegion(m.blob,m.box,{kind:m.kind,base:m.base,dictUrl:m.dictUrl}); postMessage({id:id,done:true,r:plain(r2)}); return; }
    var r=await self.CardReader.read(m.blob,o); var pr=plain(r); if(pr) pr.partial=!!sig.aborted; postMessage({id:id,done:true,r:pr});
  }catch(err){ postMessage({id:id,error:String(err&&err.message||err)}); }
};
