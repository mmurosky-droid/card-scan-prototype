/* Collectors Desk v0.10 - on-device card reader.
   tesseract.js + wasm + English data are bundled in ./ocr/ (same origin, works offline, no CDN).
   Photos never leave the device. This file: loading, image preparation, running the passes.
   Matching/parsing lives in ocr-parse.js so it can be tested without a browser. */
(function(){
'use strict';
var BASE=(function(){ try{ var s=document.currentScript&&document.currentScript.src; if(s) return s.replace(/[^\/]*(\?.*)?$/,'')+'ocr/'; }catch(e){} return 'ocr/'; })();
var ST={w:null,loading:null,failed:null,ready:false};
function loadScript(src){ return new Promise(function(res,rej){ if(window.Tesseract) return res(); var s=document.createElement('script'); s.src=src; s.onload=function(){res()}; s.onerror=function(){rej(new Error('The reader files did not load'))}; document.head.appendChild(s); }); }
function init(onStatus){
  if(ST.w) return Promise.resolve(ST.w);
  if(ST.failed) return Promise.reject(ST.failed);
  if(ST.loading) return ST.loading;
  ST.loading=(async function(){
    try{
      if(onStatus) onStatus('Getting the reader ready (about 7 MB, once)…');
      await loadScript(BASE+'tesseract.min.js?v=0.10');
      var w=await Tesseract.createWorker('eng',1,{workerPath:BASE+'worker.min.js?v=0.10',corePath:BASE,langPath:BASE,gzip:true,logger:function(){}});
      ST.w=w; ST.ready=true; return w;
    }catch(e){ ST.failed=e; ST.loading=null; throw e; }
  })();
  return ST.loading;
}
function loadImg(blob){ return new Promise(function(res,rej){ var u=URL.createObjectURL(blob), im=new Image(); im.onload=function(){ URL.revokeObjectURL(u); res(im); }; im.onerror=function(){ URL.revokeObjectURL(u); rej(new Error('photo did not open')); }; im.src=u; }); }
/* crop a region (fractions of the photo), scale to a target width, grayscale + stretch contrast; optional invert / threshold */
function prep(im,r,tw,o){
  o=o||{}; var sx=Math.round(r[0]*im.naturalWidth), sy=Math.round(r[1]*im.naturalHeight), sw=Math.round((r[2]-r[0])*im.naturalWidth), sh=Math.round((r[3]-r[1])*im.naturalHeight);
  var sc=tw/sw, w=Math.round(sw*sc), h=Math.round(sh*sc), cv=document.createElement('canvas'); cv.width=w; cv.height=h;
  var cx=cv.getContext('2d',{willReadFrequently:true}); cx.imageSmoothingQuality='high'; cx.drawImage(im,sx,sy,sw,sh,0,0,w,h);
  var d=cx.getImageData(0,0,w,h), a=d.data, n=w*h, g=new Uint8Array(n), hist=new Uint32Array(256), i;
  for(i=0;i<n;i++){ var v=o.ch==='max'?Math.max(a[i*4],a[i*4+1],a[i*4+2]):o.ch==='r'?a[i*4]:o.ch==='y'?Math.max(0,Math.min(255,(a[i*4]+a[i*4+1])/2-a[i*4+2]*0.6|0)):(a[i*4]*299+a[i*4+1]*587+a[i*4+2]*114)/1000|0; g[i]=v; hist[v]++; }
  var lo=0,hi=255,acc=0; for(i=0;i<256;i++){ acc+=hist[i]; if(acc>n*0.02){lo=i;break;} } acc=0; for(i=255;i>=0;i--){ acc+=hist[i]; if(acc>n*0.02){hi=i;break;} }
  if(hi-lo<30){ lo=Math.max(0,lo-20); hi=Math.min(255,hi+20); }
  var k=255/(hi-lo), t=0;
  if(o.thresh){ /* Otsu */ var tot=n,sum=0,sB=0,wB=0,mx=0; var sm=new Uint32Array(256); for(i=0;i<n;i++){ var s2=Math.max(0,Math.min(255,((g[i]-lo)*k)|0)); sm[s2]++; } for(i=0;i<256;i++) sum+=i*sm[i]; for(i=0;i<256;i++){ wB+=sm[i]; if(!wB) continue; var wF=tot-wB; if(!wF) break; sB+=i*sm[i]; var mB=sB/wB, mF=(sum-sB)/wF, bt=wB*wF*(mB-mF)*(mB-mF); if(bt>mx){mx=bt;t=i;} } }
  for(i=0;i<n;i++){ var s=Math.max(0,Math.min(255,((g[i]-lo)*k)|0)); if(o.thresh) s=s>t?255:0; if(o.invert) s=255-s; a[i*4]=a[i*4+1]=a[i*4+2]=s; a[i*4+3]=255; }
  cx.putImageData(d,0,0); return cv;
}
var PASSES=[
  {id:'full',   r:[0,0,1,1],      w:1300, psm:11},
  {id:'bottom', r:[0,.68,1,1],    w:1500, psm:11},
  {id:'bottomT',r:[0,.68,1,1],    w:1500, psm:11, thresh:1},
  {id:'bottomI',r:[0,.68,1,1],    w:1500, psm:11, invert:1},
  {id:'top',    r:[0,0,1,.25],    w:1500, psm:11},
  {id:'topI',   r:[0,0,1,.25],    w:1500, psm:11, invert:1}
];
var sleep=function(ms){return new Promise(function(r){setTimeout(r,ms)})};
/* returns {words:[{t,c,pass,x0,y0,x1,y1}], ms} */
async function readWords(blob,opts){
  opts=opts||{}; var w=await init(opts.onStatus), im=await loadImg(blob), words=[], t0=Date.now(), ps=opts.passes||PASSES;
  for(var i=0;i<ps.length;i++){
    var p=ps[i]; if(opts.shouldStop&&opts.shouldStop()) break;
    var cv=prep(im,p.r,p.w,p); await sleep(0);
    await w.setParameters({tessedit_pageseg_mode:String(p.psm),tessedit_char_whitelist:p.wl||''});
    var rr=await Promise.race([w.recognize(cv),sleep(45000).then(function(){throw new Error('took too long')})]);
    var ws=(rr.data.words||[]);
    ws.forEach(function(x){ var t=(x.text||'').trim(); if(!t) return; words.push({t:t,c:Math.round(x.confidence),pass:p.id,x0:x.bbox.x0/cv.width,y0:p.r[1]+(x.bbox.y0/cv.height)*(p.r[3]-p.r[1]),x1:x.bbox.x1/cv.width,y1:p.r[1]+(x.bbox.y1/cv.height)*(p.r[3]-p.r[1])}); });
    if(opts.onPass) opts.onPass(p.id,i+1,ps.length);
  }
  cv=null; return {words:words,ms:Date.now()-t0};
}
async function stop(){ if(ST.w){ try{ await ST.w.terminate(); }catch(e){} ST.w=null; ST.loading=null; ST.ready=false; } }
/* v0.10: one-off read of a ready-made canvas (used by the serial reader, the brand reader and the draw-a-box tool). Calls are queued so they never overlap. */
var Q=Promise.resolve();
function recognize(cv,o){
  o=o||{}; var job=Q.then(async function(){
    var w=await init(); await w.setParameters({tessedit_pageseg_mode:String(o.psm||7),tessedit_char_whitelist:o.wl||'',user_defined_dpi:'300'});
    return Promise.race([w.recognize(cv),sleep(30000).then(function(){throw new Error('took too long')})]);
  }); Q=job.catch(function(){}); return job;
}
window.CardOCR={init:init,readWords:readWords,recognize:recognize,loadImg:loadImg,PASSES:PASSES,stop:stop,state:ST};
})();
