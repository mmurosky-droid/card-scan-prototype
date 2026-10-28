/* Moose Reader - offline card reader (tesseract.js + on-device shape matching). No network, no generative AI. Built 2026-10-28T18:59:34.937Z (templates: all) */
(function(root){ 'use strict';
/* Moose Reader core: image helpers, text-line proposals, OCR collection.  (concatenated into reader.js by build.js) */
var CFG={
  base:'ocr/',            // folder with tesseract.min.js, worker.min.js, core wasm, eng.traineddata.gz
  srcLong:1600,           // source is scaled so its long edge is this (up to 2x upscale, never above the original unless small)
  propLong:1000,          // text-line proposals are found on a copy with this long edge
  maxLines:{0:16,90:9,270:9}, // OCR budget: line proposals per rotation frame
  maxSerial:10,           // small-digit proposals read with the digit whitelist
  preps:['g','b'],        // preprocessing votes per line
  ocrTimeout:20000
};
var now=function(){return (typeof performance!=='undefined'?performance.now():Date.now());};
function mkCanvas(w,h){ var c; if(typeof document!=='undefined'){ c=document.createElement('canvas'); } else { c=new OffscreenCanvas(w,h); } c.width=Math.max(1,Math.round(w)); c.height=Math.max(1,Math.round(h)); return c; }
function ctx2(c){ return c.getContext('2d',{willReadFrequently:true}); }
function dimsOf(s){ return {w:s.naturalWidth||s.videoWidth||s.width, h:s.naturalHeight||s.videoHeight||s.height}; }
async function toCanvas(src,longTarget){
  if(typeof src==='string') src=await (await fetch(src)).blob();
  if(typeof Blob!=='undefined' && src instanceof Blob) src=await createImageBitmap(src);
  var d=dimsOf(src), L=Math.max(d.w,d.h), t=longTarget;
  // keep resolution: shrink big photos, enlarge small ones up to 2x (resampling helps OCR of tiny print)
  var s=L>t?t/L:Math.min(2,Math.max(1,(t*0.75)/L)); if(L>=t*0.75&&L<=t) s=1;
  var c=mkCanvas(d.w*s,d.h*s), x=ctx2(c); x.imageSmoothingEnabled=true; x.imageSmoothingQuality='high'; x.drawImage(src,0,0,c.width,c.height); return c;
}
function rotCanvas(c,rot){ if(!rot) return c; var w=c.width,h=c.height,o=mkCanvas(h,w),x=ctx2(o); if(rot===90){x.translate(h,0);x.rotate(Math.PI/2);} else if(rot===270){x.translate(0,w);x.rotate(-Math.PI/2);} x.drawImage(c,0,0); return o; }
function scaleTo(c,long){ var L=Math.max(c.width,c.height), s=long/L; if(Math.abs(s-1)<0.02) return c; var o=mkCanvas(c.width*s,c.height*s),x=ctx2(o); x.imageSmoothingQuality='high'; x.drawImage(c,0,0,o.width,o.height); return o; }
function grayOf(c,ch){ var w=c.width,h=c.height,d=ctx2(c).getImageData(0,0,w,h).data,n=w*h,g=new Uint8Array(n),i,j; if(ch==='G'){ for(i=0,j=0;i<n;i++,j+=4) g[i]=d[j+1]; } else if(ch==='v'){ for(i=0,j=0;i<n;i++,j+=4){ var a=d[j],b=d[j+1],e=d[j+2],mx=a>b?(a>e?a:e):(b>e?b:e),mn=a<b?(a<e?a:e):(b<e?b:e),v=((a*77+b*151+e*28)>>8)+1.6*(mx-mn); g[i]=v>255?255:v; } } else for(i=0,j=0;i<n;i++,j+=4) g[i]=(d[j]*77+d[j+1]*151+d[j+2]*28)>>8; return g; }
function integral(g,w,h){ var I=new Float64Array((w+1)*(h+1)); for(var y=0;y<h;y++){ var row=0; for(var x=0;x<w;x++){ row+=g[y*w+x]; I[(y+1)*(w+1)+x+1]=I[y*(w+1)+x+1]+row; } } return I; }
function boxMean(I,w,h,x0,y0,x1,y1){ x0=Math.max(0,x0);y0=Math.max(0,y0);x1=Math.min(w,x1);y1=Math.min(h,y1); var a=I[y1*(w+1)+x1]-I[y0*(w+1)+x1]-I[y1*(w+1)+x0]+I[y0*(w+1)+x0]; return a/((x1-x0)*(y1-y0)); }

/* ink masks: dark text on light, and light text on dark, by local contrast */
function inkMasks(g,w,h){
  var I=integral(g,w,h), r=Math.max(12,Math.round(Math.max(w,h)*0.035)), dark=new Uint8Array(w*h), light=new Uint8Array(w*h), T=13;
  for(var y=0;y<h;y++) for(var x=0;x<w;x++){ var m=boxMean(I,w,h,x-r,y-r,x+r+1,y+r+1), d=g[y*w+x]-m; if(d<-T) dark[y*w+x]=1; else if(d>T) light[y*w+x]=1; }
  return {dark:dark,light:light};
}
/* run-length smearing + connected components on runs; returns boxes with ink stats */
function boxesFrom(ink,w,h,gap,lim){
  var runsY=[], starts=new Int32Array(h+1), cnt=0, ys,xs,xe,ic=[];
  var S=[],E=[],P=[]; // run arrays
  for(var y=0;y<h;y++){ starts[y]=S.length; var x=0,o=y*w; while(x<w){ if(!ink[o+x]){x++;continue;} var s=x,e=x,n=1; x++; while(x<w){ if(ink[o+x]){ n++; e=x; x++; } else if(x-e<=gap){ x++; } else break; } S.push(s);E.push(e);P.push(n); } }
  starts[h]=S.length; var R=S.length, par=new Int32Array(R); for(var i=0;i<R;i++) par[i]=i;
  var find=function(a){ while(par[a]!==a){ par[a]=par[par[a]]; a=par[a]; } return a; };
  for(y=0;y<h-1;y++){ var a=starts[y],ae=starts[y+1],b=starts[y+1],be=starts[y+2]; while(a<ae&&b<be){ if(S[a]<=E[b]&&S[b]<=E[a]){ var ra=find(a),rb=find(b); if(ra!==rb) par[ra]=rb; } if(E[a]<E[b]) a++; else b++; } }
  var comp=new Map(); 
  for(y=0;y<h;y++) for(i=starts[y];i<starts[y+1];i++){ var r=find(i), c=comp.get(r); if(!c){ c={x0:S[i],x1:E[i],y0:y,y1:y,ink:0}; comp.set(r,c);} if(S[i]<c.x0)c.x0=S[i]; if(E[i]>c.x1)c.x1=E[i]; c.y1=y; c.ink+=P[i]; }
  var out=[]; comp.forEach(function(c){ var bw=c.x1-c.x0+1,bh=c.y1-c.y0+1; if(bh<lim.hMin||bh>lim.hMax||bw<bh*lim.aspect||bw>w*0.98) return; var fill=c.ink/(bw*bh); if(fill<0.07||fill>0.8) return; c.w=bw;c.h=bh;c.fill=fill; out.push(c); });
  return out;
}
/* count letter-like segments per row inside a box (text has many stroke runs per row) */
function strokeStats(ink,w,x0,y0,x1,y1){
  var rows=0,segs=0,ys=Math.round(y0+(y1-y0)*0.2),ye=Math.round(y1-(y1-y0)*0.2); if(ye<=ys){ys=y0;ye=y1;}
  for(var y=ys;y<=ye;y++){ var prev=0,sc=0; for(var x=x0;x<=x1;x++){ var v=ink[y*w+x]; if(v&&!prev) sc++; prev=v; } if(sc){ rows++; segs+=sc; } }
  return rows?segs/rows:0;
}
function iou(a,b){ var ix=Math.max(0,Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0)+1), iy=Math.max(0,Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0)+1), I=ix*iy, U=a.w*a.h+b.w*b.h-I; return I/U; }
function nms(list,thr){ list.sort(function(a,b){return b.score-a.score}); var keep=[]; for(var i=0;i<list.length;i++){ var ok=true; for(var j=0;j<keep.length;j++){ var k=keep[j]; var ix=Math.max(0,Math.min(list[i].x1,k.x1)-Math.max(list[i].x0,k.x0)+1), iy=Math.max(0,Math.min(list[i].y1,k.y1)-Math.max(list[i].y0,k.y0)+1), inter=ix*iy, mn=Math.min(list[i].w*list[i].h,k.w*k.h); var hr=Math.min(list[i].h,k.h)/Math.max(list[i].h,k.h); if(iou(list[i],k)>thr||(inter/mn>0.8&&hr>0.65)){ ok=false; break; } } if(ok) keep.push(list[i]); } return keep; }

/* Proposals of text-like line boxes in a gray frame. Returns [{x0,y0,x1,y1,w,h,pol,score,kind}] in frame pixels */
function proposeLines(g,w,h){
  var L=Math.max(w,h), masks=inkMasks(g,w,h), all=[];
  var lim={hMin:Math.max(7,Math.round(L*0.007)),hMax:Math.round(L*0.075),aspect:2.0};
  [['dark',masks.dark],['light',masks.light]].forEach(function(pp){
    [Math.round(L*0.009),Math.round(L*0.02),Math.round(L*0.04),Math.round(L*0.065)].forEach(function(gap){
      boxesFrom(pp[1],w,h,gap,lim).forEach(function(c){
        var seg=strokeStats(pp[1],w,c.x0,c.y0,c.x1,c.y1); if(seg<2.2) return;
        var asp=Math.min(c.w/c.h,14)/14, fillS=1-Math.min(1,Math.abs(c.fill-0.33)/0.33), segS=Math.min(seg,9)/9;
        c.pol=pp[0]; c.seg=seg; c.score=0.45*segS+0.3*asp+0.25*fillS; c.kind=(c.h<L*0.022?'small':'line'); all.push(c);
      });
    });
  });
  var R=nms(all,0.45);
  /* merge neighbours: pieces of one big-lettered line (words split by wide gaps) become one union candidate */
  var extra=[]; ['dark','light'].forEach(function(pol){ var P=R.filter(function(c){return c.pol===pol&&c.h<L*0.075}).sort(function(a,b){return a.x0-b.x0}), used={};
    for(var i=0;i<P.length;i++){ var ch=[P[i]], last=P[i]; for(var j=i+1;j<P.length;j++){ var q=P[j], oy=Math.min(last.y1,q.y1)-Math.max(last.y0,q.y0), hh=Math.max(last.h,q.h), gap=q.x0-last.x1;
        if(oy>=0.6*Math.min(last.h,q.h)&&Math.min(last.h,q.h)>=0.45*hh&&gap>=-0.1*hh&&gap<=2*hh){ ch.push(q); last=q; } }
      if(ch.length>=2){ var u={x0:ch[0].x0,x1:ch[ch.length-1].x1,y0:Math.min.apply(null,ch.map(function(a){return a.y0})),y1:Math.max.apply(null,ch.map(function(a){return a.y1})),pol:pol,seg:ch.reduce(function(s,a){return s+a.seg},0)/ch.length,fill:ch.reduce(function(s,a){return s+a.fill},0)/ch.length,score:Math.max.apply(null,ch.map(function(a){return a.score}))+0.04,merged:ch.length};
        u.w=u.x1-u.x0+1; u.h=u.y1-u.y0+1; u.kind=(u.h<L*0.022?'small':'line'); extra.push(u); } } });
  return R.concat(extra);
}

/* ---------- OCR worker (tesseract.js, bundled, offline) ---------- */
var ST={w:null,loading:null,cur:{},Q:Promise.resolve(),calls:0};
function loadScript(src){ return new Promise(function(res,rej){ if(root.Tesseract) return res(); if(typeof document==='undefined'&&typeof importScripts==='function'){ try{ importScripts(src); return res(); }catch(e){ return rej(new Error('Could not load the reader files')); } } var s=document.createElement('script'); s.src=src; s.onload=function(){res()}; s.onerror=function(){rej(new Error('Could not load the reader files'))}; document.head.appendChild(s); }); }
function sleep(ms){ return new Promise(function(r){setTimeout(r,ms)}); }
async function getWorker(){
  if(ST.w) return ST.w; if(ST.loading) return ST.loading;
  ST.loading=(async function(){
    var B=CFG.base; try{ B=new URL(CFG.base,(typeof document!=='undefined'&&document.baseURI)||root.location.href).href; }catch(e){} /* absolute: tesseract's own worker is a blob and cannot resolve relative paths */
    if(!root.Tesseract) await loadScript(B+'tesseract.min.js');
    var w=await root.Tesseract.createWorker('eng',1,{workerPath:B+'worker.min.js',corePath:B,langPath:B,gzip:true,logger:function(){}});
    ST.w=w; return w;
  })();
  return ST.loading;
}
/* queued recognize of a canvas; opts {psm, wl} -> {text, conf, words:[{t,c,x0,y0,x1,y1}]} */
function ocr(cv,o){
  o=o||{}; var job=ST.Q.then(async function(){
    var w=await getWorker(), key=(o.psm||7)+'|'+(o.wl||'');
    if(ST.cur.key!==key){ await w.setParameters({tessedit_pageseg_mode:String(o.psm||7),tessedit_char_whitelist:o.wl||'',user_defined_dpi:'300'}); ST.cur.key=key; }
    ST.calls++;
    var r=await Promise.race([w.recognize(cv),sleep(CFG.ocrTimeout).then(function(){throw new Error('took too long')})]);
    var d=r.data, words=(d.words||[]).map(function(x){ return {t:(x.text||'').trim(),c:Math.round(x.confidence),x0:x.bbox.x0,y0:x.bbox.y0,x1:x.bbox.x1,y1:x.bbox.y1}; }).filter(function(x){return x.t});
    return {text:(d.text||'').replace(/\s+/g,' ').trim(),conf:Math.round(d.confidence||0),words:words};
  }); ST.Q=job.catch(function(){}); return job;
}

