/* Collectors Desk v0.10 - reads the writing the first reader skips: names printed sideways down an edge, nameplates and set logos at the bottom/top,
   and any box the collector draws. Everything runs on this device. Output is raw text fragments; ocr-guess.js turns fragments into suggestions. */
(function(root){
'use strict';
var T={};
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
/* crop a fraction rectangle of an image, rotate (0/90/270 clockwise), grayscale + stretch, scale so the long side is ~tw px */
T.strip=function(im,r,rot,tw,mode){
  var W=im.naturalWidth||im.width, H=im.naturalHeight||im.height;
  var sx=Math.round(r[0]*W), sy=Math.round(r[1]*H), sw=Math.max(8,Math.round((r[2]-r[0])*W)), sh=Math.max(8,Math.round((r[3]-r[1])*H));
  var rw=(rot===90||rot===270)?sh:sw, rh=(rot===90||rot===270)?sw:sh, sc=clamp(tw/rw,1,5), ow=Math.round(rw*sc), oh=Math.round(rh*sc);
  var cv=document.createElement('canvas'); cv.width=ow; cv.height=oh; var cx=cv.getContext('2d',{willReadFrequently:true}); cx.imageSmoothingQuality='high';
  cx.save(); if(rot===90){ cx.translate(ow,0); cx.rotate(Math.PI/2); } else if(rot===270){ cx.translate(0,oh); cx.rotate(-Math.PI/2); } else if(rot===180){ cx.translate(ow,oh); cx.rotate(Math.PI); }
  var dw=(rot===90||rot===270)?oh:ow, dh=(rot===90||rot===270)?ow:oh; cx.drawImage(im,sx,sy,sw,sh,0,0,dw,dh); cx.restore();
  return T.finish(cv,mode);
};
/* grayscale, stretch contrast; mode 'c' (contrast), 'i' (inverted), 't' (black/white by Otsu), 'a' (local/adaptive black/white) */
T.finish=function(cv,mode){
  var w=cv.width,h=cv.height,cx=cv.getContext('2d',{willReadFrequently:true}),d=cx.getImageData(0,0,w,h),a=d.data,n=w*h,g=new Uint8Array(n),i,hs=new Uint32Array(256);
  for(i=0;i<n;i++){ g[i]=(a[i*4]*299+a[i*4+1]*587+a[i*4+2]*114)/1000|0; hs[g[i]]++; }
  var lo=0,hi=255,acc=0; for(i=0;i<256;i++){ acc+=hs[i]; if(acc>n*.02){lo=i;break;} } acc=0; for(i=255;i>=0;i--){ acc+=hs[i]; if(acc>n*.02){hi=i;break;} }
  if(hi-lo<30){ lo=Math.max(0,lo-15); hi=Math.min(255,hi+15); } var k=255/(hi-lo);
  for(i=0;i<n;i++) g[i]=clamp(((g[i]-lo)*k)|0,0,255);
  if(mode==='t'||mode==='a'){
    var thr=new Float32Array(n);
    if(mode==='t'){ var h2=new Uint32Array(256),sum=0,sB=0,wB=0,best=0,t=127,tot=n; for(i=0;i<n;i++) h2[g[i]]++; for(i=0;i<256;i++) sum+=i*h2[i]; for(i=0;i<256;i++){ wB+=h2[i]; if(!wB) continue; var wF=tot-wB; if(!wF) break; sB+=i*h2[i]; var mB=sB/wB,mF=(sum-sB)/wF,v=wB*wF*(mB-mF)*(mB-mF); if(v>best){best=v;t=i;} } for(i=0;i<n;i++) thr[i]=t; }
    else { /* box-blur mean via integral image, window ~ 1/12 of the short side */
      var ii=new Float64Array((w+1)*(h+1)),x,y,r=Math.max(8,(Math.min(w,h)/12)|0); for(y=0;y<h;y++){ var rs=0; for(x=0;x<w;x++){ rs+=g[y*w+x]; ii[(y+1)*(w+1)+x+1]=ii[y*(w+1)+x+1]+rs; } }
      for(y=0;y<h;y++){ var y0=Math.max(0,y-r),y1=Math.min(h,y+r+1); for(x=0;x<w;x++){ var x0=Math.max(0,x-r),x1=Math.min(w,x+r+1),s=ii[y1*(w+1)+x1]-ii[y0*(w+1)+x1]-ii[y1*(w+1)+x0]+ii[y0*(w+1)+x0]; thr[y*w+x]=s/((x1-x0)*(y1-y0))-6; } } }
    for(i=0;i<n;i++) g[i]=g[i]>thr[i]?255:0;
  }
  if(mode==='i') for(i=0;i<n;i++) g[i]=255-g[i];
  for(i=0;i<n;i++){ a[i*4]=a[i*4+1]=a[i*4+2]=g[i]; a[i*4+3]=255; } cx.putImageData(d,0,0); return cv;
};
function cleanTxt(t){ return String(t||'').replace(/[^\S\n]+/g,' ').split('\n').map(function(s){return s.trim();}).filter(function(s){return s.length>0;}); }
/* one read -> fragments */
T.ocr=async function(cv,o){
  var rr=await CardOCR.recognize(cv,{psm:o.psm||6,wl:o.wl||''}), d=rr.data||{}, ls=cleanTxt(d.text);
  return {lines:ls,conf:Math.round(d.confidence||0),words:(d.words||[]).map(function(w){return {t:(w.text||'').trim(),c:Math.round(w.confidence||0)};}).filter(function(w){return w.t;})};
};
/* the standard set of strips: [id, rect, rotation, psm]. Phone photos of cards are upright, so names run sideways only down the edges. */
T.PLAN={
  quick:[
    {id:'edgeR_a', r:[.70,0,.95,1],     rot:270, psm:6, modes:['c','t']},
    {id:'edgeR_b', r:[.72,.02,.92,.95], rot:270, psm:6, modes:['c']},
    {id:'edgeR_c', r:[.70,0,.95,1],     rot:90,  psm:6, modes:['c','t']},
    {id:'edgeR_d', r:[.70,0,.95,1],     rot:270, psm:7, modes:['c','t']},
    {id:'edgeL_a', r:[.05,0,.30,1],     rot:90,  psm:6, modes:['c','t']},
    {id:'edgeL_b', r:[.08,.02,.28,.95], rot:90,  psm:6, modes:['c']},
    {id:'edgeL_c', r:[.05,0,.30,1],     rot:270, psm:6, modes:['c','t']},
    {id:'edgeL_d', r:[.05,0,.30,1],     rot:90,  psm:7, modes:['c','t']},
    {id:'bandB',   r:[0,.70,1,1],  rot:0,  psm:6, modes:['c','a','t']},
    {id:'bandT',   r:[0,0,1,.24],  rot:0,  psm:6, modes:['c','i']}
  ],
  deep:[
    {id:'plate1',  r:[0,.55,1,.82], rot:0, psm:6, modes:['c','a']},
    {id:'plate2',  r:[0,.78,1,1],   rot:0, psm:7, modes:['c','a','t']},
    {id:'bandB2',  r:[0,.84,1,1],   rot:0, psm:6, modes:['c','a','i']},
    {id:'bandT2',  r:[0,0,1,.14],   rot:0, psm:6, modes:['c','a','i']},
    {id:'corBL',   r:[0,.80,.5,1],  rot:0, psm:6, modes:['c','a','i']},
    {id:'corBR',   r:[.5,.80,1,1],  rot:0, psm:6, modes:['c','a','i']},
    {id:'corTL',   r:[0,0,.5,.2],   rot:0, psm:6, modes:['c','a','i']},
    {id:'corTR',   r:[.5,0,1,.2],   rot:0, psm:6, modes:['c','a','i']}
  ]};
T.read=async function(im,o){
  o=o||{}; var plan=T.PLAN.quick.concat(o.deep?T.PLAN.deep:[]), frags=[], t0=Date.now(), W=im.naturalWidth||im.width;
  for(var i=0;i<plan.length;i++){ var p=plan[i]; if(o.shouldStop&&o.shouldStop()) break;
    for(var m=0;m<p.modes.length;m++){ var cv=T.strip(im,p.r,p.rot,Math.max(1500,W*3),p.modes[m]); var r;
      try{ r=await T.ocr(cv,{psm:p.psm}); }catch(e){ continue; }
      frags.push({src:p.id,mode:p.modes[m],rot:p.rot,lines:r.lines,conf:r.conf,words:r.words}); } }
  return {frags:frags,ms:Date.now()-t0};
};
/* a drawn box: [x0,y0,x1,y1] fractions. kind 'serial' -> digits; 'text' -> letters. Many passes, returns every distinct read with a vote count. */
T.readBox=async function(im,box,kind,o){
  o=o||{}; var W=im.naturalWidth||im.width,H=im.naturalHeight||im.height, bw=(box[2]-box[0])*W, bh=(box[3]-box[1])*H, tall=bh>bw*1.5;
  var r=[clamp(box[0]-.01,0,1),clamp(box[1]-.01,0,1),clamp(box[2]+.01,0,1),clamp(box[3]+.01,0,1)];
  var rots=tall?[90,270]:[0], reads=[];
  if(kind==='serial'){ rots=tall?[90,270]:[0,180]; }
  var wl=kind==='serial'?'0123456789/#':'';
  for(var ri=0;ri<rots.length;ri++){
    var modes=['c','a','t','i'], sizes=kind==='serial'?[260,420]:[900,1500];
    for(var si=0;si<sizes.length;si++) for(var mi=0;mi<modes.length;mi++){
      var cv=T.strip(im,r,rots[ri],sizes[si],modes[mi]);
      var padc=document.createElement('canvas'); padc.width=cv.width+60; padc.height=cv.height+60; var px=padc.getContext('2d'); px.fillStyle=(modes[mi]==='i')?'#000':'#fff'; px.fillRect(0,0,padc.width,padc.height); px.drawImage(cv,30,30);
      var psms=kind==='serial'?[7,13]:(tall||bh>bw*.35?[6,7]:[7,6]);
      for(var pi=0;pi<psms.length;pi++){ try{ var rs=await T.ocr(padc,{psm:psms[pi],wl:wl}); reads.push({rot:rots[ri],mode:modes[mi],size:sizes[si],psm:psms[pi],lines:rs.lines,conf:rs.conf,words:rs.words}); }catch(e){} }
    }
  }
  return reads;
};

/* ---------- finding lines of writing (letters, any direction) ---------- */
function iou(a,b){ var ix=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0])),iy=Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1])),I=ix*iy,U=(a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-I; return U>0?I/U:0; }
function chains(C,Hc,o){
  var hmin=Hc*(o.hmin||.014),hmax=Hc*(o.hmax||.075);
  var g=C.list.filter(function(c){ return c.h>=hmin&&c.h<=hmax&&c.w<=c.h*1.7&&c.w>=c.h*.1&&c.cnt>=c.w*c.h*.1; }).sort(function(a,b){ return a.x0-b.x0; });
  var out=[],i,j,chain,last,c,gap,cy,ly,r;
  for(i=0;i<g.length;i++){ chain=[g[i]]; last=g[i];
    for(j=i+1;j<g.length;j++){ c=g[j]; if(c.x0<last.x0+1) continue; gap=c.x0-last.x1; if(gap>Math.max(last.h,c.h)*1.15){ if(c.x0>last.x1+last.h*2.5) break; else continue; }
      cy=(c.y0+c.y1)/2; ly=(last.y0+last.y1)/2; var dyB=Math.abs(c.y1-last.y1);
      if(Math.min(Math.abs(cy-ly),dyB)>Math.max(c.h,last.h)*.22) continue; r=c.h/last.h; if(r<.5||r>2) continue; chain.push(c); last=c; }
    if(chain.length>=4) out.push(chain); }
  out.sort(function(a,b){ return b.length-a.length; });
  var keep=[]; out.forEach(function(ch2){ if(keep.some(function(k){ return ch2.every(function(c2){ return k.indexOf(c2)>=0; }); })) return; keep.push(ch2); });
  /* join neighbours on the same line (an italic name often breaks into two chains) */
  var bx=keep.map(function(gl){ return {gl:gl.slice(),x0:gl[0].x0,x1:gl[gl.length-1].x1,y0:Math.min.apply(null,gl.map(function(c){return c.y0;})),y1:Math.max.apply(null,gl.map(function(c){return c.y1;}))}; }), merged=true;
  while(merged){ merged=false; for(i=0;i<bx.length&&!merged;i++) for(j=i+1;j<bx.length&&!merged;j++){ var A=bx[i],B=bx[j],hh=Math.min(A.y1-A.y0,B.y1-B.y0)+1,ov=Math.min(A.y1,B.y1)-Math.max(A.y0,B.y0),gx=Math.max(A.x0,B.x0)-Math.min(A.x1,B.x1);
      if(ov>hh*.6&&gx<hh*2.2&&gx>-hh*.2&&Math.abs((A.y1-A.y0)-(B.y1-B.y0))<hh*.5){ A.gl=A.gl.concat(B.gl).sort(function(a,b){return a.x0-b.x0;}); A.x0=Math.min(A.x0,B.x0); A.x1=Math.max(A.x1,B.x1); A.y0=Math.min(A.y0,B.y0); A.y1=Math.max(A.y1,B.y1); bx.splice(j,1); merged=true; } } }
  keep=bx.map(function(b){return b.gl;});
  return keep.map(function(gl){ var hs=gl.map(function(c){return c.h;}).sort(function(a,b){return a-b;}); return {x0:Math.min.apply(null,gl.map(function(c){return c.x0;})),x1:Math.max.apply(null,gl.map(function(c){return c.x1;})),y0:Math.min.apply(null,gl.map(function(c){return c.y0;})),y1:Math.max.apply(null,gl.map(function(c){return c.y1;})),n:gl.length,h:hs[hs.length>>1]}; });
}
T.findLines=function(ch,o){
  o=o||{}; var S=root.CardSerial,H=S._h,w=ch.w,h=ch.h,res=[];
  ['Y','R','B'].forEach(function(cn){ [true,false].forEach(function(bright){
    var hh=H.hat(ch.chan[cn],w,h,o.k||5,bright), p97=H.percentile(hh,.97), Tt=Math.max(16,p97*(o.tf||.4)), m=new Uint8Array(hh.length),i;
    for(i=0;i<hh.length;i++) m[i]=hh[i]>Tt?1:0;
    [0,90].forEach(function(rot){ var rr=H.rotate(m,w,h,rot), C=H.ccs(rr.a,rr.w,rr.h);
      chains(C,rr.h,o).forEach(function(r){ var box=rot===0?[r.x0,r.y0,r.x1,r.y1]:[r.y0,h-1-r.x1,r.y1,h-1-r.x0]; res.push({box:box,frame:rot,h:r.h,n:r.n,src:cn+(bright?'+':'-')}); }); });
  }); });
  var cl=[]; res.forEach(function(r){ var f=null,i; for(i=0;i<cl.length;i++) if(cl[i].frame===r.frame&&iou(cl[i].box,r.box)>.5){ f=cl[i]; break; } if(f){ f.votes++; if(r.n>f.n){ f.n=r.n; f.box=r.box; f.h=r.h; } } else cl.push({box:r.box,frame:r.frame,h:r.h,n:r.n,votes:1}); });
  /* a horizontal and a rotated detection of the same ink: keep the one with more letters */
  cl.sort(function(a,b){ return (b.votes*b.n*b.h)-(a.votes*a.n*a.h); });
  var out=[]; cl.forEach(function(c){ if(out.some(function(k){ return iou(k.box,c.box)>.5; })) return; out.push(c); });
  return out;
};
/* read each found line with several preparations; returns [{box,frame,reads:[{t,c,v}]}] */
T.readLines=async function(ch,o){
  o=o||{}; var S=root.CardSerial, lines=T.findLines(ch,o.find).slice(0,o.max||14), out=[], vars=o.vars||[{chan:'Y',mode:'bright'},{chan:'Y',mode:'dark'},{chan:'Y',mode:'raw'},{chan:'R',mode:'raw',invert:1}];
  for(var i=0;i<lines.length;i++){ var L=lines[i], rots=L.frame===0?[0]:[90,270], e={box:L.box,frame:L.frame,h:L.h,n:L.n,votes:L.votes,reads:[]}; out.push(e);
    if(o.shouldStop&&o.shouldStop()) break;
    for(var ri=0;ri<rots.length;ri++) for(var vi=0;vi<vars.length;vi++){
      var v=vars[vi], cv=S.cropVariant(ch,L.box,L.h,Object.assign({dh:o.dh||48},v),rots[ri]);
      try{ var rr=await CardOCR.recognize(cv,{psm:7,wl:''}); var t=(rr.data.text||'').replace(/\s+/g,' ').trim(); if(t) e.reads.push({t:t,c:Math.round(rr.data.confidence||0),v:v.chan+v.mode+(v.invert?'i':''),rot:rots[ri]}); }catch(x){}
    } }
  return out;
};
root.CardText=Object.assign(root.CardText||{},T);
})(typeof window!=='undefined'?window:this);
