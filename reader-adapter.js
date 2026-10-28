/* Collectors Desk v0.10.4 - the one doorway the app uses to read a card photo.
   The Moose Reader module (card-reader.js) runs in a Web Worker (card-reader-worker.js), so the screen never freezes.
   If the worker will not start, errors, or runs past the time limit, the previous built-in reader (ocr.js, ocr-parse.js, ocr-read.js) takes over, so there is never a dead end.
   API:
     AppReader.read(src,{onProgress,signal,shouldStop,backImage,sport,timeoutMs}) -> {fields:{player,team,year,brand,set,number,serial,auto,rookie},engine,fellBack,timedOut,partial,ms}
        each field: {value,confidence 0..1,source,region,candidates:[{value,confidence}]}; every value the reader fills is a "check this" guess
     AppReader.readRegion(src,box,{kind:'name'|'serial'|'text'}) -> {value,candidates:[...],engine}
     AppReader.closer(card,{words,shouldStop,step,progress}) -> {res,engine,...}  the Name-screen "look closer", in the shape the help blocks use
     AppReader.quick(src,{sport}) -> the instant first pass (the built-in word read, no heavy work)
     AppReader.cfg: {useWorker,timeoutMs,regionTimeoutMs,legacyMs}   (also: localStorage mc-reader-timeout = ms, mc-reader-worker = "off")
   Everything stays on this device. */