/* ---------- crops and per-crop preprocessing ---------- */
/* crop box (frame pixels, scaled by k to the high-res frame) with padding; scaled so the TEXT height is about textH px; returns canvas + scale */
function cropFor(F,box,k,textH,padX,padY){
  var bh=(box.y1-box.y0+1)*k, bw=(box.x1-box.x0+1)*k, px=padX*bh, py=padY*bh;
  var sx=Math.max(0,Math.floor(box.x0*k-px)), sy=Math.max(0,Math.floor(box.y0*k-py)), ex=Math.min(F.width,Math.ceil(box.x1*k+px)), ey=Math.min(F.height,Math.ceil(box.y1*k+py));
  var sw=ex-sx, sh=ey-sy, s=Math.max(0.5,Math.min(5,textH/bh)); if(sw*s>2600) s=2600/sw;
  var c=mkCanvas(sw*s,sh*s), x=ctx2(c); x.imageSmoothingQuality='high'; x.drawImage(F,sx,sy,sw,sh,0,0,c.width,c.height); return {cv:c,scale:s,sx:sx,sy:sy};
}
function percentile(g,p){ var h=new Uint32Array(256),n=g.length,i; for(i=0;i<n;i++) h[g[i]]++; var acc=0,t=n*p; for(i=0;i<256;i++){ acc+=h[i]; if(acc>=t) return i; } return 255; }
/* prep variants -> canvases with dark text on a light ground. pol is the polarity of the proposal ('dark'|'light'|'any'). */
function prepCanvas(cv,kind,pol,textH){
  var w=cv.width,h=cv.height,x=ctx2(cv),d=x.getImageData(0,0,w,h),a=d.data,n=w*h,g=new Uint8Array(n),i,j;
  if(kind==='y'){ /* warm/colored ink: how far a pixel is from neutral, as dark text (autographs, purple/blue print) */
    for(i=0,j=0;i<n;i++,j+=4){ var r=a[j],gg=a[j+1],b=a[j+2],mx=Math.max(r,gg,b),mn=Math.min(r,gg,b); g[i]=255-Math.min(255,(mx-mn)*2.2|0); }
  } else if(kind==='G'||kind==='Gb'){ for(i=0,j=0;i<n;i++,j+=4) g[i]=a[j+1];
  } else if(kind==='v'||kind==='w'||kind==='W'){ for(i=0,j=0;i<n;i++,j+=4){ var p1=a[j],p2=a[j+1],p3=a[j+2],mx=p1>p2?(p1>p3?p1:p3):(p2>p3?p2:p3),mn=p1<p2?(p1<p3?p1:p3):(p2<p3?p2:p3),v=((p1*77+p2*151+p3*28)>>8)+1.6*(mx-mn); g[i]=v>255?255:v; } }
  else for(i=0,j=0;i<n;i++,j+=4) g[i]=(a[j]*77+a[j+1]*151+a[j+2]*28)>>8;
  var lo=percentile(g,0.02),hi=percentile(g,0.98); if(hi-lo<24){ lo=Math.max(0,lo-12); hi=Math.min(255,hi+12); } var k=255/(hi-lo);
  for(i=0;i<n;i++){ var v=((g[i]-lo)*k)|0; g[i]=v<0?0:v>255?255:v; }
  if(pol==='light'&&kind!=='y') for(i=0;i<n;i++) g[i]=255-g[i];
  var out=g;
  if(kind==='b'||kind==='B'||kind==='w'||kind==='W'||kind==='Gb'){ /* adaptive threshold with a window of about 1.3 text heights */
    var I=integral(g,w,h), r2=Math.max(8,Math.round(textH*((kind==='B'||kind==='W')?2.2:1.1))), bo=new Uint8Array(n), off=(kind==='B'||kind==='W')?10:7;
    for(var yy=0;yy<h;yy++) for(var xx=0;xx<w;xx++){ var m=boxMean(I,w,h,xx-r2,yy-r2,xx+r2+1,yy+r2+1); bo[yy*w+xx]=g[yy*w+xx]<m-off?0:255; }
    out=bo;
  }
  var pad=Math.round(textH*0.35), W=w+2*pad, H=h+2*pad, c2=mkCanvas(W,H), x2=ctx2(c2); x2.fillStyle='#fff'; x2.fillRect(0,0,W,H);
  var id=x2.createImageData(w,h), q=id.data; for(i=0,j=0;i<n;i++,j+=4){ q[j]=q[j+1]=q[j+2]=out[i]; q[j+3]=255; } x2.putImageData(id,pad,pad); return c2;
}

/* ---------- stage 1: collect OCR fragments ---------- */
var VIEWS={ l:{lines:{0:14,90:10,270:12}, preps:['g','b'], ser:['g','b','B']}, v:{lines:{0:8,90:5,270:6}, preps:['v','w'], ser:['v','w','W']}, G:{lines:{0:0,90:6,270:6}, preps:['G','Gb'], ser:[]} };
async function collect(src,opts){
  opts=opts||{}; var T0=now(), tm={}, frames={}, rots=opts.rots||[0,90,270], chans=opts.chans||['l','v'];
  var S=await toCanvas(src,opts.srcLong||CFG.srcLong), views=[];
  if(!opts.chans) chans=['l','v','G'];
  rots.forEach(function(r){ var F=rotCanvas(S,r), Wc=scaleTo(F,CFG.propLong); frames[r]={F:F,W:Wc};
    chans.forEach(function(ch){ if(ch==='G'&&r===0) return; var g=grayOf(Wc,ch), P=proposeLines(g,Wc.width,Wc.height);
      P.forEach(function(p){ var cy=(p.y0+p.y1)/2/Wc.height, pri=1; if(r===0&&cy>0.62) pri=1.25; if(r!==0&&(cy<0.22||cy>0.78)) pri=1.2; p.rank=p.score*pri; p.rot=r; p.ch=ch; });
      P.sort(function(a,b){return b.rank-a.rank}); views.push({rot:r,ch:ch,props:P}); }); });
  tm.propose=Math.round(now()-T0);
  var order=[],mx=0; views.forEach(function(v){ v.sel=v.props.slice(0,((opts.maxLines||{})[v.ch+v.rot])||VIEWS[v.ch].lines[v.rot]||4); mx=Math.max(mx,v.sel.length); });
  for(var i=0;i<mx;i++) views.forEach(function(v){ if(v.sel[i]) order.push(v.sel[i]); });
  var frags=[], id=0, budget=opts.budgetMs||0;
  function over(){ return (opts.shouldStop&&opts.shouldStop())||(budget&&now()-T0>budget); }
  for(i=0;i<order.length&&!over();i++){
    var p=order[i], fr=frames[p.rot], k=fr.F.width/fr.W.width, pid=id++, preps=(opts.preps&&opts.preps[p.ch])||VIEWS[p.ch].preps;
    var cr=cropFor(fr.F,p,k,38,p.rot?1.4:0.5,0.45); /* rotated edge names: pad further along the line so a trailing Jr./II is inside the crop */
    for(var j=0;j<preps.length;j++){
      var pc=prepCanvas(cr.cv,preps[j],p.pol,38), r;
      try{ r=await ocr(pc,{psm:7}); }catch(e){ continue; }
      frags.push({id:pid,t:r.text,c:r.conf,rot:p.rot,prep:preps[j],pol:p.pol,kind:'line',box:[p.x0/fr.W.width,p.y0/fr.W.height,(p.x1+1)/fr.W.width,(p.y1+1)/fr.W.height],ph:p.h/fr.W.height,score:+p.score.toFixed(3)});
    }
    if(opts.onProgress) opts.onProgress({stage:'lines',done:i+1,of:order.length});
  }
  tm.lines=Math.round(now()-T0)-tm.propose;
  // serial pass: small digit-like boxes in the upright frame, digits + slash only
  var fr0=frames[0]; if(fr0&&!over()){
    var cand=[]; views.filter(function(v){return v.rot===0}).forEach(function(v){ v.props.forEach(function(p){ var a=p.w/p.h; if(a>=1.6&&a<=10&&p.h<fr0.W.height*0.05&&p.h>=6){ p.sr=p.rank*(p.y0/fr0.W.height>0.55?1.3:1); cand.push(p); } }); });
    cand.sort(function(a,b){return b.sr-a.sr});
    var k0=fr0.F.width/fr0.W.width, sp=[], cnt={l:0,v:0}, lim=opts.maxSerial||CFG.maxSerial;
    for(i=0;i<cand.length&&sp.length<lim*2;i++){ var q=cand[i]; if(cnt[q.ch]>=lim) continue; cnt[q.ch]++; sp.push(q); }
    sp.sort(function(a,b){return b.sr-a.sr});
    for(i=0;i<sp.length&&!over();i++){ var q2=sp[i], sid=id++, c2=cropFor(fr0.F,q2,k0,40,0.35,0.5), sps=(opts.serPreps&&opts.serPreps[q2.ch])||VIEWS[q2.ch].ser;
      for(j=0;j<sps.length;j++){ var pc2=prepCanvas(c2.cv,sps[j],q2.pol,40), r2; try{ r2=await ocr(pc2,{psm:7,wl:'0123456789/'}); }catch(e){ continue; }
        frags.push({id:sid,t:r2.text,c:r2.conf,rot:0,prep:sps[j],pol:q2.pol,kind:'ser',box:[q2.x0/fr0.W.width,q2.y0/fr0.W.height,(q2.x1+1)/fr0.W.width,(q2.y1+1)/fr0.W.height],ph:q2.h/fr0.W.height}); }
      try{ var gs=glyphSerial(c2.cv); if(gs) frags.push({id:sid+'g',t:gs.t,c:Math.round(40+60*Math.min(1,gs.votes/4)),rot:0,prep:'glyph',pol:'dark',kind:'ser',glyph:1,votes:gs.votes,minS:gs.minS,box:[q2.x0/fr0.W.width,q2.y0/fr0.W.height,(q2.x1+1)/fr0.W.width,(q2.y1+1)/fr0.W.height],ph:q2.h/fr0.W.height}); }catch(e){}
      if(opts.onProgress) opts.onProgress({stage:'serial',done:i+1,of:sp.length});
    }
  }
  // glyph window scan: serial digits are often too thin/spaced for OCR and are missed by line proposals. Slide windows over the lower band + top strip and read digits by shape.
  if(fr0&&!over()&&opts.glyphScan!==false){ var t0g=now(), F0=fr0.F, FW=F0.width, FH=F0.height, wins=[], by={}, done={}, ww=0.26*FW, wh=0.06*FH, y, x;
    var bands=[[0.55,0.97],[0.0,0.12]];
    bands.forEach(function(b){ for(y=b[0]*FH;y+wh<=b[1]*FH+wh*0.5;y+=wh*0.5) for(x=0;x+ww<=FW+ww*0.3;x+=ww*0.33) wins.push([x,y]); });
    for(i=0;i<wins.length&&!over();i++){ var wx=Math.min(wins[i][0],FW-ww), wy=Math.min(wins[i][1],FH-wh), sc=Math.min(3,100/wh), cw=mkCanvas(ww*sc,wh*sc), cx=ctx2(cw); cx.imageSmoothingQuality='high'; cx.drawImage(F0,wx,wy,ww,wh,0,0,cw.width,cw.height);
      var g2=null; try{ g2=glyphSerial(cw); }catch(e){}
      if(g2&&g2.bb){ // second look: crop tightly around the digits the first look found, so the text band and scale are right
        var bx=wx+g2.bb[0]/sc, bw2=(g2.bb[2]-g2.bb[0])/sc, by2=wy+g2.bb[1]/sc, bh2=(g2.bb[3]-g2.bb[1])/sc, key=Math.round(bx/20)+','+Math.round(by2/20);
        if(!done[key]){ done[key]=1; var px=bh2*0.5, py=bh2*0.35, sx2=Math.max(0,bx-px), sy2=Math.max(0,by2-py), ex2=Math.min(FW,bx+bw2+px), ey2=Math.min(FH,by2+bh2+py), s3=Math.max(0.5,Math.min(4,60/bh2)), c3=mkCanvas((ex2-sx2)*s3,(ey2-sy2)*s3), x3=ctx2(c3); x3.imageSmoothingQuality='high'; x3.drawImage(F0,sx2,sy2,ex2-sx2,ey2-sy2,0,0,c3.width,c3.height);
          var g3=null; try{ g3=glyphSerial(c3); }catch(e){}
          if(opts.dbg) (tm.dbg=tm.dbg||[]).push([g2.t,g2.votes,'->',g3&&g3.t,g3&&g3.votes,g3&&+g3.minS.toFixed(2),Math.round(bx),Math.round(by2)]);
          if(g3&&g3.votes>=3&&g3.minS>=0.55){ var o=by[g3.t]; if(!o||g3.votes>o.g.votes||(g3.votes===o.g.votes&&g3.minS>o.g.minS)) by[g3.t]={g:g3,box:[sx2/FW,sy2/FH,ex2/FW,ey2/FH]}; } }
      }
    }
    Object.keys(by).slice(0,3).forEach(function(k){ var o=by[k], sid2=id++; frags.push({id:sid2+'g',t:o.g.t,c:Math.round(40+60*Math.min(1,o.g.votes/4)),rot:0,prep:'glyph',pol:'dark',kind:'ser',glyph:1,scan:1,votes:o.g.votes,minS:o.g.minS,box:o.box,ph:0.03}); });
    tm.glyphScan=Math.round(now()-t0g); tm.glyphWins=wins.length;
  }
  // optional: the host app's own digit-shape serial finder (window.CardSerial + CardOCR) contributes extra votes when present
  if(fr0&&!over()&&opts.appSerial!==false&&root.CardSerial&&root.CardSerial.read&&root.CardOCR){ var t1=now(); try{
      var url=await new Promise(function(res){ fr0.F.toBlob(function(b){res(URL.createObjectURL(b))},'image/jpeg',0.92); }), im2=new Image(); await new Promise(function(res,rej){ im2.onload=res; im2.onerror=rej; im2.src=url; });
      var ch=root.CardSerial.loadChans(im2,1200), sr=await root.CardSerial.read(ch,{stage1:opts.appStage1||14,heavy:opts.appHeavy||3}); URL.revokeObjectURL(url);
      var aid=id++; sr.votes.forEach(function(v){ frags.push({id:aid+':'+v.ci,t:v.num+'/'+v.den,c:70,rot:0,prep:'app-'+v.v,pol:'dark',kind:'ser',box:[0,0,1,1],app:1}); });
    }catch(e){ frags.push({id:id++,t:'',c:0,rot:0,prep:'app-error',kind:'err',box:[0,0,1,1],err:String(e&&e.message||e)}); } tm.appSerial=Math.round(now()-t1); }
  // serial tiles: overlapping windows over the upright card, sparse digit reading (handles digits that touch an autograph or sit on foil)
  if(fr0&&!over()&&opts.tiles!==false){
    var TW=0.52,TH=0.12,wins=[],ys=[],y; for(y=0.5;y<=1-TH+0.001;y+=0.07) ys.push(y); [0,0.1].forEach(function(t){ys.push(t)});
    ys.forEach(function(y0){ [0,0.24,0.48].forEach(function(x0){ wins.push([x0,y0,x0+TW,y0+TH]); }); });
    var tp=(opts.tilePreps)||[['g','dark'],['g','light']], TS=opts.tileScale||1.6;
    for(i=0;i<wins.length&&!over();i++){ var wv=wins[i], WF=fr0.F, sx=Math.round(wv[0]*WF.width), sy=Math.round(wv[1]*WF.height), sw=Math.round((wv[2]-wv[0])*WF.width), sh=Math.round((wv[3]-wv[1])*WF.height);
      var tc=mkCanvas(sw*TS,sh*TS), tx=ctx2(tc); tx.imageSmoothingQuality='high'; tx.drawImage(WF,sx,sy,sw,sh,0,0,tc.width,tc.height); var tid=id++;
      for(j=0;j<tp.length;j++){ var pc3=prepCanvas(tc,tp[j][0],tp[j][1],30), r3; try{ r3=await ocr(pc3,{psm:11}); }catch(e){ continue; }
        frags.push({id:tid,t:r3.text,c:r3.conf,rot:0,prep:tp[j][0]+(tp[j][1]==='light'?'L':''),pol:tp[j][1],kind:'tile',box:wv,words:r3.words.map(function(w){return [w.t,w.c]}) }); }
      if(opts.onProgress) opts.onProgress({stage:'tiles',done:i+1,of:wins.length});
    }
  }
  tm.serial=Math.round(now()-T0)-tm.propose-tm.lines; tm.total=Math.round(now()-T0); tm.ocrCalls=ST.calls;
  return {frags:frags,timing:tm,size:[S.width,S.height],frames:frames};
}

/* Moose Reader glyph serial reader: reads "a/b" printed in small thin digits where Tesseract's LSTM returns nothing.
   Steps: suppress blue/purple pen ink -> local-background contrast mask -> text band -> one run per glyph -> compare each glyph with
   digit shapes drawn from the device fonts (normalised 12x18, correlation + aspect) -> accept only when 2+ thresholds agree.  (concatenated by build.js) */
