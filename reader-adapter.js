/* Collectors Desk v0.10.3 - the one doorway the app uses to read a card photo.
   API (so a different reader module can be dropped in later by defining window.CardReader):
     CardReader.read(imageSource,{onProgress,signal,backImage,sport}) -> {fields:{player,team,year,brand,set,number,serial,auto,rookie}}
        each field: {value,confidence 0..1,source,region,candidates:[{value,confidence}]}
     CardReader.readRegion(imageSource,box,{kind}) -> {value,candidates:[...]}    (box = fractions [x0,y0,x1,y1])
   If window.CardReader exists the app uses it. Otherwise this file wraps the built-in reader (ocr.js, ocr-parse.js, ocr-read.js).
   Everything stays on this device. */
(function(root){
'use strict';
var FIELDS=['player','team','year','brand','set','number','serial','auto','rookie'];
function blank(){ var f={}; FIELDS.forEach(function(k){ f[k]={value:'',confidence:0,source:'',region:null,candidates:[]}; }); return f; }
function put(f,k,v,conf,src,region){ if(v===''||v==null) return; f[k].value=v; f[k].confidence=conf; f[k].source=src||''; if(region) f[k].region=region; cand(f,k,v,conf); }
function cand(f,k,v,conf){ if(v===''||v==null) return; var a=f[k].candidates; for(var i=0;i<a.length;i++) if(String(a[i].value)===String(v)){ if(conf>a[i].confidence) a[i].confidence=conf; return; } a.push({value:v,confidence:conf}); }
function srcBlob(s){ return s&&s.front!==undefined&&!(s instanceof Blob)?(s.front||s.back):s; }
function aborted(o){ return !!(o&&o.signal&&o.signal.aborted); }
function norm(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim(); }
var A={engine:'built-in'};
/* ---- the built-in reader, shaped as the CardReader API ---- */
async function legacyRead(src,o){
  o=o||{}; var f=blank(), step=function(m){ try{ o.onProgress&&o.onProgress(m); }catch(e){} };
  var front=srcBlob(src); if(!front) return {fields:f,engine:'built-in',empty:true};
  var sport=o.sport||'Baseball', ok=function(n){ return root.CardAuto&&root.CardAuto.okName?root.CardAuto.okName(n):n; };
  var words=[], p=null, res=null;
  if(root.CardOCR&&root.CardParse){
    step('Reading the printed words…');
    try{ var r=await root.CardOCR.readWords(front,{}); words=r.words||[]; p=root.CardParse.parse(words,sport); }catch(e){ if(aborted(o)) throw e; }
  }
  if(aborted(o)) return {fields:f,engine:'built-in',aborted:true};
  var c={front:front,back:o.backImage||null,sport:sport,serial:'',auto:false,team:''};
  if(root.CardRead&&root.CardGuess&&root.CardSerial&&root.CardText){
    var extra=words.filter(function(w){ return /[A-Za-z]{3}/.test(w.t); }).map(function(w){ return {t:w.t,c:w.c,src:'v9'}; });
    try{ res=await root.CardRead.run(c,{fast:true,extraFrags:extra,shouldStop:function(){ return aborted(o); },step:step}); }catch(e){ res=null; }
  }
  var low=(p&&p.low)||{}, F=(p&&p.fields)||{};
  /* player: only a clean "First Last"; weaker names stay candidates */
  var pn=ok(F.player)||ok(res&&res.nameFill)||''; if(pn) put(f,'player',pn,.8,res&&res.nameFill?'sideways name read':'printed text');
  ((low.player)||[]).forEach(function(x){ cand(f,'player',x.v,(x.c||50)/100); });
  ((low.surname)||[]).forEach(function(x){ cand(f,'player',x.v,Math.min(.5,(x.c||40)/100)); });
  ((res&&res.names)||[]).forEach(function(n){ if(n.name) cand(f,'player',n.name+(n.jr?' '+n.jr:''),Math.min(.7,(n.n||1)/10)); });
  if(F.team) put(f,'team',F.team,.8,'printed text'); (low.team||[]).forEach(function(x){ cand(f,'team',x.v,(x.c||50)/100); });
  var yr=F.year; if(res&&res.backYear&&res.backYear.n>=2&&!yr) yr=res.backYear.year; if(yr) put(f,'year',+yr,.8,'printed text'); (low.year||[]).forEach(function(x){ cand(f,'year',+x.v,(x.c||50)/100); });
  var br=F.brand||(res&&res.brand&&res.brand.fill)||''; if(br){ put(f,'brand',br,.8,'set name or logo'); f.set.value=br; f.set.confidence=.8; f.set.source='set name or logo'; }
  (low.brand||[]).forEach(function(x){ cand(f,'brand',x.v,(x.c||50)/100); });
  ((res&&res.brand&&res.brand.ranked)||[]).slice(0,4).forEach(function(r,i){ if(r.set&&r.set[1]) cand(f,'brand',r.set[1],Math.max(.2,.5-i*.1)); });
  f.set.candidates=f.brand.candidates.slice();
  if(F.number) put(f,'number',F.number,.7,'printed text'); (low.number||[]).forEach(function(x){ cand(f,'number',x.v,(x.c||50)/100); });
  var sf=F.serial||(res&&res.serial&&res.serial.fill)||''; if(sf) put(f,'serial',sf,.8,'stamped number');
  (low.serial||[]).forEach(function(x){ cand(f,'serial',x.v,(x.c||50)/100); });
  ((res&&res.serial&&res.serial.suggest)||[]).forEach(function(x){ if(x.text) cand(f,'serial',x.text,Math.min(.6,(x.n||1)/6)); });
  var fl=(p&&p.flags)||{}; if(fl.auto) put(f,'auto',true,.7,'printed text'); if(fl.rookie) put(f,'rookie',true,.7,'printed text');
  return {fields:f,engine:'built-in',legacy:{low:low,names:(res&&res.names)||[],res:res,parsed:p},ms:res&&res.ms};
}
async function legacyRegion(src,box,o){
  o=o||{}; var front=srcBlob(src); if(!front||!root.CardOCR||!root.CardText) return {value:'',candidates:[]};
  var im=await root.CardOCR.loadImg(front), reads=await root.CardText.readBox(im,box,o.kind==='serial'?'serial':'text',{});
  var out=[]; (reads||[]).forEach(function(r){ var t=(r&&(r.t||r.text||r))||''; if(typeof t==='string'&&t.trim()&&out.indexOf(t.trim())<0) out.push(t.trim()); });
  return {value:out[0]||'',candidates:out.map(function(v,i){ return {value:v,confidence:Math.max(.2,.6-i*.1)}; })};
}
A.read=function(src,o){ if(root.CardReader&&root.CardReader!==A&&root.CardReader.read){ A.engine='CardReader'; return Promise.resolve(root.CardReader.read(src,o)); } A.engine='built-in'; return legacyRead(src,o); };
A.readRegion=function(src,box,o){ if(root.CardReader&&root.CardReader!==A&&root.CardReader.readRegion) return Promise.resolve(root.CardReader.readRegion(src,box,o)); return legacyRegion(src,box,o); };
/* ---- names from the bundled player list and your saved cards, for the type-the-name box ---- */
A.suggestNames=function(q,max){
  max=max||6; var s=norm(q); if(s.length<2||!root.CardAuto) return [];
  var toks=s.split(' '), out=[], seen={};
  function add(nm,why){ var k=norm(nm); if(seen[k]) return; seen[k]=1; out.push({name:nm,why:why}); }
  function match(nm){ var n=norm(nm).split(' '); return toks.every(function(t,i){ return n.some(function(w){ return w.indexOf(t)===0; }); }) && (toks.length>1||n[n.length-1].indexOf(toks[0])===0||n[0].indexOf(toks[0])===0); }
  try{ JSON.parse(localStorage.getItem('mc-catalog')||'[]').forEach(function(e){ if(e.player&&match(e.player)) add(e.player,'from your saved cards'); }); }catch(e){}
  if(out.length<max){ var I=root.CardAuto.index&&root.CardAuto.index(); if(I){ var last=toks[toks.length-1], keys=toks.length>1?(I.byLast[last]||[]).concat(Object.keys(I.byLast).filter(function(k){return k!==last&&k.indexOf(last)===0&&last.length>=3}).reduce(function(a,k){return a.concat(I.byLast[k])},[])):Object.keys(I.byLast).filter(function(k){return k.indexOf(toks[0])===0&&toks[0].length>=3}).reduce(function(a,k){return a.concat(I.byLast[k])},[]);
      if(toks.length===1&&toks[0].length>=3){ var more=[]; Object.keys(I.byKey).forEach(function(k){ if(more.length<60&&k.split(' ')[0].indexOf(toks[0])===0) more=more.concat(I.byKey[k]); }); keys=keys.concat(more); }
      keys.forEach(function(e){ if(out.length<max&&match(e.name)) add(e.name,'from the bundled player list'); }); } }
  return out.slice(0,max);
};
root.AppReader=A;
})(window);