(function(root){
'use strict';
var VER='0.10.4';
var FIELDS=['player','team','year','brand','set','number','serial','auto','rookie'];
function blank(){ var f={}; FIELDS.forEach(function(k){ f[k]={value:'',confidence:0,source:'',region:null,candidates:[]}; }); return f; }
function put(f,k,v,conf,src,region){ if(v===''||v==null) return; f[k].value=v; f[k].confidence=conf; f[k].source=src||''; if(region) f[k].region=region; cand(f,k,v,conf); }
function cand(f,k,v,conf){ if(v===''||v==null) return; var a=f[k].candidates; for(var i=0;i<a.length;i++) if(String(a[i].value)===String(v)){ if(conf>a[i].confidence) a[i].confidence=conf; return; } a.push({value:v,confidence:conf}); }
function srcBlob(s){ return s&&s.front!==undefined&&!(s instanceof Blob)?(s.front||s.back):s; }
function aborted(o){ return !!(o&&o.signal&&o.signal.aborted); }
function norm(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim(); }
var A={engine:'moose-reader',version:VER};
var cfg=A.cfg={useWorker:true,timeoutMs:40000,regionTimeoutMs:20000,legacyMs:30000,workerUrl:'card-reader-worker.js'};
try{ var _t=+localStorage.getItem('mc-reader-timeout'); if(_t>=3000) cfg.timeoutMs=_t; if(localStorage.getItem('mc-reader-worker')==='off') cfg.useWorker=false; }catch(e){}
A.workerOk=function(){ return !!(cfg.useWorker&&root.Worker&&!A._dead); };
function abs(p){ try{ return new URL(p,root.location.href).href; }catch(e){ return p; } }
/* ---- worker client: one worker for full reads, a second for drawn boxes so a box never waits behind a full read ---- */
function Pool(name){ this.name=name; this.w=null; this.n=0; this.pend={}; this.starts=0; }
Pool.prototype.spawn=function(){
  var self=this; if(this.w) return this.w; var w;
  w=new Worker(abs(cfg.workerUrl)+'?v='+VER); this.w=w; this.starts++;
  w.onmessage=function(e){ var m=e.data||{}; if(w!==self.w) return;
    if(m.fatal){ self.kill({code:'load',message:m.fatal}); A._loadFail=m.fatal; return; }
    if(m.hello){ self.ready=true; return; }
    var p=self.pend[m.id]; if(!p) return;
    if(m.progress!==undefined){ if(p.onProgress) try{ p.onProgress(normProg(m.progress)); }catch(x){} return; }
    if(m.error){ self.fin(m.id,'rej',{code:'error',message:m.error}); return; }
    if(m.done){ self.fin(m.id,'res',m.r); } };
  w.onerror=function(e){ if(w!==self.w) return; try{ e.preventDefault(); }catch(x){} self.kill({code:'load',message:(e&&e.message)||'the reader worker could not start'}); };
  return w;
};
Pool.prototype.fin=function(id,how,v){ var p=this.pend[id]; if(!p) return; delete this.pend[id]; clearTimeout(p.timer); clearInterval(p.poll); p[how](v); };
Pool.prototype.kill=function(err){ var w=this.w; this.w=null; this.ready=false; if(w){ try{ w.terminate(); }catch(e){} } var ids=Object.keys(this.pend), self=this; ids.forEach(function(id){ self.fin(id,'rej',err||{code:'aborted'}); }); };
Pool.prototype.call=function(msg,o){
  var self=this; o=o||{};
  return new Promise(function(res,rej){
    var w; try{ w=self.spawn(); }catch(e){ rej({code:'load',message:String(e&&e.message||e)}); return; }
    var id=++self.n, p=self.pend[id]={res:res,rej:rej,onProgress:o.onProgress};
    var lim=o.timeoutMs||cfg.timeoutMs;
    p.timer=setTimeout(function(){ self.kill({code:'timeout',message:'took longer than '+Math.round(lim/1000)+' s'}); },lim);
    p.poll=setInterval(function(){ if((o.shouldStop&&o.shouldStop())||(o.signal&&o.signal.aborted)) self.kill({code:'aborted'}); },300);
    msg.id=id; msg.base=abs('ocr/'); msg.dictUrl=abs('ocr-players.js'); if(o.softMs) msg.softMs=o.softMs;
    try{ w.postMessage(msg); }catch(e){ self.fin(id,'rej',{code:'error',message:String(e&&e.message||e)}); } });
};
var POOL={read:new Pool('read'),box:new Pool('box')};
A._pool=POOL;
A.cancel=function(){ POOL.read.kill({code:'aborted'}); };
A.dispose=function(){ POOL.read.kill({code:'aborted'}); POOL.box.kill({code:'aborted'}); };
/* the module sends words and {stage,done,of}. Turn both into {text,frac} so the screen can show a bar. */
var STAGE={lines:['Reading the printed words',.04,.66],serial:['Looking for a serial number',.70,.78],tiles:['Looking at the logo and design',.80,.98]};
var _frac=0;
function normProg(m){ var t='',f=null; if(m&&typeof m==='object'){ var s=STAGE[m.stage]; if(s){ t=s[0]+'…'; if(m.of) f=s[1]+(s[2]-s[1])*Math.min(1,(m.done||0)/m.of); } else t=String(m.text||m.message||''); } else t=String(m||''); return {text:t,frac:f}; }
function srcBlob(s){ return s&&s.front!==undefined&&!(s instanceof Blob)?(s.front||s.back):s; }
function aborted(o){ return !!(o&&((o.signal&&o.signal.aborted)||(o.shouldStop&&o.shouldStop()))); }
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
  return {fields:f,engine:'built-in',legacy:{low:low,names:(res&&res.names)||[],res:res,parsed:p},ms:res&&res.ms,words:words};
}
async function legacyRegion(src,box,o){
  o=o||{}; var front=srcBlob(src); if(!front||!root.CardOCR||!root.CardText) return {value:'',candidates:[]};
  var im=await root.CardOCR.loadImg(front), reads=await root.CardText.readBox(im,box,o.kind==='serial'?'serial':'text',{});
  var out=[]; (reads||[]).forEach(function(r){ var t=(r&&(r.t||r.text||r))||''; if(typeof t==='string'&&t.trim()&&out.indexOf(t.trim())<0) out.push(t.trim()); });
  return {value:out[0]||'',candidates:out.map(function(v,i){ return {value:v,confidence:Math.max(.2,.6-i*.1)}; })};
}

/* the instant first pass: the quick word read only (a few seconds, no heavy work), shaped as fields */
A.quick=async function(src,o){
  o=o||{}; var f=blank(), front=srcBlob(src); if(!front||!root.CardOCR||!root.CardParse) return {fields:f,engine:'built-in',empty:true};
  var words=[], p=null; try{ await root.CardOCR.init(function(){}); var r=await root.CardOCR.readWords(front,{shouldStop:function(){ return aborted(o); }}); words=r.words||[]; p=root.CardParse.parse(words,o.sport||'Baseball'); }catch(e){ return {fields:f,engine:'built-in',empty:true}; }
  var low=(p&&p.low)||{}, F=(p&&p.fields)||{}, ok=function(n){ return root.CardAuto&&root.CardAuto.okName?root.CardAuto.okName(n):n; };
  var pn=ok(F.player)||''; if(pn) put(f,'player',pn,.8,'printed text');
  (low.player||[]).forEach(function(x){ cand(f,'player',x.v,(x.c||50)/100); }); (low.surname||[]).forEach(function(x){ cand(f,'player',x.v,Math.min(.5,(x.c||40)/100)); });
  if(F.team) put(f,'team',F.team,.8,'printed text'); (low.team||[]).forEach(function(x){ cand(f,'team',x.v,(x.c||50)/100); });
  if(F.year) put(f,'year',+F.year,.8,'printed text'); (low.year||[]).forEach(function(x){ cand(f,'year',+x.v,(x.c||50)/100); });
  if(F.brand){ put(f,'brand',F.brand,.8,'set name or logo'); f.set.value=F.brand; f.set.confidence=.8; } (low.brand||[]).forEach(function(x){ cand(f,'brand',x.v,(x.c||50)/100); }); f.set.candidates=f.brand.candidates.slice();
  if(F.number) put(f,'number',F.number,.7,'printed text'); (low.number||[]).forEach(function(x){ cand(f,'number',x.v,(x.c||50)/100); });
  if(F.serial) put(f,'serial',F.serial,.8,'stamped number'); (low.serial||[]).forEach(function(x){ cand(f,'serial',x.v,(x.c||50)/100); });
  var fl=(p&&p.flags)||{}; if(fl.auto) put(f,'auto',true,.7,'printed text'); if(fl.rookie) put(f,'rookie',true,.7,'printed text');
  return {fields:f,engine:'built-in-quick',legacy:{low:low,names:[],parsed:p},words:words};
};
function hasAny(r){ if(!r||!r.fields) return false; return Object.keys(r.fields).some(function(k){ var x=r.fields[k]; return x&&((x.value!==''&&x.value!=null&&x.value!==false)||(x.candidates&&x.candidates.length)); }); }
function whyMsg(e){ return e&&e.code==='timeout'?'it took too long':(e&&e.code==='load'?'it did not start':'it hit a problem'); }
/* full read: worker first; the built-in reader if the worker fails, times out, or finds nothing at all */
/* the built-in stamped-number reader, used on top of the close reader when that one did not settle on a serial (it is weak on cards it has not seen; this one found 040/150 and 21/25 in v0.10.3) */
async function serialExtra(src,o,out){
  o=o||{}; if(!(root.CardSerial&&root.CardOCR&&out&&out.fields&&out.fields.serial)||out.fields.serial.value) return;
  if(o.shouldStop&&o.shouldStop()) return;
  try{ if(o.onProgress) o.onProgress({text:'Checking the stamped number…',frac:.99});
    var im=await root.CardOCR.loadImg(src), ch=root.CardSerial.loadChans(im,1200), sr=await root.CardSerial.read(ch,{stage1:14,heavy:3}), d=root.CardSerial.decide(sr.votes);
    if(!d.fill&&!(o.shouldStop&&o.shouldStop())&&root.CardRead&&root.CardRead.bandVotes){ var bv=await root.CardRead.bandVotes(im,{}); if(bv&&bv.votes&&bv.votes.length){ sr.votes=sr.votes.concat(bv.votes); d=root.CardSerial.decide(sr.votes); } }
    var f=out.fields; if(d.fill) put(f,'serial',d.fill,.8,'stamped number (built-in reader)');
    (d.suggest||[]).slice(0,3).forEach(function(x){ if(x.text) cand(f,'serial',x.text,Math.min(.6,(x.n||1)/6)); });
    out.serialExtra=d.fill||'';
  }catch(e){ out.serialExtra=''; }
}
A.read=async function(src,o){
  o=o||{}; var t0=Date.now(), why=null, out=null;
  if(root.CardReader&&root.CardReader!==A&&root.CardReader.read&&!A.workerOk()){ A.engine='CardReader'; return root.CardReader.read(src,o); }
  if(A.workerOk()){
    var tm=o.timeoutMs||cfg.timeoutMs;
    try{ out=await POOL.read.call({op:'read',blob:srcBlob(src),back:o.backImage||null,sport:o.sport||'Baseball'},{timeoutMs:tm,softMs:Math.max(3000,tm-7000),shouldStop:function(){ return aborted(o); },onProgress:o.onProgress}); }
    catch(e){ if(e&&e.code==='aborted'||aborted(o)) return {fields:blank(),engine:'moose-reader',aborted:true}; why=e; A._lastFail=e; if(e&&e.code==='load'&&POOL.read.starts>=2) A._dead=true; }
    if(out&&out.fields){ out.ms=out.ms||(Date.now()-t0); out.wall=Date.now()-t0; if(hasAny(out)||!(root.CardOCR&&root.CardRead)) { A.engine='moose-reader'; if(!out.partial&&!aborted(o)) await serialExtra(src,{shouldStop:function(){ return aborted(o); },onProgress:o.onProgress},out); return out; } why={code:'empty',message:'found nothing'}; }
  }
  A.engine='built-in'; if(o.onProgress){ try{ o.onProgress({text:why?('The close reader stopped ('+whyMsg(why)+'). Using the built-in reader…'):'Reading the printed words…',frac:null}); }catch(e){} }
  var lo=Object.assign({},o,{shouldStop:function(){ return aborted(o)||(Date.now()-t0>cfg.timeoutMs+cfg.legacyMs); }});
  var r=await legacyRead(src,lo); r.fellBack=why?(why.code||'error'):''; r.wall=Date.now()-t0; r.timedOut=!!(why&&why.code==='timeout'); return r;
};
/* a drawn box: its own worker; the built-in box reader if that fails */
A.readRegion=async function(src,box,o){
  o=o||{}; var t0=Date.now();
  if(root.CardReader&&root.CardReader!==A&&root.CardReader.readRegion&&!A.workerOk()) return root.CardReader.readRegion(src,box,o);
  if(A.workerOk()){
    try{ var r=await POOL.box.call({op:'region',blob:srcBlob(src),box:box,kind:o.kind==='serial'?'serial':(o.kind==='name'?'name':'text')},{timeoutMs:o.timeoutMs||cfg.regionTimeoutMs,shouldStop:o.shouldStop});
      if(r&&(r.value||(r.candidates&&r.candidates.length))){ r.engine='moose-reader'; r.ms=Date.now()-t0; return r; } }
    catch(e){ if(e&&e.code==='aborted') return {value:'',candidates:[],aborted:true}; A._lastFail=e; }
  }
  var g=await legacyRegion(src,box,o); g.engine='built-in'; g.fellBack=true; g.ms=Date.now()-t0; return g;
};
/* ---- Name screen: "look closer" in the shape the help blocks already use ---- */
function brandName(v){ /* the reader says "Diamond Icons"; the app's set list says "Topps Diamond Icons". Use the list's spelling when there is one. */
  var S=root.CardGuess&&root.CardGuess.SETS||[], n=norm(v); if(!n) return {name:v,set:null};
  for(var i=0;i<S.length;i++) if(norm(S[i][1])===n) return {name:S[i][1],set:S[i]};
  var hit=null; for(var j=0;j<S.length;j++){ var sn=norm(S[j][1]); if(sn.length>n.length&&sn.slice(-n.length-1)===' '+n){ if(hit){ hit=null; break; } hit=S[j]; } }
  return hit?{name:hit[1],set:hit}:{name:v,set:null};
}
A._brandName=brandName;
async function mapToRes(c,out,words,fb){
  var F=out.fields, G=root.CardGuess, R=root.CardRead, C=root.CardOCR;
  var res={serial:null,sides:{},brand:{fill:null,chips:[],ranked:[]},names:[],nameFill:null,guesses:[],backYear:null,tokens:0,ms:out.ms||0,engine:'moose-reader',partial:!!out.partial,fellBack:fb||''};
  var front=c.front||c.back, im=null; try{ im=await C.loadImg(front); res.strips={bottom:R.cropToURL(im,[.02,.7,.98,.98],0,760),top:R.cropToURL(im,[0,0,1,.2],0,760)}; res.crop=R.cropToURL(im,[.1,.76,.75,.95],0,520); }catch(e){}
  var frags=(words||[]).filter(function(w){ return /[A-Za-z]{3}/.test(w.t); }).map(function(w){ return {t:w.t,c:w.c,src:'v9'}; });
  /* the reader's player candidates become tap-to-use name chips; two or more reads of the same name count as n>=2 */
  var rn=[]; ((F.player&&F.player.candidates)||[]).forEach(function(x,i){ if(x&&x.value&&/\s/.test(String(x.value).trim())) rn.push({name:String(x.value),jr:'',n:(x.confidence>=.5||i===0&&x.confidence>=.4)?3:1,conf:x.confidence}); });
  if(G&&R){ try{ R.digest(res,frags,c); }catch(e){} }
  var legacyBrand=res.brand&&res.brand.fill||null;
  res.names=rn.concat((res.names||[]).filter(function(n){ return !rn.some(function(r){ return norm(r.name)===norm(n.name+(n.jr||'')); }); }));
  if(G){ try{ res.fromCatalog=G.fromCatalog(G.tokens(frags.concat(rn.map(function(n){ return {t:n.name,src:'v9'}; }))),res.names); }catch(e){ res.fromCatalog=res.fromCatalog||[]; } }
  /* serial */
  var sf=(F.serial&&F.serial.value)||'', sg=((F.serial&&F.serial.candidates)||[]).filter(function(x){ return x.value&&x.value!==sf&&x.confidence>=.3; }).map(function(x){ return {text:String(x.value),n:Math.max(2,Math.round(x.confidence*6))}; }).slice(0,3);
  res.serial={fill:sf,suggest:sg}; res.serialSide='front';
  /* brand: the reader's answer, spelled the way the app's set list spells it; if the old word read disagrees, fill nothing and show both as chips */
  var bv=(F.brand&&F.brand.value)||'', rb=bv?brandName(bv):null, ranked=res.brand.ranked||[];
  ((F.brand&&F.brand.candidates)||[]).slice(0,3).forEach(function(x,i){ var bn=brandName(x.value); if(bn.set&&!ranked.some(function(r){ return r.set===bn.set; })) ranked.unshift({set:bn.set,strong:true,score:50-i}); else if(!bn.set&&x.value) ranked.unshift({set:[0,x.value,'','',[],[]],strong:false,score:40-i}); });
  res.brand.ranked=ranked;
  if(rb&&(!legacyBrand||norm(legacyBrand)===norm(rb.name))) res.brand.fill=rb.name; else res.brand.fill=(rb?null:legacyBrand)||null;
  if(rb&&legacyBrand&&norm(legacyBrand)!==norm(rb.name)) res.brand.fill=null;
  res.brand.readerFill=!!rb;
  if(G&&R){ try{ var den=sf?G.denOf(sf):(c.serial?G.denOf(c.serial):''); res.guesses=G.guesses({ranked:ranked,team:c.team,den:den,auto:!!c.auto}); }catch(e){} }
  res.nameFill=(F.player&&F.player.value)||null;
  var yv=F.year&&F.year.value; if(yv&&+yv>=1948&&+yv<=2027) res.backYear={year:+yv,n:2,src:'reader'};
  return res;
}
A.closer=async function(c,o){
  o=o||{}; var t0=Date.now(), why=null, step=function(m){ try{ o.step&&o.step(m); }catch(e){} };
  var words=o.words||[];
  if(A.workerOk()){
    var tm=o.timeoutMs||cfg.timeoutMs;
    try{ var out=await POOL.read.call({op:'read',blob:o.src||c.front||c.back,back:o.backSrc||(c.back&&c.front?c.back:null),sport:c.sport||'Baseball'},{timeoutMs:tm,softMs:Math.max(3000,tm-7000),shouldStop:o.shouldStop,onProgress:function(p){ if(p.text) step(p.text); try{ o.progress&&o.progress(p); }catch(e){} }});
      if(out&&out.fields&&(hasAny(out)||!(root.CardRead&&root.CardOCR))){ if(!out.partial&&!(o.shouldStop&&o.shouldStop())) await serialExtra(o.src||c.front||c.back,{shouldStop:o.shouldStop,onProgress:function(p){ if(p.text) step(p.text); }},out); var res=await mapToRes(c,out,words); res.ms=Date.now()-t0; return {res:res,engine:'moose-reader',partial:!!out.partial}; }
      why={code:'empty',message:'found nothing'}; }
    catch(e){ if(e&&e.code==='aborted'||(o.shouldStop&&o.shouldStop())) return {aborted:true}; why=e; A._lastFail=e; if(e&&e.code==='load'&&POOL.read.starts>=2) A._dead=true; }
  }
  if(root.CardRead&&root.CardOCR){
    step(why?('The close reader stopped ('+whyMsg(why)+'). Using the built-in reader…'):'Looking closer…'); try{ o.progress&&o.progress({text:'Using the built-in reader…',frac:null,fallback:true}); }catch(e){}
    var extra=words.filter(function(w){ return /[A-Za-z]{3}/.test(w.t); }).map(function(w){ return {t:w.t,c:w.c,src:'v9'}; });
    var res2=await root.CardRead.run(c,{fast:true,extraFrags:extra,shouldStop:function(){ return (o.shouldStop&&o.shouldStop())||(Date.now()-t0>cfg.timeoutMs+cfg.legacyMs); },step:step});
    if(o.shouldStop&&o.shouldStop()) return {aborted:true};
    res2.engine='built-in'; res2.fellBack=why?(why.code||'error'):''; return {res:res2,engine:'built-in',fellBack:res2.fellBack,timedOut:!!(why&&why.code==='timeout')};
  }
  return {res:null,engine:'none',failed:why||{code:'error',message:'no reader available'}};
};
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