var GLY={W:12,H:18,fonts:['Arial Narrow','Roboto Condensed','Helvetica Neue','Arial','DejaVu Sans Condensed','Impact','Georgia','Times New Roman','Courier New','sans-serif','serif','monospace'],weights:['normal','bold'],tpl:null};
function glyNorm(d,w,h,x0,y0,x1,y1){ var W=GLY.W,H=GLY.H,o=new Float32Array(W*H),bw=x1-x0,bh=y1-y0,i,j,x,y,s,n;
  for(j=0;j<H;j++) for(i=0;i<W;i++){ var xa=x0+bw*i/W,xb=x0+bw*(i+1)/W,ya=y0+bh*j/H,yb=y0+bh*(j+1)/H; s=0;n=0;
    for(y=Math.floor(ya);y<Math.max(Math.floor(ya)+1,Math.ceil(yb));y++) for(x=Math.floor(xa);x<Math.max(Math.floor(xa)+1,Math.ceil(xb));x++){ if(x>=0&&x<w&&y>=0&&y<h){ s+=d[y*w+x]; n++; } }
    o[j*W+i]=n?s/n:0; } return o; }
function glyTemplates(){ if(GLY.tpl) return GLY.tpl; var T=[],chars='0123456789/'.split(''),S=96;
  GLY.fonts.forEach(function(f){ GLY.weights.forEach(function(wt){ chars.forEach(function(ch){
    var c=mkCanvas(S,S),x=ctx2(c); x.fillStyle='#fff'; x.fillRect(0,0,S,S); x.fillStyle='#000'; x.textBaseline='alphabetic'; x.font=wt+' 64px "'+f+'"'; if(f==='sans-serif'||f==='serif'||f==='monospace') x.font=wt+' 64px '+f;
    x.fillText(ch,S*0.2,S*0.8); var im=x.getImageData(0,0,S,S).data,d=new Float32Array(S*S),x0=S,y0=S,x1=-1,y1=-1,i,j;
    for(j=0;j<S;j++) for(i=0;i<S;i++){ var v=1-im[(j*S+i)*4]/255; d[j*S+i]=v; if(v>0.5){ if(i<x0)x0=i; if(i>x1)x1=i; if(j<y0)y0=j; if(j>y1)y1=j; } }
    if(x1<0) return; T.push({ch:ch,v:glyNorm(d,S,S,x0,y0,x1+1,y1+1),a:(x1-x0+1)/(y1-y0+1)}); }); }); });
  GLY.tpl=T; return T; }
function glyNcc(a,b){ var n=a.length,ma=0,mb=0,i; for(i=0;i<n;i++){ma+=a[i];mb+=b[i];} ma/=n;mb/=n; var sa=0,sb=0,sab=0; for(i=0;i<n;i++){ var x=a[i]-ma,y=b[i]-mb; sa+=x*x; sb+=y*y; sab+=x*y; } return sa>0&&sb>0?sab/Math.sqrt(sa*sb):0; }
function glyClassify(v,asp){ var T=glyTemplates(),best={},i; for(i=0;i<T.length;i++){ var t=T[i],s=glyNcc(v,t.v)-0.3*Math.abs(Math.log(asp/t.a)); if(!(t.ch in best)||s>best[t.ch]) best[t.ch]=s; }
  var arr=Object.keys(best).map(function(k){return [k,best[k]]}).sort(function(a,b){return b[1]-a[1]}); return {ch:arr[0][0],s:arr[0][1],s2:arr[1][1],second:arr[1][0]}; }
/* cv: colour canvas of a candidate box. pol 'dark'|'light'. rel: threshold as fraction of the contrast peak. returns {text, glyphs, minS} or null */
function glyRead(cv,pol,rel){ var w=cv.width,h=cv.height,im=ctx2(cv).getImageData(0,0,w,h).data,n=w*h,g=new Float32Array(n),i,x,y;
  for(i=0;i<n;i++){ var R=im[i*4],G=im[i*4+1],B=im[i*4+2]; g[i]=(R+G+B)/3; }
  var I=integral(g,w,h),r=Math.max(4,Math.round(h*0.45)),bg=new Float32Array(n);
  for(y=0;y<h;y++) for(x=0;x<w;x++) bg[y*w+x]=boxMean(I,w,h,x-r,y-r,x+r,y+r);
  var d=new Float32Array(n),mx=0; for(i=0;i<n;i++){ var Bc=im[i*4+2],Gc=im[i*4+1],Rc=im[i*4]; var pen=(Bc-Gc>18&&Bc>Rc); var v=pol==='dark'?bg[i]-g[i]:g[i]-bg[i]; if(pen) v=0; if(v<0) v=0; d[i]=v; if(v>mx) mx=v; }
  if(mx<18) return null; for(i=0;i<n;i++) d[i]/=mx; var th=rel, m=new Uint8Array(n); for(i=0;i<n;i++) m[i]=d[i]>th?1:0;
  /* text band: rows with enough ink around the densest row */
  var rows=new Int32Array(h),rmax=0; for(y=0;y<h;y++){ var c=0; for(x=0;x<w;x++) c+=m[y*w+x]; rows[y]=c; if(c>rmax) rmax=c; } if(rmax<4) return null;
  var yc=0; for(y=0;y<h;y++) if(rows[y]>rows[yc]) yc=y; var y0=yc,y1=yc,th2=Math.max(2,rmax*0.2); while(y0>0&&rows[y0-1]>=th2) y0--; while(y1<h-1&&rows[y1+1]>=th2) y1++; var bh=y1-y0+1; if(bh<10) return null;
  var cols=[],c0=-1,gap=0; for(x=0;x<=w;x++){ var cc=0; if(x<w) for(y=y0;y<=y1;y++) cc+=m[y*w+x]; if(cc>0){ if(c0<0){c0=x;} gap=0; } else if(c0>=0){ gap++; if(gap>Math.max(1,Math.round(bh*0.05))||x>=w){ cols.push([c0,x-gap]); c0=-1; gap=0; } } }
  var runs=[]; cols.forEach(function(c){ var x0=c[0],x1=c[1]+1,ya=h,yb=-1,ink=0; for(y=y0;y<=y1;y++) for(x=x0;x<x1;x++) if(m[y*w+x]){ ink++; if(y<ya)ya=y; if(y>yb)yb=y; } if(yb<0) return; if(yb-ya+1<bh*0.6||x1-x0<Math.max(2,bh*0.08)) return; runs.push({x0:x0,x1:x1,y0:ya,y1:yb+1}); });
  if(runs.length<3||runs.length>9) return null; var out='',minS=9,gl=[];
  runs.forEach(function(q){ var asp=(q.x1-q.x0)/(q.y1-q.y0),v=glyNorm(d,w,h,q.x0,q.y0,q.x1,q.y1),c=glyClassify(v,asp); var ok=c.s>=0.55&&c.s-c.s2>=0.04; out+=ok?c.ch:'?'; if(c.s<minS) minS=c.s; gl.push({ch:c.ch,s:+c.s.toFixed(2),m:+(c.s-c.s2).toFixed(2),ok:ok}); });
  return {text:out,glyphs:gl,minS:minS,pol:pol,rel:rel,bb:[runs[0].x0,y0,runs[runs.length-1].x1,y1+1]}; }
/* vote across thresholds/polarities; returns {t:'07/10', c:conf, votes:n} or null */
function glyphSerial(cv){ var reads=[],pols=['dark','light'],rels=[0.25,0.35,0.45],p,r; for(p=0;p<2;p++) for(r=0;r<3;r++){ var a=glyRead(cv,pols[p],rels[r]); if(a&&/^\d{1,4}\/\d{1,4}$/.test(a.text)) reads.push(a); }
  if(!reads.length) return null; var by={}; reads.forEach(function(a){ (by[a.text]=by[a.text]||[]).push(a); }); var best=null; Object.keys(by).forEach(function(k){ if(!best||by[k].length>by[best].length) best=k; });
  var g=by[best]; return {t:best,votes:g.length,of:6,minS:Math.min.apply(null,g.map(function(a){return a.minS})),bb:g[0].bb}; }

/* Moose Reader - on-device front-design matcher (no network, no AI).
   Works on a 256-ish px gray picture of the CLEANED upright card (gray #D6D6D6 padding is detected and ignored).
   A template is a small gradient-magnitude patch cut from a known logo/set design; match = zero-mean normalised cross-correlation
   over the whole card at 5 scales. Output is a similarity 0..1 per template; decide() turns it into a brand candidate (never alone enough to fill
   unless the similarity is high AND the template is trusted). */
var V=(function(){
'use strict';
var LONG=320;
function cardBox(g,w,h){ /* bounding box of non-pad pixels (pad ~ 214 gray). returns [x0,y0,x1,y1] px */
  var col=new Float32Array(w),row=new Float32Array(h),x,y,v; for(y=0;y<h;y++) for(x=0;x<w;x++){ v=g[y*w+x]; if(Math.abs(v-214)>9){ col[x]++; row[y]++; } }
  function span(a,n,need){ var s=0,e=n-1; while(s<n&&a[s]<need) s++; while(e>s&&a[e]<need) e--; return [s,e]; }
  var sx=span(col,w,h*0.25),sy=span(row,h,w*0.25); if(sx[1]-sx[0]<w*0.3||sy[1]-sy[0]<h*0.3) return [0,0,w-1,h-1]; return [sx[0],sy[0],sx[1],sy[1]]; }
function grad(g,w,h){ var o=new Float32Array(w*h),x,y,gx,gy; for(y=1;y<h-1;y++) for(x=1;x<w-1;x++){ var i=y*w+x; gx=g[i+1]-g[i-1]+0.5*(g[i-w+1]-g[i-w-1]+g[i+w+1]-g[i+w-1]); gy=g[i+w]-g[i-w]+0.5*(g[i+w-1]-g[i-w-1]+g[i+w+1]-g[i-w+1]); o[i]=Math.sqrt(gx*gx+gy*gy); } return o; }
function blur(a,w,h){ var o=new Float32Array(w*h),x,y; for(y=1;y<h-1;y++) for(x=1;x<w-1;x++){ var i=y*w+x; o[i]=(a[i-w-1]+a[i-w]+a[i-w+1]+a[i-1]+a[i]+a[i+1]+a[i+w-1]+a[i+w]+a[i+w+1])/9; } return o; }
function resize(a,w,h,nw,nh){ var o=new Float32Array(nw*nh),x,y,sx=w/nw,sy=h/nh; for(y=0;y<nh;y++){ var fy=Math.min(h-1.001,(y+0.5)*sy-0.5); if(fy<0) fy=0; var y0=fy|0,wy=fy-y0; for(x=0;x<nw;x++){ var fx=Math.min(w-1.001,(x+0.5)*sx-0.5); if(fx<0) fx=0; var x0=fx|0,wx=fx-x0; o[y*nw+x]=(a[y0*w+x0]*(1-wx)+a[y0*w+x0+1]*wx)*(1-wy)+(a[(y0+1)*w+x0]*(1-wx)+a[(y0+1)*w+x0+1]*wx)*wy; } } return o; }
var LCN=true;
/* local contrast normalisation: divide by the local mean (radius ~9 px) so strong backgrounds do not dominate the shape */
function lcn(a,w,h){ var R=9,I=new Float64Array((w+1)*(h+1)),x,y,o=new Float32Array(w*h); for(y=0;y<h;y++){ var rs=0; for(x=0;x<w;x++){ rs+=a[y*w+x]; I[(y+1)*(w+1)+x+1]=I[y*(w+1)+x+1]+rs; } }
  for(y=0;y<h;y++){ var y0=Math.max(0,y-R),y1=Math.min(h,y+R+1); for(x=0;x<w;x++){ var x0=Math.max(0,x-R),x1=Math.min(w,x+R+1),n=(x1-x0)*(y1-y0),m=(I[y1*(w+1)+x1]-I[y0*(w+1)+x1]-I[y1*(w+1)+x0]+I[y0*(w+1)+x0])/n; o[y*w+x]=a[y*w+x]/(m+8); } } return o; }
/* prepare a picture: gray bytes + size -> {w,h,box,G (gradient map of the card area only)} */
function prepare(gray,w,h){ var b=cardBox(gray,w,h),cw=b[2]-b[0]+1,ch=b[3]-b[1]+1,c=new Float32Array(cw*ch),x,y; for(y=0;y<ch;y++) for(x=0;x<cw;x++) c[y*cw+x]=gray[(b[1]+y)*w+b[0]+x];
  var s=LONG/Math.max(cw,ch); var nw=Math.max(8,Math.round(cw*s)),nh=Math.max(8,Math.round(ch*s)); var r=resize(c,cw,ch,nw,nh); var G0=blur(blur(grad(r,nw,nh),nw,nh),nw,nh); return {w:nw,h:nh,G:LCN?lcn(G0,nw,nh):G0,R:r}; }
function makeTemplate(P,box){ var x0=Math.round(box[0]*P.w),y0=Math.round(box[1]*P.h),x1=Math.round(box[2]*P.w),y1=Math.round(box[3]*P.h),w=x1-x0,h=y1-y0,a=new Float32Array(w*h),x,y; for(y=0;y<h;y++) for(x=0;x<w;x++) a[y*w+x]=P.G[(y0+y)*P.w+x0+x]; return {w:w,h:h,a:a}; }
function quant(t){ var m=0,i; for(i=0;i<t.a.length;i++) if(t.a[i]>m) m=t.a[i]; var b=new Uint8Array(t.a.length); for(i=0;i<b.length;i++) b[i]=Math.min(255,Math.round(t.a[i]/m*255)); return {w:t.w,h:t.h,b:b}; }
function unquant(q){ var a=new Float32Array(q.b.length),i; for(i=0;i<a.length;i++) a[i]=q.b[i]; return {w:q.w,h:q.h,a:a}; }
/* NCC of template (tw x th) against picture gradient map; integral images give window mean/var */
function match(P,T,scales,stride){ var best={s:-1,x:0,y:0,sc:1},W=P.w,H=P.h,G=P.G;
  var I=new Float64Array((W+1)*(H+1)),I2=new Float64Array((W+1)*(H+1)),x,y; for(y=0;y<H;y++){ var rs=0,rs2=0; for(x=0;x<W;x++){ var v=G[y*W+x]; rs+=v; rs2+=v*v; I[(y+1)*(W+1)+x+1]=I[y*(W+1)+x+1]+rs; I2[(y+1)*(W+1)+x+1]=I2[y*(W+1)+x+1]+rs2; } }
  scales.forEach(function(sc){ var tw=Math.round(T.w*sc),th=Math.round(T.h*sc); if(tw<8||th<8||tw>=W||th>=H) return; var t=resize(T.a,T.w,T.h,tw,th),n=tw*th,tm=0,i; for(i=0;i<n;i++) tm+=t[i]; tm/=n; var tz=new Float32Array(n),tn=0; for(i=0;i<n;i++){ tz[i]=t[i]-tm; tn+=tz[i]*tz[i]; } tn=Math.sqrt(tn)||1;
    for(y=0;y+th<=H;y+=stride) for(x=0;x+tw<=W;x+=stride){ var a=y*(W+1)+x,b=y*(W+1)+x+tw,c=(y+th)*(W+1)+x,d=(y+th)*(W+1)+x+tw; var s1=I[d]-I[b]-I[c]+I[a],s2=I2[d]-I2[b]-I2[c]+I2[a],mean=s1/n,vr=s2-n*mean*mean; if(vr<=1e-6) continue; var num=0,yy,xx,ti=0; for(yy=0;yy<th;yy++){ var row=(y+yy)*W+x; for(xx=0;xx<tw;xx++,ti++) num+=tz[ti]*G[row+xx]; }
      var s=num/(tn*Math.sqrt(vr)); if(s>best.s){ best={s:s,x:x,y:y,sc:sc,tw:tw,th:th}; } } });
  /* local refine at stride 1 */
  return best; }
function matchAll(P,tpls,opts){ opts=opts||{}; var sc=opts.scales||[0.8,0.9,1,1.12,1.25],st=opts.stride||2,out=[]; tpls.forEach(function(t){ var T=t.q?unquant(t.q):t, m=match(P,T,sc,st); out.push({tid:t.id,brand:t.brand,score:Math.max(0,m.s),x:m.x/P.w,y:m.y/P.h,sc:m.sc}); }); return out; }
return {prepare:prepare,makeTemplate:makeTemplate,quant:quant,unquant:unquant,match:match,matchAll:matchAll,cardBox:cardBox,LONG:LONG};
})();


/* Moose Reader - decide(): pure functions, no DOM, loadable in Node and in the browser.
   Input: OCR fragments from collect() + the bundled player dictionary. Output: ranked candidates, each with confidence + evidence.
   Rule: blank beats wrong. A candidate is only flagged `fill:true` when it clears the (tuned) threshold; everything is checkThis:true. */
var D=(function(){
'use strict';
var TH={playerFill:0.58,serialFill:0.62,brandFill:0.62,unknownNameCap:0.5};
function deacc(s){ try{ return s.normalize('NFD').replace(/[\u0300-\u036f]/g,''); }catch(e){ return s; } }
function norm(s){ return deacc(String(s||'')).toUpperCase().replace(/[^A-Z]/g,''); }
function clamp(x,a,b){ return x<a?a:(x>b?b:x); }
/* semi-global edit distance: best alignment of pat against any substring of txt (txt ends are free) */
function semi(pat,txt){ var m=pat.length,n=txt.length,prev=new Array(n+1),cur=new Array(n+1),i,j,best=1e9; if(!m) return 0; for(j=0;j<=n;j++) prev[j]=0;
  for(i=1;i<=m;i++){ cur[0]=i; for(j=1;j<=n;j++){ var c=pat.charCodeAt(i-1)===txt.charCodeAt(j-1)?0:1, v=prev[j-1]+c, w=prev[j]+1, x=cur[j-1]+1; cur[j]=v<w?(v<x?v:x):(w<x?w:x); } var t=prev;prev=cur;cur=t; }
  for(j=0;j<=n;j++) if(prev[j]<best) best=prev[j]; return best; }
function sim(pat,txt){ if(!pat.length) return 0; return 1-semi(pat,txt)/pat.length; }
function fconf(c){ return 0.45+0.55*clamp(c,0,90)/90; }   /* tesseract confidence -> weight */

/* ---------------- dictionary ---------------- */
var SUF=/^(JR|SR|II|III|IV)$/;
function buildDict(cp){ if(!cp||!cp.rows) return null; var names=[],tri={},firsts={},lastCount={},i,r,p,parts,suf,key,last,first,t,k;
  for(i=0;i<cp.rows.length;i++){ r=cp.rows[i]; p=r.split('|'); var nm=p[0]; parts=deacc(nm).replace(/\./g,'').split(/\s+/).filter(Boolean); suf=''; while(parts.length>2&&SUF.test(parts[parts.length-1].toUpperCase())) suf=parts.pop();
    if(parts.length&&SUF.test(parts[parts.length-1].toUpperCase())&&parts.length>1){ suf=parts.pop(); }
    first=norm(parts[0]); last=norm(parts.slice(1).join('')); key=first+last; if(key.length<6||!last) continue;
    var o={name:nm,key:key,first:first,last:last,suf:suf.toUpperCase(),sport:p[1],team:cp.teams&&p[2]!==''&&p[2]!==undefined?cp.teams[+p[2]]:''}; names.push(o); var ix=names.length-1;
    lastCount[last]=(lastCount[last]||0)+1; firsts[first]=(firsts[first]||0)+1;
    for(k=0;k<=key.length-3;k++){ t=key.substr(k,3); (tri[t]||(tri[t]=[])).push(ix); } }
  return {names:names,tri:tri,firsts:firsts,lastCount:lastCount}; }
function candidates(D0,s){ var hit={},k,t,l,i; for(k=0;k<=s.length-3;k++){ t=s.substr(k,3); l=D0.tri[t]; if(!l||l.length>1500) continue; for(i=0;i<l.length;i++) hit[l[i]]=(hit[l[i]]||0)+1; }
  var arr=[]; for(i in hit) if(hit[i]>=2) arr.push([+i,hit[i]]); arr.sort(function(a,b){return b[1]-a[1]}); return arr.slice(0,40).map(function(a){return a[0]}); }

/* ---------------- player ---------------- */
var PMIN={c:0};
function lineFrags(frags){ return frags.filter(function(f){ return f.kind==='line'&&f.c>=PMIN.c; }); }
function decidePlayer(frags,dict){
  var L=lineFrags(frags),res={},i,f,s;
  if(dict){
    var texts=[]; L.forEach(function(f){ s=norm(f.t); if(s.length>=4&&s.length<=40) texts.push({f:f,s:s}); });
    texts.forEach(function(t){ var cs=candidates(dict,t.s); cs.forEach(function(ix){ var n=dict.names[ix],e=res[ix]||(res[ix]={n:n,full:[],last:[],first:[]});
      var sf=sim(n.key,t.s); if(sf>=0.7&&t.s.length>=Math.min(n.key.length-3,8)) e.full.push({id:t.f.id,sim:sf,c:t.f.c,t:t.f.t,rot:t.f.rot,prep:t.f.prep});
      if(n.last.length>=5){ var sl=sim(n.last,t.s); if(sl>=(n.last.length>=7?0.8:0.99)) e.last.push({id:t.f.id,sim:sl,c:t.f.c,t:t.f.t,rot:t.f.rot,prep:t.f.prep}); } }); });
    /* first-name fragments for names that already have a last/full hit */
    Object.keys(res).forEach(function(ix){ var e=res[ix]; if(!e.last.length&&!e.full.length) return; if(e.n.first.length<4) return;
      texts.forEach(function(t){ var sf=sim(e.n.first,t.s); if(sf>=(e.n.first.length>=8?0.85:0.99)&&t.s.length<=e.n.first.length+3) e.first.push({id:t.f.id,sim:sf,c:t.f.c,t:t.f.t,rot:t.f.rot,prep:t.f.prep}); }); });
  }
  var out=[]; Object.keys(res||{}).forEach(function(ix){ var e=res[ix],n=e.n; if(!e.full.length&&!e.last.length) return;
    function best(a){ var b=0; a.forEach(function(v){ var q=v.sim*fconf(v.c); if(q>b) b=q; }); return b; }
    function ids(a,th){ var u={}; a.forEach(function(v){ if(v.sim>=th) u[v.id]=1; }); return Object.keys(u).length; }
    function bestF(a){ var b=0; a.forEach(function(v){ var d=Math.round((1-v.sim)*n.key.length); var pen=Math.max(0,1-0.17*d); var q=pen*fconf(v.c); if(q>b) b=q; }); return b; }
    var sFull=bestF(e.full),sLast=best(e.last),sFirst=best(e.first),conf,ev=[];
    var uniq=dict.lastCount[n.last]===1;
    var lastPart=sLast*(uniq?1:0.8), firstPart=sFirst;
    var both=lastPart>0&&firstPart>0?(0.5*lastPart+0.5*firstPart)*0.98:0;
    conf=Math.max(sFull*0.97, both*0.97, lastPart*0.62);
    var agree=Math.max(ids(e.full,0.8),ids(e.last,0.85)); conf+=0.05*Math.min(agree-1,2); if(agree<1) conf*=0.9;
    if(e.full.length) ev.push('full-name match "'+e.full.sort(function(a,b){return b.sim*fconf(b.c)-a.sim*fconf(a.c)})[0].t.replace(/\s+/g,' ').trim()+'" (rot '+e.full[0].rot+')');
    if(e.last.length) ev.push('surname "'+n.last+'" in '+ids(e.last,0.8)+' line(s)'); if(e.first.length) ev.push('first name "'+n.first+'" in '+ids(e.first,0.8)+' line(s)');
    ev.push('in bundled player list ('+n.sport+(n.team?', '+n.team:'')+')');
    out.push({text:n.name+(n.suf&&!/\b(jr|sr|ii|iii|iv)\b/i.test(n.name)?' '+n.suf:''),conf:clamp(conf,0,0.97),evidence:ev,src:'dict',sport:n.sport,team:n.team,key:n.key}); });
  out.sort(function(a,b){return b.conf-a.conf});
  /* suffix handling (Jr./Sr./II/III/IV). The tail token after the surname on the card is read from the line fragments ("JR.", "JA.", "JRE", "J.") and snapped to the player list. */
  (function(){ var base=function(t){ return deacc(t).toLowerCase().replace(/[^a-z ]/g,'').replace(/\s+(jr|sr|ii|iii|iv)$/,'').trim(); }, seen={}, keep=[];
    var tailOf=function(last){ var votes={},ids={}; L.forEach(function(f){ if(f.c<20) return; var toks=String(f.t).toUpperCase().replace(/[^A-Z0-9.]+/g,' ').trim().split(' '); for(var q=0;q<toks.length-1;q++){ var tk=norm(toks[q]); if(tk.length>=3&&sim(last,tk)>=0.8){ var t=toks[q+1].replace(/[^A-Z]/g,''),sx=null;
          if(t==='JR'||/^J[A-Z]?$/.test(t)||/^JR[A-Z]$/.test(t)) sx='Jr.'; else if(/^S[RA]$/.test(t)) sx='Sr.'; else if(t==='II'||t==='LL'||t==='IL') sx='II'; else if(t==='III'||t==='LLL') sx='III'; else if(t==='IV') sx='IV';
          if(sx){ var k=f.id+':'+sx; if(!ids[k]){ ids[k]=1; votes[sx]=(votes[sx]||0)+1; } } break; } } }); return votes; };
    out.forEach(function(c){ var b=base(c.text),g=seen[b]; if(!g){ seen[b]=c; c.alts=[]; keep.push(c); } else if(c.text!==g.text){ g.alts.push(c); } });
    var SX=/\s+(Jr\.?|Sr\.?|II|III|IV)$/;
    keep.forEach(function(c){ var variants=[c].concat(c.alts), plain=c.text.replace(SX,'').replace(/[,\s]+$/,''), sfxOf=function(t){ var m=t.match(SX); return m?m[1].replace(/\.$/,'')+(/^(Jr|Sr)$/.test(m[1].replace(/\.$/,''))?'.':''):''; };
      var dictSfx=variants.map(function(v){return sfxOf(v.text)}).filter(Boolean); var lastKey=base(c.text).split(' ').pop(); var tv=tailOf(norm(lastKey)); var tk=Object.keys(tv).sort(function(x,y){return tv[y]-tv[x]})[0];
      if(!dictSfx.length&&!tk) return;
      if(tk){ var hit=variants.filter(function(v){ return sfxOf(v.text)===tk; })[0];
        if(hit){ c.text=hit.text; c.conf=Math.max(c.conf,hit.conf); c.evidence=c.evidence.concat(['suffix "'+tk+'" read on the card ('+tv[tk]+' line(s)) and found in the player list']); }
        else if(!dictSfx.length){ c.text=plain+' '+tk; c.conf=c.conf*0.95; c.evidence=c.evidence.concat(['suffix "'+tk+'" read on the card; the list has the plain name only - check']); }
        else { c.text=plain+' '+tk; c.conf=Math.min(c.conf*0.8,0.5); c.evidence=c.evidence.concat(['suffix read as "'+tk+'" but the list only has '+dictSfx.join(' / ')+' for this name - not filled, check']); }
      } else { var uniqS=dictSfx.filter(function(v,i){return dictSfx.indexOf(v)===i}); 
        if(variants.length>1||c.alts.length){ c.text=plain; c.conf=Math.min(c.conf,0.5); c.evidence=c.evidence.concat(['suffix not read from the card; the list has '+variants.map(function(v){return v.text}).join(' / ')+' - not filled, check']); c.altCands=c.alts.map(function(v){ return Object.assign({},v,{conf:Math.min(0.5,v.conf*0.9),evidence:v.evidence.concat(['suffix variant; not read on the card'])}); }); }
        /* single list entry that carries a suffix: keep it, the list is the only evidence */ } });
    out=keep; keep.forEach(function(c){ if(c.altCands){ c.altCands.forEach(function(a){ out.push(a); }); delete c.altCands; } }); out.sort(function(a,b){return b.conf-a.conf}); })();
  /* unrelated runner-up penalty: if the top two are different people and close, halve */
  if(out.length>1&&out[0].conf-out[1].conf<0.08&&out[0].key!==out[1].key&&out[0].text!==out[1].text) out[0].conf*=0.8;
  /* unknown-name chip: two words, both word-like, seen in >=2 independent fragments */
  var unk=unknownName(L.filter(function(f){return f.c>=55}),dict); if(unk&&!out.some(function(o){return sim(norm(unk.text),o.key)>0.75||sim(o.key,norm(unk.text))>0.75;})) out.push(unk);
  out.sort(function(a,b){return b.conf-a.conf});
  return out.slice(0,5); }
function wordLike(w){ return /^[A-Z][A-Za-z'\u00c0-\u017f-]{2,}$/.test(w)&&/[AEIOUYaeiouy]/.test(w); }
function unknownName(L,dict){
  var votes={};
  L.forEach(function(f){ if(f.c<55) return; var t=f.t.replace(/[^A-Za-z'\u00c0-\u017f\s-]/g,' ').replace(/\s+/g,' ').trim(); var w=t.split(' '); if(w.length<2||w.length>4) return; w=w.filter(function(x){return x.length>1}); if(w.length<2||w.length>3) return; if(!w.every(function(x){return wordLike(x)})) return;
    if(w.some(function(x){return x.length>13})) return;
    var key=norm(w.join('')); var nm=w.map(function(x){return x[0].toUpperCase()+x.slice(1).toLowerCase()}).join(' ');
    var v=votes[key]||(votes[key]={text:nm,n:0,ids:{},c:0,key:key}); if(!v.ids[f.id]){ v.ids[f.id]=1; v.n++; } v.c=Math.max(v.c,f.c); });
  var arr=Object.keys(votes).map(function(k){return votes[k]}).filter(function(v){return v.n>=2}); if(!arr.length) return null; arr.sort(function(a,b){return b.n-a.n||b.c-a.c}); var b=arr[0];
  var firstOK=dict&&dict.firsts[norm(b.text.split(' ')[0])]; var conf=Math.min(TH.unknownNameCap,0.3+0.05*b.n+(firstOK?0.08:0)); return {text:b.text,conf:conf,evidence:['two-word text read in '+b.n+' independent lines','NOT in the bundled player list - spelling may be off'+(firstOK?'; first name is a known first name':'')],src:'free-text',key:b.key}; }

/* ---------------- serial ---------------- */
var RUNS={1:1,2:1,3:1,4:1,5:1,6:1,7:1,8:1,9:1,10:1,12:1,15:1,20:1,25:1,30:1,35:1,40:1,45:1,49:1,50:1,60:1,65:1,70:1,75:1,80:1,85:1,88:1,99:1,100:1,125:1,149:1,150:1,175:1,199:1,200:1,225:1,249:1,250:1,299:1,300:1,350:1,399:1,400:1,499:1,500:1,599:1,650:1,699:1,750:1,799:1,899:1,999:1,1000:1,1499:1,1500:1,2000:1,2499:1,2500:1,5000:1};
function plausible(a,b){ var n=parseInt(a,10),d=parseInt(b,10); return n>=1&&d>=1&&n<=d&&d<=9999&&(RUNS[d]===1)&&a.length<=b.length+1&&b.length<=4; }
function serialTokens(t){ var out=[],s=String(t).replace(/[Il|]/g,function(c){return c==='I'||c==='l'||c==='|'?'1':c}).replace(/[Oo]/g,'0').replace(/\s*\/\s*/g,'/'),m,re=/(\d{1,4})\/(\d{1,4})/g; while((m=re.exec(s))) out.push(m[1]+'/'+m[2]); 
  var s2=String(t).replace(/\s+/g,''); re=/(\d{1,3})\/(\d{1,4})/g; while((m=re.exec(s2))){ var k=m[1]+'/'+m[2]; if(out.indexOf(k)<0) out.push(k); } return out; }
function sfam(f){ var p=String(f.prep||''); if(p.indexOf('app-')===0){ p=p.slice(4); return /^band/.test(p)?'a-band':/^mask/.test(p)?'a-mask':/raw/.test(p)?'a-raw':'a-hat'; } return 'own-'+(f.kind==='tile'?'tile':(f.prep||'x').charAt(0)); }
function decideSerial(frags){
  var votes={},f,toks;
  frags.forEach(function(f){ if(f.kind!=='ser'&&f.kind!=='tile'&&!(f.kind==='line'&&f.rot===0)) return; if(f.c<12) return; var texts=[f.t]; if(f.words&&f.words.length) texts.push(f.words.map(function(w){return w[0]}).join('')); 
    var seen={}; texts.forEach(function(tx){ serialTokens(tx).forEach(function(k){ if(seen[k]) return; seen[k]=1; var p=k.split('/'); if(!plausible(p[0],p[1])) return; var v=votes[k]||(votes[k]={k:k,w:0,ids:{},n:0,best:0,kinds:{},fams:{}}); var key=f.id+':'+f.prep; if(v.ids[key]) return; v.ids[key]=1; v.n++; v.w+=fconf(f.c)*(f.kind==='tile'?0.8:1); v.best=Math.max(v.best,f.c); v.kinds[f.kind]=1; v.fams[sfam(f)]=1; if(f.glyph&&f.votes>=3&&f.minS>=0.55) v.gs=(v.gs||0)+1; }); }); });
  var arr=Object.keys(votes).map(function(k){return votes[k]}); 
  /* leading-zero variants (7/10 vs 07/10) are the same serial: merge, keep the form with more weight (tie: the padded one, a dropped glyph is likelier than an invented one) */
  (function(){ var by={}; arr.forEach(function(a){ var p=a.k.split('/'), nk=String(parseInt(p[0],10))+'/'+p[1]; (by[nk]=by[nk]||[]).push(a); });
    arr=[]; Object.keys(by).forEach(function(nk){ var g=by[nk].sort(function(a,b){ return (b.w-a.w)||(b.k.length-a.k.length); }), m=g[0]; for(var i=1;i<g.length;i++){ var o=g[i]; Object.keys(o.ids).forEach(function(id){ if(!m.ids[id]){ m.ids[id]=1; m.n++; } }); m.w+=o.w; m.best=Math.max(m.best,o.best); Object.keys(o.kinds).forEach(function(k){m.kinds[k]=1}); Object.keys(o.fams).forEach(function(k){m.fams[k]=1}); m.gs=(m.gs||0)+(o.gs||0); } arr.push(m); }); })();
  /* prefix-compatible reads support each other at half weight (07/1 supports 07/10) */
  arr.forEach(function(a){ a.sup=a.w; arr.forEach(function(b){ if(a===b) return; var A=a.k.split('/'),B=b.k.split('/'); if(A[0]===B[0]&&A[1].length>B[1].length&&A[1].indexOf(B[1])===0) a.sup+=0.5*b.w; }); });
  arr.sort(function(a,b){return b.sup-a.sup});
  var out=arr.slice(0,4).map(function(a,i){ var runner=arr[i===0?1:0]; var margin=runner?a.sup-runner.sup:a.sup; var conf=clamp(0.28+0.2*Math.min(a.n,5)+0.1*(a.best>=60?1:0)+(i===0?0.04*Math.min(margin,3):0)-(i>0?0.15:0),0,0.97);
    if(a.n<2) conf=Math.min(conf,0.45); if(a.n<3||Object.keys(a.fams).length<2) conf=Math.min(conf,0.55); if(a.gs&&!(runner&&runner.n>=2&&margin<1.2)) conf=Math.max(conf,Math.min(0.8,0.64+0.06*(a.n-1)));
    if(i===0&&runner&&runner.n>=2&&margin<1.2) conf=Math.min(conf,0.5);
    return {text:a.k,conf:conf,evidence:[a.n+' independent read(s), best OCR conf '+Math.round(a.best),'pattern ok (n<=total, common print-run)'],src:Object.keys(a.kinds).join('+')}; });
  return out; }

/* ---------------- brand / manufacturer / product type ---------------- */
/* Authored keyword table (printed words). weight = how specific the word is to that line. Style follows ocr-guess.js SETS. */
var BR=[
 {id:'bowman-chrome',mfr:'Topps',line:'Bowman Chrome',kw:[['BOWMANCHROME',1.2],['CHROME',0.45],['BOWMAN',0.7],['1STBOWMAN',0.9],['PROSPECTS',0.4]]},
 {id:'bowmans-best',mfr:'Topps',line:"Bowman's Best",kw:[['BOWMANSBEST',1.4],['BOWMANBEST',1.2],['BEST',0.35],['BOWMAN',0.4]]},
 {id:'bowman-sterling',mfr:'Topps',line:'Bowman Sterling',kw:[['STERLING',1.1],['BOWMANSTERLING',1.4],['BOWMAN',0.3]]},
 {id:'bowman',mfr:'Topps',line:'Bowman',kw:[['BOWMAN',0.7]]},
 {id:'topps-chrome',mfr:'Topps',line:'Topps Chrome',kw:[['TOPPSCHROME',1.3]]},
 {id:'diamond-icons',mfr:'Topps',line:'Diamond Icons',kw:[['DIAMONDICONS',1.4],['ICONS',0.6],['DIAMOND',0.4]]},
 {id:'tribute',mfr:'Topps',line:'Tribute',kw:[['TRIBUTE',1.2]]},
 {id:'stadium-club',mfr:'Topps',line:'Stadium Club',kw:[['STADIUMCLUB',1.4]]},
 {id:'allen-ginter',mfr:'Topps',line:'Allen & Ginter',kw:[['ALLENGINTER',1.4],['GINTER',0.9]]},
 {id:'gypsy-queen',mfr:'Topps',line:'Gypsy Queen',kw:[['GYPSYQUEEN',1.4]]},
 {id:'heritage',mfr:'Topps',line:'Heritage',kw:[['HERITAGE',1.0]]},
 {id:'finest',mfr:'Topps',line:'Finest',kw:[['FINEST',1.0]]},
 {id:'topps-series',mfr:'Topps',line:'Topps',kw:[['TOPPS',0.5]]},
 {id:'national-treasures',mfr:'Panini',line:'National Treasures',kw:[['NATIONALTREASURES',1.5],['TREASURES',0.9],['COLOSSAL',0.8]]},
 {id:'donruss',mfr:'Panini',line:'Donruss',kw:[['DONRUSS',1.4],['RATEDROOKIE',0.9],['RATED',0.3]]},
 {id:'prizm',mfr:'Panini',line:'Prizm',kw:[['PRIZM',1.3]]},
 {id:'select',mfr:'Panini',line:'Select',kw:[['SELECT',0.8]]},
 {id:'mosaic',mfr:'Panini',line:'Mosaic',kw:[['MOSAIC',1.1]]},
 {id:'optic',mfr:'Panini',line:'Optic',kw:[['OPTIC',0.8]]},
 {id:'contenders',mfr:'Panini',line:'Contenders',kw:[['CONTENDERS',1.2]]},
 {id:'immaculate',mfr:'Panini',line:'Immaculate',kw:[['IMMACULATE',1.3]]},
 {id:'flawless',mfr:'Panini',line:'Flawless',kw:[['FLAWLESS',1.3]]},
 {id:'panini',mfr:'Panini',line:'',kw:[['PANINI',0.9]]},
 {id:'bbm-genesis',mfr:'BBM',line:'Genesis',kw:[['GENESIS',1.2],['BBM',1.0]]},
 {id:'upper-deck',mfr:'Upper Deck',line:'',kw:[['UPPERDECK',1.2]]},
 {id:'fleer',mfr:'Fleer',line:'',kw:[['FLEER',1.2]]},
 {id:'leaf',mfr:'Leaf',line:'',kw:[['LEAF',0.9]]}
];
var MFR=[ ['Topps','TOPPS',0.9],['Panini','PANINI',0.9] ];
function wordsOf(frags){ var out=[]; frags.forEach(function(f){ if(f.kind!=='line'||f.c<20) return; var ws=String(f.t).split(/[^A-Za-z']+/).map(norm).filter(function(w){return w.length>=2}); var s=norm(f.t); out.push({f:f,s:s,ws:ws}); }); return out; }
function kwHit(kw,t){ var L=kw.length; if(L<=4){ return t.ws.indexOf(kw)>=0?1:0; } if(t.s.length<Math.max(4,L-4)||t.s.length>L+22) return 0; var m=sim(kw,t.s); var thr=L>=9?0.78:(L>=6?0.82:0.9); return m>=thr?m:0; }
function decideBrand(frags,vis,opts){
  var W=wordsOf(frags),res=[],auto=0,autoIds={};
  BR.forEach(function(b){ var ev=[],sum=0,used={},idset={}; b.kw.forEach(function(k){ var bestM=0,bf=null; W.forEach(function(t){ var m=kwHit(k[0],t); if(m>0){ var q=m*fconf(t.f.c); if(q>bestM){ bestM=q; bf=t; } } });
      if(bestM>0){ var cnt={}; W.forEach(function(t){ if(kwHit(k[0],t)>0) cnt[t.f.id]=1; }); var n=Object.keys(cnt).length; sum+=k[1]*(0.55+0.45*Math.min(bestM,1))*(1+0.15*Math.min(n-1,3)); ev.push('printed "'+k[0].toLowerCase()+'" read in '+n+' line(s), best "'+bf.f.t.replace(/\s+/g,' ').trim().slice(0,30)+'" (rot '+bf.f.rot+')'); } });
    if(sum>0) res.push({b:b,sum:sum,ev:ev,vis:0}); });
  /* visual template evidence */
  (vis||[]).forEach(function(v){ var b=BR.filter(function(x){return x.id===v.brand})[0]; if(!b) return; var r=res.filter(function(x){return x.b===b})[0]; if(!r){ r={b:b,sum:0,ev:[],vis:0}; res.push(r); } var q=v.score; r.vis=Math.max(r.vis,q); r.ev.push('front design matches "'+v.tid+'" (similarity '+v.score.toFixed(2)+')'); });
  res.forEach(function(r){ r.vsum=r.vis>0?Math.max(0,(r.vis-0.55))*3.2:0; r.conf=clamp(1-Math.exp(-(r.sum*1.15+r.vsum)),0,0.97); if(r.sum>0&&r.vsum>0) r.conf=clamp(r.conf+0.05,0,0.97); r.agree=(r.sum>0?1:0)+(r.vsum>0?1:0); });
  res.sort(function(a,b){return b.conf-a.conf});
  /* a line that only has a generic parent (bowman, topps) loses to a specific sub-line; keep parents as lower candidates */
  var lines=res.map(function(r){ return {text:(r.b.line||(r.b.mfr))+'',mfr:r.b.mfr,line:r.b.line,id:r.b.id,conf:r.conf,evidence:r.ev,src:(r.sum>0?'text':'')+(r.sum>0&&r.vis>0?'+':'')+(r.vis>0?'design':'')}; });
  /* parent penalty: bare "Bowman"/"Topps"/panini never beats a specific line, and a plain 'Bowman' needs >=2 hits */
  lines.forEach(function(l){ if(l.id==='topps-series'||l.id==='panini'||l.id==='bowman') l.conf=Math.min(l.conf,0.5); });
  lines.sort(function(a,b){return b.conf-a.conf});
  if(lines.length>1&&lines[0].conf-lines[1].conf<0.1&&lines[0].mfr===lines[1].mfr&&lines[0].line!==lines[1].line) lines[0].conf*=0.85;
  /* manufacturer */
  var mf={}; lines.forEach(function(l){ mf[l.mfr]=Math.max(mf[l.mfr]||0,l.conf*(l.mfr==='Topps'&&l.id==='bowman-chrome'?0.98:0.95)); }); 
  W.forEach(function(t){ MFR.forEach(function(m){ var h=kwHit(m[1],t); if(h) mf[m[0]]=Math.max(mf[m[0]]||0,clamp(0.55+0.35*h*fconf(t.f.c),0,0.9)); }); });
  var mfr=Object.keys(mf).map(function(k){return {text:k,conf:mf[k],evidence:['from the brand/line evidence above or the printed manufacturer word'],src:'derived'}}).sort(function(a,b){return b.conf-a.conf});
  /* product type from printed words */
  var ptype=[]; var aw=0,rel=0,rc=0; W.forEach(function(t){ if(kwHit('AUTOGRAPH',t)||kwHit('CERTIFIEDAUTOGRAPH',t)||kwHit('AUTOGRAPHS',t)) { aw+=fconf(t.f.c); autoIds[t.f.id]=1; } if(kwHit('MEMORABILIA',t)||kwHit('RELIC',t)) rel+=fconf(t.f.c); });
  if(aw>0) ptype.push({text:'autograph',conf:clamp(0.45+0.2*Math.min(aw,2),0,0.9),evidence:['the word "autograph" is printed on the card ('+Object.keys(autoIds).length+' line(s))'],src:'text'});
  if(rel>0) ptype.push({text:'relic/memorabilia',conf:clamp(0.4+0.2*Math.min(rel,2),0,0.8),evidence:['"memorabilia"/"relic" printed'],src:'text'});
  return {brand:lines.slice(0,5),manufacturer:mfr.slice(0,3),product:ptype}; }

/* ---------------- year / team ---------------- */
function decideYear(frags){ var v={}; frags.forEach(function(f){ if(f.kind!=='line'||f.c<35) return; var m=String(f.t).match(/\b(19[5-9]\d|20[0-2]\d)\b/g); if(m) m.forEach(function(y){ var e=v[y]||(v[y]={n:0,ids:{}}); if(!e.ids[f.id]){e.ids[f.id]=1;e.n++;} }); });
  return Object.keys(v).map(function(y){ return {text:y,conf:Math.min(0.5,0.2+0.15*v[y].n),evidence:['printed number read in '+v[y].n+' line(s); may be a copyright/stat year, not the card year'],src:'text'}; }).sort(function(a,b){return b.conf-a.conf}).slice(0,2); }

function decide(frags,ctx){ ctx=ctx||{}; var dict=ctx.dictObj||(ctx.dict?buildDict(ctx.dict):null);
  var player=decidePlayer(frags,dict), serial=decideSerial(frags), br=decideBrand(frags,ctx.vis,ctx), year=decideYear(frags);
  var team=[],sport=[]; if(player.length&&player[0].src==='dict'&&player[0].conf>=0.5){ var p=player[0]; if(p.team) team.push({text:p.team,conf:Math.min(0.45,p.conf*0.6),evidence:['current team of '+p.text+' in the bundled list - the card may show an earlier team'],src:'player-list'}); if(p.sport) sport.push({text:({B:'Baseball',K:'Basketball'})[p.sport]||p.sport,conf:Math.min(0.8,p.conf),evidence:['sport of '+p.text+' in the bundled list'],src:'player-list'}); }
  function mark(a,th){ return a.map(function(c){ return {text:c.text,conf:Math.round(c.conf*100)/100,evidence:c.evidence,checkThis:true,fill:c.conf>=th,src:c.src,extra:c.extra}; }); }
  return {player:mark(player,TH.playerFill),serial:mark(serial,TH.serialFill),brand:mark(br.brand,TH.brandFill),manufacturer:mark(br.manufacturer,TH.brandFill),product:mark(br.product,0.99),team:mark(team,0.99),sport:mark(sport,TH.playerFill),year:mark(year,0.99)}; }
return {decide:decide,buildDict:buildDict,TH:TH,BR:BR,norm:norm,sim:sim,decidePlayer:decidePlayer,decideSerial:decideSerial,decideBrand:decideBrand};
})();


var TEMPLATES=[{"id":"BC-001","brand":"bowman-chrome","th":0.72,"w":34,"h":35,"b64":"AF2ZsK+tm3FILSQdGx8mLC4rKCcpLTI6RE9ZXmFiX1tZXQBTj6uso5FuTjkzMzhCTldWT0Q8Nzc6QElSWV5kaGZkYWoARn6bnIt3YFJNU15tfo6ZmIt3YlJKSU5WXF1fZW5ubmt6ADpqg39qW1dicX+Qo7XDy8i7pYx1Y1tbYWdnZ2luampnewAwV2tkVldrh52otsbT2+De072iiHdsZ2dtcXNxcGViX3EALU5dXF90kqiwr7XBy9DRzsSxmod+eHJra3BzcWpfWVRcAC1MXGl/m6ipp6u0vb+/vberl4Fycnl7cmhiYmNjYVxSTAAvT2aCn6mXhYufrKibkY6JgHJjW2Fwfn5tWU5QWF1aT0QAL1R3mqqValhznKuVdGBiZ2VaTUdPZYCNgF5GQE1YWFBGADBei6idcEE+aZeiflI+SVtgV0U6Q12Gnp1zTDY9RklFQwA1bZ2nh1Q2Qm+Tl25GO1Zze2xMNT5ek7C6j1s0MDo/P0AAPnunoXlSR1l7jodgQUJmh4x4UDVBZ6HA0KpuPDE/S1NZAEWDqp58YmJvgYNzTjc+Y4KFcEo1S3esx9q+hE9AVWp4ggBEfqCYgXNzd354ZUIsL0ldX081MVSFssfbzJZiVnWVqbcAPHCRkYN5dXh+eWVAKSc5R0g7KS1ViLPK3tWgbmCDo7jEADRigoZ+dnJ5hINrRTA1SlVTQzEuT4Cz1OjboG1ghanC0QA0YYGGfG5nc4iMcEtAVXWDf2pNNUVvrdrw25hjVHOTq7wAO2yJhnFYU2qIjGpJTHWcqaKIYzw9XqLT68yKVkhcc4aWAER4lIhlRUVmiYVcP0p5n6uiiGI6OVaWwNayeUo8PkNIUABGfZiJYUJMcYt3SC05Y4WPhW1NNDtZjqy4kmZANCohHB4AQXiXj29ZZoGGYzYgJ0RbY1tKOjZHZo2gm3RSOS0cDgcGADhskZaEdX6JgF08LzI/S09LREJKW3WNkn5dQzMmFgkFBAAtW4SWkIWFh39pWlVWWVtaV1ZbZnSDin9kSzouHxEIBQQAI0lwiY+GgYOHf3p4eHh4eXl8f4SHh31nT0A1KBkOCQYFACdHZXyFg4KMlpOOiYiJjZKVl5WTjH5pUkM6MCIVDgsJBwA4Wm56goWIkpuVjYaEhouVnaOhloJqWE5LRTkpIiEiHhgAVoKPjpOYnqaropqTkJGXoaipoJB9b210e3VmWFddY15OAGmdqqKlpaemp52WkY2MjpWbnZaNhYaSpLOzrKOlrLOvmwByqrSora+yrbGqppuQioqTmJmRkpirwNbl6erk5uTq8OgAb6mvoJ6fpKGqqKqdjHpyd36Gh5GarsDR3+fy8Ozc3O7/AG+utKijpKemuL3Ht6SIfX6FjY6Yo7fJ2OLl7+3o1NLo/gBpqLSupqWmp7m9xbqwmY2HjZOWnqa1w87W2uXp6NbO1t8AXpinp6SlpaavqqmjpZ+dmJmamp2jr7nDyM3X4eni187CAEZvenh4e36AgXhxbnd+gn9+e3l4en6Eio6Tnam1tKuekgAuR0tHR0pOUVFKRUNJT1NSUE1KR0ZITFBUV1tia29vbnA="},{"id":"BC-007","brand":"bowman-chrome","th":0.72,"w":39,"h":35,"b64":"AHm5wqqqtrGESSIYFhUVGB4oND5GTVNbZG13fYCAf317eXp8fXt3AHazvqipsq+JVS8kIR0bGxscHiElLDQ+SFNfaXBycm5pZWdpaGJaAHGqt6WnqqeJXjwyMDAyNTY0LSUfHSApNUNRXmhub2hgWl9hX1JIAGudrJ2emJF7X0hGTVhkbnJvZFNAMisvOUlYZW51eHJqY21tbV5XAGSPmo2MfXFlXlxoe4+grbOxppB0WEQ9Q1FhanB0dm5nYW9tcWJjAF6BhXZzYltidIGVq8DP2d7d076ff2ZXU1tpcnV1cmliW2hncGZuAFt4dGJhXGiDoKq2xNPd4+bn4MyukXxwaWdtdXl2bmJaU1tbZmFrAFx3bVlhc5Kwv7a3wtDa3uDd0r2giH9/fHVubm5ua2dgVU9PXWRvAGF8b153nLu/s6Suv8jJycjDtJ2CcG98h4V1ZV5haW1pXVFQXmtxAGR/dW+Wur+fhIOiuLOglJSTiXdjWV9yiZOGZ1NTY3FxZllXZXN3AF97eoWvvZ5pU2udtZ92Ymp5eWlUSE9niqGhfFhIUl9jX1pbY2xuAFV1g5u5qHJAPWabrIlYRl1+iHlbQ0hjk7TAm2hBOkFGRkdJTlRXAEtyj6u0jlc6SHCZoXtRTXSfqpNnQ0hqpMncvIBGMDQ+RU5VWl1dAEd2mrCqgFhQYn2Tj2pKTneep49jQk97tdbr1JlXO0Vaa3mCiIqFAEd5nq2hgGhodH6DeFc+Q2SBhG5LO1mNv9fs4K5uVm2QqbrFzM3FAEd1lJ6WgXRzdnd4bE0zLj9OT0IvMVuUvtDm5bp9aoixy9jg5efeAEVthYyLf3VydXh7b00yLTxISDwsL1eNt87l6L2Cbo22zdje5OjhAERneH6DfXVxd4CJeVM8QFdjYlNANU17rdLq6bZ7ZIGpw9Ha4ePcAEVpeoKHfW5mdIeUf1hMY4mYlX9gQENootTt46dtVGuNprjEzc/NAEpyho6Nd11WbYqXelZWfKWyq5FtQz1bmMvk0ZRdRVFkdIOOlZikAFB8lJyVck9NcI+SbUtPeqCso4lkPjxalL7StX5OOzk5OkFHTFNwAFWCmqKbdVVbgZSFVzc7Xn2HfWZKOUhpmbO7l2pFNikeGBodICdMAFaAlqCih3F6k5ByRy4vRFddV0pCSGGDpK+jelc/MSASDhASExg6AFN3iZalmoyRnI5yVklJUVhZVVJXaYOdq6OHYkg4KhgNCw4QEhQvAE5pdYSfopiWmIyAeHZ3d3Vxb3OAkqOspo5qTTwwHxAJCQsNDxElAE1kaHKPmZWTmpudnp6fn5+dnZ+nrbCnkHBUQjUmFQsICAoLDRAcAFl0cW+DjIyQnqSoqKenqautrrC0sqWLbVVGPS8fEg8RERANDQ4VAGaNiH2EiYyVo6emo6CfoqiwuLu2po5zYFpaVUY2MTY/PzUmGBERAHSop5mVlpWboZ+cmJWUlZqkra+nlYN2d4GKioF3eIOOjntbNhwQAHKsr6aeoJydmZGLh4J+foCMmJ+YjoiOn7PDyMnFy9Pe38+kZTATAHm2uqudm5iZlJGRkop+dXF4gIiHiY6gtMjW3+jq8e70/fzYjEIXAHaxuqeYkI2RkJWdppuIcmZnb3t+houdrr/K0+Pn69/i8f/kl0cYAH+8yLOnnZibn6y8zMCsj396gImLkpmptsLK0eHn693c5OrMhUAaAH64xre0rKinq7XAyr+2oZaPlJmanqOuuMDH0ODs8+jg18qncUMtAIO7wLCwrq2rra2trKSnp6mlpKGdnKCnrbO5wtDf7Onbw6mKbFhS"},{"id":"BB-009","brand":"bowmans-best","th":0.72,"w":61,"h":22,"b64":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGhpbGxvb3FxdHZ6enVvbXBzbmRaVlZUTkZBPTs5ODUyLSklJCUpLzY9QURGSk9SVVdZWllYV1RPTU5RSkGfoaSioqCjpKeqrq+qo5+ip6Saj4qLjoyFf3p3dXNwamBTRDs5PUhTXWFkZmxxdXl+g4eJiYqIhYaMlYl4pamrqKOgoKOkpaeop6OenqCin5qYnKOqq6iloqGgn5yTf2VPSExXYWlqamtwcnV4foaOlJeYmpyjr72xmX2EhoeAfXp8fHx8fX9/e3Z0dnp8fYKLlZqbmpqcnqOpqpyAY1lcZGVjXFlaXl9eX2RrdXyChYiNmKq+uKJOWV9nZGRcWldXVldaW1hQSkpNUVRXW2BkZmludX2ImainkXhwcnFlWU1GREdHRkVITlVcYmVlZ3GGoKSZKTM7RkhJQDo0MzIzNzo4MSspKy0uLi8wMjY/TV1qd4qbno+AfXtyY1hNQDQuLCkpKy4yNjs+Pj1FXH2MjhghKDE1Ni8nIR4eISUoJiEeHR0cGxkZGyIvQVVncXeBiImBfnt3b292dGFDKx4aGRgZGx0hJCYlKj9geIIYHiMnKSsnIBoXGBwgIiIhICAfHBkZICw+Umd4gYB6d3V2dnhxbXKPrbegckQnHRkVExMUFxwhISQ0UWl1FxwgICEhHRgUEhQYHR8gISIiIR8jLT9VaXqFiYN3amJiaW9wY2N8suDy26NkNiQdFxMRERQaISIiL0ZZYhYbHh4cGhcSEA8RFRocHh8hIiYuPVJpe4SEf3ZsYVpXWmJmX09Ue7rt/+qybjolHhoWFBIUGiAfHys/TVEYHCAfHBkWFBMUFhkdHh4fJS8/Umh8ioyCc2dgXl9fXl1cV0o8RG2t4PLdp2g5JR8dHR0cHB4gHR0qQE1PJSIjIR0bGhscHiEiIyIkLT9XcISRlY9/alpUW2VtbGRYTD8xJzBRhbC+qn5QMyUiISQnKSkmIh0bKEFTWEc2KiIdHR4hJCcoKSsyQll3kaKkm4x7altWXG17fG5aRjYoHRcdMVFsdWdPOzIsKCQnLTQ1MCYeGyVAVmN2WkEuIyEhJCYqLTVDW3mZsbmvmYFwZ2VmbXiDg3RbQjAiGBIOEBgkMDUxLCouLiwlJSkxNDEoIBwjO1RonIJlSjcsJyYqM0FWdJWxwb+sj3NiX2l5hYyMhXNYPywhGBMPDQwMDhIWGh4kKy0oIR8jLC8uJiEeIjVNZKmbhm5YRTk2QFRwjam6vbGaf2ZZWWd8jZKMf2lQOCkgGxUTExENCgoOExodICIiIB0dHyUnJyEfHSAvQ1qbmZOFdWVbX3GNp7i7r5h+al5YW2V2hId+bFdBLyEdGhoZHB0bFA4LDhIZGx0cHBoaHB8mJiQeGxodKz5Ve4SJhYF/hZSqvcO5oYJnWVpka25yeXltVkAxJR0XFxogKTEzKx4TDQ4RFxoaFxcYGh4hJiUjHBkYGig9WFNjcXmBj6S6xsOwk3NaT1drfYB5c25jTTYmIR0bFhcfL0RQTz4oFw4NEBQXFxUVFhgdIignIx0YFxgmOlkwQVJmf5y0vbWfgWVTT1htg4uBcWVaSzcmHyIiIBsbKURjcGlNLxkQEBIWGBgWFhcaHiQqKyYgGRYXIzZUHig4VoGquauLa1NJTVttf4h/aVVJQDQmHyEoKSYfITJOb3luTjAbExQWGRkYFxcZGyAnLjMwKh8ZGCIvRw=="},{"id":"DI-011","brand":"diamond-icons","th":0.72,"w":178,"h":28,"b64":"7r16LhMUGiAiISMoKyooLTY9OjYuLCY2TnN5cmFjaWVONCQgISIjIyMjJSUmJCIiJS0zNC4nIR4cGxkYGRsdHh0dHiAiJisvMzk/QkI/Pjw4Mi0qKSgnJictMzUxKyYkJCIfHBobHiEjIR4bGx0hJiosLS0tLSwrKioqKywuLismICAkJyYjICAjLD1GQy8eFBUeNFNqalVHQUdLU1JKNiskIBgTExgpP0xFNCMcJDB03eq5dy4XGyMpKysvNjYwKS44PjgyLjM0SGGFinxmYmlnV0U+QEJCQkFAPTk1MS4tLTE1ODg0MC0sLC0sKywtLSonJSUnLTZBSU9TV1hYWFhYVVBKR0M/OTU0Nzw+PTk3Njc3NjQxLzAyMjEuKysvNTxCRkhJSktLSkdDQT87NzIuKSQkKTAzMS4tLS82OjcrHxYXHzdWbnBeUkpJSE9SSjYpJCIaFBMXJjlFQDIkHiUtcNrot3cyHycvNjc5QktHOCsuODw1MzpKUmN4l5uJb2FlaGdlZ2ttbm9vbGZeU0pERUhNUFBNSUZFRUdLT1FSUlBLQzs2OEJSYGdqamtqaWpsbm9taGJbVE1JR0dJS0xLSkpNUVRTUU9PT05LR0NDR05WXWJma25vb21rZ2NdVEc9NjErKi44QENCQkA/PDkzKyIaGiI6W3V8b2ZeW1ZZWU43KSQjGxQSFyU5RD8zJiEnL3Lf57d3NyUwOD0+Q09aUjsqLTY6N0BWcHZ8iJ+mlXhfWl5pcXd7foKGiIV+dGdcVlhdYmJgXVtaWFdXXWVtcXBtZl1QRkZTZHBycG9vb3Byc3N0dnVtYlhSUFBOTk9SU1NSVVpeYGFhY2NgW1VPTVJaY2pvdXyAf317e3p4c2laTEM8NC8wOkVNTk9SVE5CNSwlHh0kPF5/joZ8cm1mZGJUPi4qKiQeHCEvQEhBNSgjKTB05um6eTspMzk+P0ZRWU41Jis4PD9SeJeXj4+irqCCXUxKVV9kZ2tyeXx6c2phWldaYGRkYF1cXFpVUldibXJxbmliVktLWGlvbWpweIKFhHtxa25vZ1hKREVISEZGSElHRkZJTVFVWFtaVlBJQkBETlheYmZrbWpmZWhrbGliWFBNSkE0LzRASUtNVmFfTjosJSAfJTxgh52Yin13cGlmWEU1MzUxLCouOUZKQjcrJiwzeO/twH9AKzE1Oz5ES05BLCIrO0BGY5O2rp2XqbWpil5EOj9DRklNVFpeXFZOSERDRkpNS0lISktJREBBSVBUUlFPTUY+QlJlampsfY6hpp6JdWlpaWNSQjw+REZGRUZIRkI8OTo/R0tNSkVAOTMwMz1HTlJWW1tYVFNUV1lZV1RVWlpQPDAvOD07P0xhZlhBMSgjISc8YIqinYp5cWtkZFhIODY6Ojc1OD5HSEM4LictNHz28MWGRS8xNjxCRkZDNCUgLT5BR2qhyL6sorG5rI5kTD9AQURITlVaXFhQRj03NDU5PkBBQ0ZHRkI9Ojs9Pjw7Oz06NT1RZmtrcYqju7uqjnltbGpnWU5KUFhdXVpXV1VQRj06PkZLS0dDPjkyLjA4QUhOU1hZV1RSUlNUVVVYYW1wYkcyKzAzMTVEW2ZfTj8yKiUrQWWMoJd9amBfXWBWRDEtMTQzMTE1P0NBNy0lKzR+/O/GikgzMz1HTlBIQTElIjBAQUVonse+sKWxsaCGaFlSU1NVWmFnamljWU1ANS0tMDY8QkdLTEtIQzw2MzMyMzIzMzE8UmhpaG+Jpbe0nYZ2b2tpamVjZm53fHx5dXJwal9SS0tOUVFOS0hFPzo7QkpRWF5kZ2dlYmBgYWRqcX2IindWOCspKysyPlFfZFxOOy8qMUdqjZ2OcFhNT1NZUT8tJyswMjEvMDo/PjQqIicxfP/pwYlJODtLWWFdT0QzKCc1RERDYY+2rKKXn5mHcmNiY2VkZWpxdnd0bmVYSDsxLzM8RExSU1FPTUlCOzg6PDw5NjQzPlJjX1dbcoybmoh2aWNeXWFlanB4fn9/fXl2c3BqYlpUUE1KSEhISUdFSE9XXF1eX2BfXFpbYGdxfIeVoaONZkMvKCksNDtHVWVlWkQ3MThLa4uZhmZLQkhSWFFBMy8yODs8ODc7PTowKCEkLnn+37mDSDtCWmxzalVIODAvPElIRFt8m5GMhIt/bVtYXmJhXV1haXBycGlfUkQ4Ly0yO0NKTEpGQkA+Ozk5PUJDQDs1MTlHUk1DQ1JndHh0a19SSUhNVFxkbnV4enl0a2RhY2JfWE9FPTg4O0BFSlJaYGFeWlVPSUVHUFtod4aTobC0n3hSOy8tMDY2O0ZaX1dDOTY7SGOCkHxdQj5HVFlSSUNDRktPUExHQz42LSciJS51+9WwfEQ8SGR3f3FaSjs1NUFMSkNU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"},{"id":"RR-017","brand":"donruss","th":0.72,"w":50,"h":39,"b64":"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"},{"id":"DN-017","brand":"donruss","th":0.72,"w":39,"h":35,"b64":"RR8aOV5sUS0VGzhabFYzKEFoe316dnNnYGFocnF3gYiBWTMQCAQFNhceQmRmRiMRH0BhaUsqJURsgIKAfnxzbG1vcm52hIyEWjMRCAUFKxYoTWpfPBwTJklnY0IhJEdxhYWFiIyIhYR+eHF6iZCHXDMQCAUFJhs2W25XMxgYMVJqWjgaI0l1iIaGi5OTkpCHf3qBjZSKXjQQBwQEOThTb3FQKxYeO1tpUC0UI0p3jI2PkpiWlpSPioODi5ONYTQQBwQEX2N0fmxFJBYjQ2FlRiMPIkh2jY+KgX13d3p9fXZyfI6PZTURBwMDjpKVi2pDJx8vTGZfPhwNIkd2jY5+ZVRHSE1WW1ZTZoaRaDYRBwMDo6SdimpNOjdEWGhXNhcOI0h2jIlvSC4eHyUxOjg7V4KTazcSCAQElZeShG5bTktUX2RQNR8ZLU15jYdoOx0LCxIeKSsxU4OWbjkSCAQEgYOAem9jW1dbX15PPjQyQlp+kIlqPR4MDRIfKiwzVoiccToSCQUEYWRmZmJaUk1OUlZTUFJTYW6JlYxuPyEODxMfKi84XZCidTsSCQQEW1tbW1hSS0ZGS1BVWWRreoOWnJFyQyQSERQdKTJBapyqeDwSCQQEVlZWVlNOR0JCRk5XXm13jJWjpZZ3RigUExIZJTNNfK20ezwTCQUEYV9cW1dQSUVFSE1TWmh2j52sq5p5RygVFBEVIDNWjr+/fjwTCgUEd3Z0c25oYV5fYWVrcX2Kn6qzrZt4RycWFBIUHTFams/Lgz4UCgUDfnx6eXVvamdoam1xdX6JnKexqJVvQiQVFRQVHC1ZodrViUAUCQQDk5OSkY+MiIeHiImMkJafqq+unIRdOB8WFRUXGypWpOPejkIUCQQDfHx7e3l3dHNzc3N0dnqAipGSgmlFKRgUFhcZHClWp+znkkIUCQQEb3BwcXBvbWxra2tsbnF2enpzYEctHBQUFxkcHipWqfHslUMTCgUEPT09Pz8+PDs7Ozs7PT9CRUdEOiweFhMUFxocHidRpPDvmEQTCgUEKysrLS0tKysqKysrLC4wMjEtJyAbGBYWFxkbHSNKm+vvm0YUCQUEKSgoKCgnJiUkJSUlJSYoKiwtLy8uKykoKCosLzVZo+3unEcWCgUEUE9PT05NS0pKSktLTE1QU1VXWlxdW1pZWl5janKRy/vqlEMWCwcFc3R0dHRzcnFwcHFzdXh8f4KGio+TlZWVmZ+os7/W9f/UfjgWDgkGeXp7fHx9fX19fX+Ag4eLj5OXnaSrsLGytr7J1eHu9N+lWyoWEQwHUlRVVlZXWFlaW1xdX2JlaGxwdnyDh4mKjZOao6uwqpBjNh4WFA4JKCoqKyssLi8wMTExMTM1Nzk9QUVJS0tMTVFVWV1eWEgxHhcXFxIMDQ0NDQ4PDxAREREQEBAREhQVFxgZGRkZGhwfICIhHxsWExMXGxcQCQkICQkKCgsLCwsKCgoKCwsMDQ0MCwsLDA4PERIRERAPDxEWHBwWBgYGBgcHBwcGBgYGBwcHBwcICAcGBgYGBwgKCgsLCgoJCQsQGB0bBgYGBwcHBwYGBgYHBwcHBgYHBwcGBgYHCAgJCQoJCQgHBwcLExseCAgICAgIBwYGBwgICAgHBwYHBwcHBwgJCQoKCQkICAcHBgYIDhcfFBQTExISERAQEBEREA8ODQwMDAwMDAwNDQwMCwsKCgsLCgkIDBQdWVhXVVRSUE5MS0lGQj88Ojk4NzY1NDMyMTAwMC4sKiknIx4cHyQrubi3tbOxrquoo56Yko2IhYSCgH59e3h1cnBwcW9qZF9XTURBRkpP"},{"id":"ST-021","brand":"bowman-sterling","th":0.89,"w":71,"h":22,"b64":"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"},{"id":"GE-019","brand":"bbm-genesis","th":0.72,"w":114,"h":32,"b64":"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gomMj4+NhX10bGRjaW9yc3h3bllFODY8dZSqr6SSg3l0cGZbUlFZYmttcXiBg31zbWtrb3N5fYWMk5WVkI2LjpGRjoiAeXNvbnB0eoGGh4SBhYyaoKmjq7G/sI5xbH6Mm6GvuMTCuq6on4+Bent6dG5vd3+Cg4WIhH51amFfZm5yb2xmXE0+NTtKVm6GmJ6XjISBgX93aVhOSEpPWWNtc3Jva2xtbmtqanF6hYqNiIWGkJqem5SNhn50bGlpampscXd7gIWQm6iywMfBoHVZYIGXpJuhnqupp5yShXdwbmxoZGdxenx5eHp9fHt2bmVja3JyaWBYUUZAQlNqSFFhdIGHh4WGipCOh3VgS0A9Q09da3F0cXJzdHBrZ2pweoGFgoGFkJibmJSRjouGfnVsZmRlZWdrdX6CiZSxwsyyjGNPXoOir56YjZeTjYB5dnFpZGJhY2t3gH93bm1zeX56cmhnbG9rYFRKRkdQYHiOQkFIVGFsd36FjJidnZJ/Z1BCPD1FVWRwdHl5eHJsaWhrdHx/fHp8iJGXlZGPkJSWlI2DeG5nYmFmcHVvdH2ltsGceFVKX4OosZ6JdnuAhYB6eHZzcGtlY2l0enhxa211fYOAe3BqZ2ZiV0xGSlhtg5ikOzc9RE5YZXF+ipmjqKOWhnJhT0M8QU1ea3Z5eXNta251e4B9d3Jze4OMj4+NjZOboZ+YkIqCc2ViaW9kZGqQo6+MaElFYIKlppN4ZWhxe32Ej5aShXdqYmNqc3h5d3l/hIiDfW9mX1tXU1FUX3GImqeqNjM5Qk5XYGdxgJKhpqafmY2FdGJORUJKVmdwcm5qa211foeEfHJucnuGjpKUl5ygo6OjpKaikXlpZWhfXGGAmqaMZkhGZoiimIRmVVVidIaar7m0oIZuX1xldIGHiYuQkY+DeGlgV1ZZX2dwe4mXoaioOTU5RFJeYmJibH2RmZ2coKCelYl2YlNMTVRcYmNkanJ6gIWIhX52dXqFkJabnaKlp6WmrLm9ro1xY2JeWl91lqKUakpJbJGjknxeUEtUZoClyNfNsI91Z2VwgpGZmpmZlIt5aVxZWF9pd4SNk5ifoqKfSUVCRk9cYmFaW2NygIuRmJ6kpaGbkYFtXlVRT1FZYWtzfYOIioyJh4iQnKavsK2ln6CotcLDsI9vYF1fWWBwkqCddlVTdpukkHpeUEVJVXGawdbUwaeOfn2LnainopyYkINuYVpfZnKCkJiZmZmanJydW1tWUEpMUFVST05WZXJ+hY2Un6evrqyfjHJeUElKUV9ocXeDjJORkpWfqLG3tq6glZSbq7u9qYdpYF9lX2RtiJugg2Jgfpydi3piVkdITGWOuNLTxbGflZWirbGqopeNgXZqZ2pyfIaQlJaSkJCUmqCmZWtpXks/PUNHRUJFU19oaW12iJqvusC3qZR9Z1ZOSUxSXmd0fouOjo6ZqrvEvamShIWPm6GahWxYWV5qaWlreZCZjXV1hpaOf3NhV0lJSFt6mrC7wMK4q5+kq6ygj4F4cnJyeYGGiYqNioR+foWOm6i1XGtyaVE+Njg8PkBETVRYU09Va4Sbqbe5sqCRg3VlVk9LTVBcaXV5enyEkKCqqZuJeXR2fYB6aFVKUV1rb2lnaoKOlYmKjo2AcWdaUkhGRVRxjJ2kq7Gsn42Hh4d+cWlnbHaAh4mHhoF+d3Nyd4OSo7G9UGBqZ1dIPz09QEZMVVdTRz5BU2uElaSpqaGYj4qDdWdaUkpHS1VeYWNqeYmRjoN5dXZ2cWdXRTs9Slxpb2dkYHOEmp6emIh3Z1tRSUM+Pkpid4KKlqKgjnNlYmVkXVthbHd9gIF9eXV1dXN1e4qZqbS9SVZgYVpWUU1MUVtiZV9UQzg3RVZneY+hqaSempiVjop/cFpIQD9DSFBXYWx1fHt3cm5tamFQPTQ7T2VydWxlXmuDorSxpIl3ZFZLQ0A6PUpkeYSDgoJ9cF9TUFNYW15kbHN1dXZ3d3h6f4OJkJ2pt7y6REhNUVZcXVlWW2dtbF5NOi8uNkFNWm6GmqCblZaZmJWOhXFZQzc1NjtCTFdfZmlrbm9tZVhHNjE6U2l6eXJjW2F6l66qnH9xXlJGQD07P01idXx2b2xpYVZQT1JWWl1hY2JhZW95fYCFjpWcoauxsqiWPTs+RVFdYVtVV2NsaVhFNSsoLTQ8SVtxg46Qj5KXmp2ZjnlkUUI4MzQ4PEFJU1tfYmJiYFlKOTM5UWiBhH5nXl1xhJaRhnBoWVNJSUNCQk1eb3RsYVxcXVtYVFFRU1ZYWVpcZHGAjJOXnqWur66lln5iNjI2QU9aXFNIRExWV05ANCsoKjE6RlNhbXR3fYiVnaCdlYNtWUtEQT87ODg5PEFIUVlgY19RQTk8T2eDjYdwYVxmcnlyaV9eWFtXW1BLQ0dRX2ZkYF9fXVlVUU1LS1BWW15kbn+Rn6aprrGwppV9Ykgy"},{"id":"BCTL-002","brand":"bowman-chrome","th":0.72,"w":58,"h":51,"b64":"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"},{"id":"BCTL-012","brand":"bowman-chrome","th":0.72,"w":54,"h":51,"b64":"3o9ZXXNsRiwiLT1OUkxKSEAzLzQ3LiMeISgyPUM6KRoTFSI5TU4/LiYpN01cVTsiFhcjOU5R6JhfYndqPR8VJDpSVUlAPz83MzhBR05ZaHR8fndhQycWEBgsQUU5KyQnNEZQRi0YDg8aLT9D8aNoaHxzSCshMERZV0Q1ND1ARFBlfJWrvsnNybqff10+JyAoNzszKSMlLzxBOCYYExMaJzQ38K52cIB+X0g+SFRfWEM0NUVWaHyXtdLp+P//+erVvaODXj8yMjUzLissMTU1LSIdHB0gJzI537GEeYKGdmlgZGZjVUQ9Rl98lqu90OLt8e/t6+Tb083Ao3lTOzQ0NTU2NTIsJSEiJysvN0JOwKSIgH+BeXVxcW1jUkdMY4WlucLCw8XLz8/OzMW9usXU1LiJWj40NTY2My8qKCw0PkVKUFlknIh+gXtwZGFhYWFcUk5ce561vry1sa+ytba2tK2hmaK92d7CjFc3LCstLzI2O0ROWF9jZ2pugG5xgHlfSUNERk1WWV5xj6exsa6ooJydoqSkoZiIfH6VudrfvIFMMSwwNz9IU11mbnN3d3d3c2BofnlYOi8tMD9VZ3eLnaWmo52Yl52enJaUkIV1Z2V0krrZ1650Sjw9RExVX2p1f4eMjYyLcVxmfntaOy0oKTtbfJOiqKailoZ/iJaRgnZ2dWxdUlNiep3A1sebbVFLT1dib3uIk5yjqaytdV9lfH5hRDMrKj5mkauyraedg2Zje5OHbVtgZl9PQ0ddeJSswcWshWdeZXKAi5eksLi8vLiyhWppeoBuVUQ5N0p1o7q7r6eSblBWd4x2VkpcbWpTQ0dlh5+oq7CpmYV+h5eptLi5uLWwrKejoX1tdn95aFlOSlqCr8TAsaWJZk9cd4FmSkdjeHNXRlB1nbCumpiapKWpsbrCv7WqpqKdlY2HwY9wcHp8cWVcWWWKs8nCtKOGaVpndnRXQUVkeHJWSluGr7+3lIWJorK0sq6zrqWTjIaEfXl11pNoZnBuYVZRUF6Er8e9rpuFb2RscGdKNzxVZV5IRmGNtsW8kXNth5+ko5ufmJGAfnp/enp14I5eXWRaRTg2OEt3p8G0pJODcWZtcGZINz9ZZlxGRF+Js8K8jGZYb4mLiICJiouAgHt9d3h034VUVFpILh8eIzxtoLeomIqBcWlxdmpMP1Bve21RRFZ7qLezgVlHWnR6fn2JjYt/enR2eIGI3YFOT1M/JBUVGzZnmq6ilYyAbGd0gG5RS2qQnYpkSk5tmamjck5AVW93enmAgX53dnR5fYaO2H5MS088IxYXHTZklKiflox6Y2R3hGxOTXKWn4tlSklki5mNYEM9VGhvc3iBhIF5c3B1fYqU1IFPS0w+KyAhJTpkkaWel4x2YGV6gGBCQWSDi3tfTExjgIl1Tjg+WG15f4SGgXp0cm9ubW9xzIZXS0lANTAxM0VrlKSbk4l4aHB+elk/PFNnbmZZUlZoeHhdPzVFYXV/goeJg3dqYFZOSUlNuoRbSkM/Ozs9QFN4m6SXjoqDeHyBfGVUUl5obGljYWZvc2ZJMi9CXnWDiId9bFhJQDgxLC42mHJURTs2NDY8SGOIo6KRiYyMg35/f3l1dXh6e3t6eHh2bFU8LjJDWWhvbGRZTD4xKCIfIi09clhJQTYtJyo3UHOTopyNhYqMiISIkJSWlpWVlpaTjYR2YEY0LDE7R1BRTUY+NS0mIh8jLT9TVEI/PzYoHyU8YICUmZWPiYuMi4iMkpeYl5WWmp6fmYx5Y1BDPkJKU1RLPjUzMzEtKCYtPFNoQDY8QjopIC1Nb4SOk5iXkpCRl5uhpaShnJqdpKmnoZiPhn51bGlsdHRoVEQ8OjUvKik1S2Z5NzM/Rz8tKj5ddIKQn6mmn5mYmp2goJuUjIeJkJibnqGpsLSvpp2dpaibe1lDOjUvKio4U3GBPT5JTkQ4PFRrdoWmwcm3o5iYnaOprKugj4GAiZSZoKy/ztfX0MW9wMa+mGhFNjIuLS05UnGEVlJVVEtKWXWCh5a81dS6opKQlJ2nsLarmH50eomSmaS0wc3W2tfLycnBmmlDNDExMTA3SmV9c2VcVVFfeJikqbbU4de4n5GSmKSzwtDJuJuNj5ugpKq3wsvW4ebc08WzjGJEOTg4NzM0PlNtgGFST1ZujK68wcPMyLegkYqLkZyqtL69u6yinaCfnZ2jqrPC0+DczLGTb1NDQEA+OjMxND9PeFBCSFZviqy9wsDAtaCLfnl3en+HiIuMlpiXkIyHhISIjZSdqbW4rJFyVUQ/Q0dGQDYxLzEzYjo0QlNnfp2trKKZinlrYlpQTk5RTUlKVV5iYV9dWllcYGZrcHR1b2FOPTMzOUBBPjYvKicgTSstP05cbYucoZiQfHBkWko4LikrKCUlKzI5P0VJTFFZYGRjXldTT0g8MCkpLTI1NjIsJiIaPCIrPkpUYHuNnpqWem9hW0YwIhweHh4dHSIsO0hSWmNveH57c2ZaTkI1KyYnJygqLi4rJyMeOSQvP0lQWHCEpK20kYNqZEk0JSIlJycnKTA+T11mb3mEi5CPin9xX0o1KikvMzY3OTk2MzAuRjM6RElSWm+AprnKpZNwZkUzJikvNDc4O0NPWmFnbnd+f4GChIB1Yko0KS48S1RXVVFLRD9AXkhISUpWYXWEqMHYtqB2ZkAvJjA6Q0dIS1FXWFdYX2dtbGttcnFpWUQwKDJKX21wbGRbUEtNdlhQTEtVZXqJqsfgwql9Zj0rJzZDSktJTVFTTEZFT11qbGxrcWxhUD4uKztVaHBuaWBZT01PhlxQTEtRYXiLqsvky6+EZzwpKTtJSkQ8QEVJQTs5R111foKBhHZhSTcsL0RdZV9UT0lLSE1QkF1PTEtNW3OKqs3o0bOIaT0oKz5LRjouMjhBPTw+VHKPlJaXnYlpSjYtM0xjYU07NzU/Q05Pll5PTUtKV3CJqc/r1beLaz4oKz9MRTksLzRAQUdQb42fl5WfrJhxTTcuNlNqY0gxLzE+R1NQmWBSTktKVm+IqtHt2LmObEAoKj1LSEA1NjlCRVJni6Ghi4mbr510UDkyPVtxaEozMDNCTVlSnGVYUExLWHCJq9Pv2rqRb0IqKDlIS0hBP0BESFl1m6uijIyfr5x3V0dEUGl8dV1JRUZPWWZlnGlcUk5RX3aLrNTv2rqSckYrJjNBSUpGRERERld4oLOxpKSpqJFyX1lbY3OBgHVpY2BjanmClGddUlBYZXqLrdPt2bqTc0gtIyo1PkFAQUJBQk9tlK+7u7qwnYFsZGZrb3eBiIiDfnl6g5SjglhTTlBaZHeGqtHs2LqTc0ouIiUrMDI0OT9BQEdcfJmttbSlimxZVFhcYmx3fXx3c3J/lq2zb0NGSU5TWGl7pc/s2LqTckowJCUnKCguOUVJR0dOYHWFjpOMeFpEOjs/TWBtal1STVRynLqxYzQ8RkxLS1xzoc3r2LqTcksyJygrKi04SllfW1dXXmlxdnt6bVA2JyYtQlxrYEYzLThjnMKvYC44Rk1HRVRunszr2LmRcEoyKSswND1NYnB1cGtmZ2psbHBxZ000JSYvSWV1ZEMqIS9gocu1Yi45SVFKRlNsnMvq17aNa0cxKSw0PU1dcXuAe3dwb25tbG5uZE46LzI7VnGCcE4yKThutOLN"},{"id":"BCTL-022","brand":"bowman-chrome","th":0.72,"w":62,"h":51,"b64":"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a4GAaUoyJyUsOExogolzTC8kJCIhIyo1RFhiYZxyUUNQdp6fbz0hIyw6TGqPwsXAlIdfSS8pJiMhIy5CVWl+k5eGZ0w9OkFNXnOEhWxHLSUmJyYpLTdDVmFim3NTRVF1naF1RysuOERRbJLJzcqckGlWOzEqKCw5S19qc3+Uo6CMdGRgZ3F9iZGJbk04MjQ2OT0/REtaZm6deltMVHadpHtOMjM9SFNsk8/X16ecdmZKPzY3RFlqc25pboOdrKuglpSXnJ6gnIxwVkdFR0xQU1FQUFplcaGEZlRYdpugeUwvLjZCTGWN0N7isaZ9b1ZNR1Bic3hxYVVUZYGdr7a3uLezrKOVgGdVTU9UWFpaVlJQVV5oqJFzXl53l5hxRSckKzZAWYPN4Om3qn5uVlNWYm9za1xMQD1GW3iUqbW4s6aXh3NfTURDSU9SUU9MTE1TWFywn4NrZ3uYlGs+Ih8mMDdPe8rh7LqtfmxTVFpjZl9SRzwzLzRDW3ePnp+Vg21ZSDszMDI3PD07PEFJUVlcWbaqkHhxgZ2YbT4hHyYvNUp3x+Dsuq+AbVNQUVBMRT46NC8xPE9ngJOcmYx2Wj8sJCUqLzM0MzM5Q1BZYGBY"}];

/* Moose Reader public API (appended to reader.js by build.js) */
var DICT=null;
function getDict(o){ if(o&&o.dictObj) return o.dictObj; if(DICT) return DICT; var cp=(o&&o.dict)||root.CardPlayers; if(!cp&&o&&o.dictUrl&&typeof importScripts==='function'){ try{ if(typeof window==='undefined') root.window=root; importScripts(o.dictUrl); cp=root.CardPlayers; }catch(e){} } if(cp&&cp.rows){ DICT=D.buildDict(cp); } return DICT; }
function unb64(s){ var bin=(typeof atob!=='undefined'?atob(s):Buffer.from(s,'base64').toString('binary')), u=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return u; }
var TPLS=null;
function getTemplates(set){ if(TPLS) return TPLS; TPLS=[]; var src=(typeof TEMPLATES!=='undefined'?TEMPLATES:[]); src.forEach(function(t){ TPLS.push({id:t.id,brand:t.brand,th:t.th,q:{w:t.w,h:t.h,b:unb64(t.b64)}}); }); return TPLS; }
/* on-device front-design matching: gradient-shape NCC of brand/set logos against the card, no network */
function visMatch(frameCanvas,opts){ var tp=getTemplates(); if(!tp.length) return []; var W=320*3, c=scaleTo(frameCanvas,Math.min(960,Math.max(frameCanvas.width,frameCanvas.height))), g=grayOf(c,'l'); var P=V.prepare(g,c.width,c.height); var out=[];
  V.matchAll(P,tp).forEach(function(m){ var t=tp.filter(function(x){return x.id===m.tid})[0]; m.th=t.th; if(m.score>=t.th) out.push(m); }); return out; }
function cfgFrom(o){ if(o&&o.base) CFG.base=o.base; }
/* readCard(imageBitmap|canvas|Blob|Image, {backImage, base, appSerial, onProgress, shouldStop}) -> ranked candidates */
async function readCard(src,opts){
  opts=opts||{}; cfgFrom(opts); var T0=now(), step=function(m){ try{ opts.onProgress&&opts.onProgress(m); }catch(e){} };
  step('Reading the printed words…'); var col=await collect(src,opts), frags=col.frags, tm=Object.assign({},col.timing);
  var vis=[]; if(opts.vis!==false){ step('Looking at the logo and design…'); var tv=now(); try{ vis=visMatch(col.frames[0].F,opts); }catch(e){ vis=[]; } tm.vis=Math.round(now()-tv); }
  var back=null; if(opts.backImage&&!(opts.shouldStop&&opts.shouldStop())){ step('Reading the back…'); var tb=now(); try{ back=await collect(opts.backImage,{rots:[0],chans:['l'],tiles:false,appSerial:false,budgetMs:9000,shouldStop:opts.shouldStop}); back.frags.forEach(function(f){ f.id='b'+f.id; f.side='back'; frags.push(f); }); }catch(e){} tm.back=Math.round(now()-tb); }
  var r=D.decide(frags,{dictObj:getDict(opts),vis:vis}); tm.total=Math.round(now()-T0); r.timing=tm; r.vis=vis; r.size=col.size; if(opts.keepFrags) r.frags=frags; return r; }
/* ---- adapter shaped as window.CardReader (see reader-adapter.js) ---- */
var FIELDS=['player','team','year','brand','set','number','serial','auto','rookie'];
function blankF(){ var f={}; FIELDS.forEach(function(k){ f[k]={value:'',confidence:0,source:'',region:null,candidates:[]}; }); return f; }
function putF(F,k,list,fillTh,conv){ if(!list||!list.length) return; var top=list[0]; list.forEach(function(c){ var v=conv?conv(c.text):c.text; F[k].candidates.push({value:v,confidence:c.conf,evidence:c.evidence,checkThis:true}); }); if(top.fill){ F[k].value=conv?conv(top.text):top.text; F[k].confidence=top.conf; F[k].source=(top.src||'')+' (check this)'; } }
function srcOf(s){ return s&&s.front!==undefined&&!(typeof Blob!=='undefined'&&s instanceof Blob)?(s.front||s.back):s; }
async function read(imageSource,o){ o=o||{}; var r=await readCard(srcOf(imageSource),{backImage:o.backImage,onProgress:o.onProgress,shouldStop:function(){ return o.signal&&o.signal.aborted; },base:o.base,appSerial:o.appSerial,vis:o.vis,dict:o.dict,dictUrl:o.dictUrl});
  var F=blankF(); putF(F,'player',r.player); putF(F,'serial',r.serial); putF(F,'brand',r.brand); F.set.value=F.brand.value; F.set.confidence=F.brand.confidence; F.set.source=F.brand.source; F.set.candidates=F.brand.candidates.slice();
  putF(F,'team',r.team); putF(F,'year',r.year,0,function(x){return +x;});
  return {fields:F,engine:'moose-reader',extra:{manufacturer:r.manufacturer,product:r.product,sport:r.sport},raw:r,ms:r.timing.total}; }
async function readRegion(imageSource,box,o){ o=o||{}; cfgFrom(o); var cv=await toCanvas(srcOf(imageSource),1600), x0=Math.max(0,Math.round(box[0]*cv.width)),y0=Math.max(0,Math.round(box[1]*cv.height)),w=Math.max(8,Math.round((box[2]-box[0])*cv.width)),h=Math.max(8,Math.round((box[3]-box[1])*cv.height));
  var c=mkCanvas(w,h); ctx2(c).drawImage(cv,x0,y0,w,h,0,0,w,h); var frags=[], id=0, serial=o.kind==='serial';
  /* a region is read as one box: OCR it at the likely rotations, then let the same decide() rules (list snap, suffix, print-run check) rank what came out. blank beats wrong: junk is never returned as a value. */
  var preps=serial?[['g','dark'],['g','light'],['b','dark']]:[['g','dark'],['g','light'],['b','dark']];
  var rots=serial?[0]:(w<h*0.7?[270,90,0]:[0,270,90]);
  for(var ri=0;ri<rots.length;ri++){ var rot=rots[ri]; var src2=rot===0?c:rotCanvas(c,rot);
    for(var i=0;i<preps.length;i++){ var p=prepCanvas(src2,preps[i][0],preps[i][1],Math.max(24,Math.min(60,src2.height)));
      var rr=await ocr(p,{psm:serial?7:(src2.height>src2.width*0.5?6:7),wl:serial?'0123456789/':null}); var t=(rr.text||'').replace(/\s+/g,' ').trim();
      if(t) frags.push({id:id++,t:t,c:rr.conf,rot:rot,prep:preps[i][0],pol:preps[i][1],kind:serial?'ser':'line',box:[0,0,1,1],ph:1,score:1}); } }
  if(serial){ try{ var gs=glyphSerial(c); if(gs) frags.push({id:id++,t:gs.t,c:Math.round(40+60*Math.min(1,gs.votes/4)),rot:0,prep:'glyph',pol:'dark',kind:'ser',glyph:1,votes:gs.votes,minS:gs.minS,box:[0,0,1,1],ph:1}); }catch(e){} }
  var r=D.decide(frags,{dictObj:getDict(o),vis:[]}), out=[], seen={};
  function add(v,cf){ if(!v||seen[v]) return; seen[v]=1; out.push({value:v,confidence:Math.round(cf*1000)/1000,checkThis:true}); }
  var list=serial?r.serial:r.player; (list||[]).forEach(function(s){ add(s.text,Math.min(0.9,s.conf)); });
  if(!serial){ frags.forEach(function(f){ var t=f.t.replace(/[^A-Za-z .'\-]/g,'').trim(), letters=(t.match(/[A-Za-z]/g)||[]).length; if(letters>=4&&letters/Math.max(1,f.t.replace(/\s/g,'').length)>0.8&&f.c>=45) add(t,Math.min(0.3,f.c/300)); }); }
  out.sort(function(a,b){return b.confidence-a.confidence});
  var top=out[0]; return {value:(top&&top.confidence>=(serial?0.45:0.4))?top.value:'',candidates:out,checkThis:true}; }
var API={_dbg:{proposeLines:proposeLines,rotCanvas:rotCanvas,scaleTo:scaleTo,grayOf:grayOf,toCanvas:toCanvas,CFG:CFG},readCard:readCard,read:read,readRegion:readRegion,decide:D.decide,version:'moose-reader-1',collect:collect,visMatch:visMatch,config:CFG};
root.MooseReader=API; if(!root.CardReader) root.CardReader={read:read,readRegion:readRegion,readCard:readCard,engine:'moose-reader'};
return API;

})(typeof window!=='undefined'?window:(typeof self!=='undefined'?self:globalThis));
