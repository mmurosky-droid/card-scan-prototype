/* Collectors Desk v0.10 - serial / print-run finder.
   Looks for small printed or foil numbers such as 12/99, 040/150, 4/5, 1/1 anywhere on a card photo, in any of 4 orientations.
   Steps: bright-on-dark and dark-on-bright "top-hat" filters (so foil digits stand out from the picture), connected glyph shapes,
   rows of digit-sized glyphs, a small bundled digit template matcher, then tesseract (digits only) on tight crops. Votes across passes.
   Everything runs on this device. A wrong number is worse than a blank, so a result is only returned when independent reads agree. */
(function(root){
'use strict';
var S={};
/* ---------- small image helpers on plain typed arrays ---------- */
function minmax(g,w,h,k,max){
  var t=new Uint8Array(w*h),o=new Uint8Array(w*h),x,y,i,v,q,a,b;
  for(y=0;y<h;y++){ var r=y*w; for(x=0;x<w;x++){ v=max?0:255; a=x-k<0?0:x-k; b=x+k>=w?w-1:x+k; for(i=a;i<=b;i++){ q=g[r+i]; if(max?q>v:q<v) v=q; } t[r+x]=v; } }
  for(x=0;x<w;x++){ for(y=0;y<h;y++){ v=max?0:255; a=y-k<0?0:y-k; b=y+k>=h?h-1:y+k; for(i=a;i<=b;i++){ q=t[i*w+x]; if(max?q>v:q<v) v=q; } o[y*w+x]=v; } }
  return o;
}
/* bright=true: pixels brighter than their surroundings (foil / white print on dark). bright=false: darker print on a light area. */
function hat(g,w,h,k,bright){
  var base=bright?minmax(minmax(g,w,h,k,false),w,h,k,true):minmax(minmax(g,w,h,k,true),w,h,k,false), out=new Uint8Array(w*h), i, d;
  for(i=0;i<w*h;i++){ d=bright?g[i]-base[i]:base[i]-g[i]; out[i]=d>0?d:0; }
  return out;
}
function rot90(a,w,h){ var o=new Uint8Array(w*h),x,y; /* clockwise: new width=h */ for(y=0;y<h;y++) for(x=0;x<w;x++) o[x*h+(h-1-y)]=a[y*w+x]; return {a:o,w:h,h:w}; }
function rot180(a,w,h){ var o=new Uint8Array(w*h),n=w*h,i; for(i=0;i<n;i++) o[n-1-i]=a[i]; return {a:o,w:w,h:h}; }
function rotate(a,w,h,deg){ if(deg===0) return {a:a,w:w,h:h}; if(deg===90) return rot90(a,w,h); if(deg===180) return rot180(a,w,h); var r=rot90(a,w,h); r=rot180(r.a,r.w,r.h); return r; }
function percentile(a,p){ var hs=new Uint32Array(256),i,n=a.length,acc=0; for(i=0;i<n;i++) hs[a[i]]++; var tgt=n*p; for(i=0;i<256;i++){ acc+=hs[i]; if(acc>=tgt) return i; } return 255; }
/* connected components of a 0/1 mask (8-connected) */
function ccs(m,w,h){
  var lab=new Int32Array(w*h), res=[], id=0, st=[], i, p, x, y, dx, dy, nx, ny, q, x0, y0, x1, y1, cnt;
  for(i=0;i<w*h;i++){ if(!m[i]||lab[i]) continue; id++; x0=w; y0=h; x1=0; y1=0; cnt=0; st.length=0; st.push(i); lab[i]=id;
    while(st.length){ p=st.pop(); x=p%w; y=(p-x)/w; cnt++; if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
      for(dy=-1;dy<=1;dy++){ ny=y+dy; if(ny<0||ny>=h) continue; for(dx=-1;dx<=1;dx++){ nx=x+dx; if(nx<0||nx>=w) continue; q=ny*w+nx; if(m[q]&&!lab[q]){ lab[q]=id; st.push(q); } } } }
    res.push({id:id,x0:x0,y0:y0,x1:x1,y1:y1,cnt:cnt,w:x1-x0+1,h:y1-y0+1}); }
  return {list:res,lab:lab,w:w,h:h};
}

/* glyph -> fixed-size vector (area average of the ink mask inside its bounding box, stretched to GW x GH) */
var GW=14,GH=20;
function glyphVec(m,w,box){
  var x0=box[0],y0=box[1],bw=box[2]-box[0]+1,bh=box[3]-box[1]+1,v=new Float32Array(GW*GH),c=new Float32Array(GW*GH),x,y,gx,gy,i;
  for(y=0;y<bh;y++){ gy=Math.min(GH-1,(y*GH/bh)|0); for(x=0;x<bw;x++){ gx=Math.min(GW-1,(x*GW/bw)|0); i=gy*GW+gx; c[i]++; if(m[(y0+y)*w+x0+x]) v[i]++; } }
  for(i=0;i<v.length;i++) v[i]=c[i]?v[i]/c[i]:0;
  return v;
}
function blur3(v){ var o=new Float32Array(v.length),x,y,dx,dy,s,n,xx,yy; for(y=0;y<GH;y++) for(x=0;x<GW;x++){ s=0;n=0; for(dy=-1;dy<=1;dy++) for(dx=-1;dx<=1;dx++){ xx=x+dx;yy=y+dy; if(xx<0||yy<0||xx>=GW||yy>=GH) continue; s+=v[yy*GW+xx]*(dx||dy?1:2); n+=(dx||dy?1:2);} o[y*GW+x]=s/n; } return o; }
function norm(v){ var n=v.length,m=0,i,s=0; for(i=0;i<n;i++) m+=v[i]; m/=n; var o=new Float32Array(n); for(i=0;i<n;i++){ o[i]=v[i]-m; s+=o[i]*o[i]; } s=Math.sqrt(s)||1; for(i=0;i<n;i++) o[i]/=s; return o; }
S._glyphVec=glyphVec; S._blur3=blur3; S._norm=norm; S.GW=GW; S.GH=GH;
S._h={minmax:minmax,hat:hat,rotate:rotate,percentile:percentile,ccs:ccs};

/* ---------- bundled digit shapes ---------- */
var bank=null;
function unb(b){ var t=atob(b),v=new Float32Array(t.length),i; for(i=0;i<t.length;i++) v[i]=t.charCodeAt(i)/255; return v; }
function loadBank(){
  if(bank) return bank; var src=root.__SERIAL_BANK; if(!src) return null; bank={}; 
  Object.keys(src.t).forEach(function(c){ bank[c]=src.t[c].map(function(e){ return {ar:e[0],v:norm(blur3(unb(e[1])))}; }); });
  return bank;
}
function flipVec(v){ var o=new Float32Array(v.length),n=v.length,i; for(i=0;i<n;i++) o[n-1-i]=v[i]; return o; }
/* returns best class for a glyph vector: {c, s, second} ; c is a digit, '/', or '?' (looks like a letter / not a digit) */
function classify(vec,ar){
  var b=loadBank(); if(!b) return {c:'?',s:0,all:{}}; var g=norm(blur3(vec)),best={},k,j,t,d,sc,i,n=g.length;
  for(k in b){ var bs=-9; for(j=0;j<b[k].length;j++){ t=b[k][j]; d=0; for(i=0;i<n;i++) d+=g[i]*t.v[i]; sc=d-0.16*Math.abs(Math.log(ar/t.ar)); if(sc>bs) bs=sc; } best[k]=bs; }
  var ord=Object.keys(best).sort(function(a,b2){ return best[b2]-best[a]; });
  return {c:ord[0],s:best[ord[0]],second:best[ord[1]],c2:ord[1],all:best};
}
function glyphVecLab(lab,id,w,box){
  var x0=box[0],y0=box[1],bw=box[2]-box[0]+1,bh=box[3]-box[1]+1,v=new Float32Array(GW*GH),c=new Float32Array(GW*GH),x,y,gx,gy,i;
  for(y=0;y<bh;y++){ gy=Math.min(GH-1,(y*GH/bh)|0); for(x=0;x<bw;x++){ gx=Math.min(GW-1,(x*GW/bw)|0); i=gy*GW+gx; c[i]++; if(lab[(y0+y)*w+x0+x]===id) v[i]++; } }
  for(i=0;i<v.length;i++) v[i]=c[i]?v[i]/c[i]:0; return v;
}
S._classify=classify; S._glyphVecLab=glyphVecLab; S._flipVec=flipVec; S._loadBank=loadBank;
/* ---------- finding rows of digit-sized glyphs ---------- */
function rowsFromCC(C,Hc,o){
  var hmin=Hc*(o.hmin||.011),hmax=Hc*(o.hmax||.05);
  var g=C.list.filter(function(c){ return c.h>=hmin&&c.h<=hmax&&c.w<=c.h*1.15&&c.w>=c.h*.08&&c.cnt>=c.w*c.h*.12; }).sort(function(a,b){ return a.x0-b.x0; });
  var out=[],i,j,chain,last,c,gap,cy,ly,r;
  for(i=0;i<g.length;i++){ chain=[g[i]]; last=g[i];
    for(j=i+1;j<g.length;j++){ c=g[j]; if(c.x0<last.x1-2) continue; gap=c.x0-last.x1; if(gap>last.h*(o.maxGap||1.8)){ if(c.x0>last.x1+last.h*3.5) break; else continue; }
      cy=(c.y0+c.y1)/2; ly=(last.y0+last.y1)/2; if(Math.abs(cy-ly)>Math.min(c.h,last.h)*.3) continue; r=c.h/last.h; if(r<.7||r>1.45) continue; chain.push(c); last=c; }
    if(chain.length>=3&&chain.length<=14) out.push({gl:chain}); }
  out.sort(function(a,b){ return b.gl.length-a.gl.length; });
  var keep=[]; out.forEach(function(r2){ if(keep.some(function(k){ return r2.gl.every(function(c2){ return k.gl.indexOf(c2)>=0; }); })) return; keep.push(r2); });
  keep.forEach(function(r2){ var gl=r2.gl; r2.x0=gl[0].x0; r2.x1=gl[gl.length-1].x1; r2.y0=Math.min.apply(null,gl.map(function(c){return c.y0;})); r2.y1=Math.max.apply(null,gl.map(function(c){return c.y1;})); });
  return keep;
}
function iou(a,b){ var ix=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0])),iy=Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1])),I=ix*iy,U=(a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-I; return U>0?I/U:0; }
/* ch = {w,h,chan:{Y,R,B}}  -> candidate rows in the original frame, each with its glyph shape reads */
S.findRows=function(ch,o){
  o=o||{}; var w=ch.w,h=ch.h,res=[],names=Object.keys(ch.chan);
  names.forEach(function(cn){ [true,false].forEach(function(bright){
    var hh=hat(ch.chan[cn],w,h,o.k||4,bright), p97=percentile(hh,o.pc||.97);
    (o.tfs||[.5,.3]).forEach(function(tf){
    var T=Math.max(o.tmin||14,p97*tf), m=new Uint8Array(hh.length),i;
    for(i=0;i<hh.length;i++) m[i]=hh[i]>T?1:0;
    [0,90].forEach(function(rot){ var rr=rotate(m,w,h,rot), C=ccs(rr.a,rr.w,rr.h), rows=rowsFromCC(C,rr.h,o);
      rows.forEach(function(r){ var box=rot===0?[r.x0,r.y0,r.x1,r.y1]:[r.y0,h-1-r.x1,r.y1,h-1-r.x0];
        var gl=r.gl.map(function(c){ var bx=[c.x0,c.y0,c.x1,c.y1]; var gm=new Uint8Array(c.w*c.h),yy,xx; for(yy=0;yy<c.h;yy++) for(xx=0;xx<c.w;xx++) if(C.lab[(c.y0+yy)*rr.w+c.x0+xx]===c.id) gm[yy*c.w+xx]=1; return {box:bx,ar:c.w/c.h,vec:glyphVecLab(C.lab,c.id,rr.w,bx),cnt:c.cnt,gm:gm}; });
        res.push({box:box,frame:rot,src:cn+(bright?'+':'-'),gl:gl,T:T,fw:rr.w,fh:rr.h}); }); });
    }); }); });
  var cl=[]; res.forEach(function(r){ var f=null,i; for(i=0;i<cl.length;i++) if(iou(cl[i].box,r.box)>.5){ f=cl[i]; break; } if(f){ f.votes++; f.alts.push(r); if(r.gl.length>f.main.gl.length) f.main=r; } else cl.push({box:r.box,votes:1,main:r,alts:[r]}); });
  return cl;
};

/* ---------- digits-only shape read + row triage ---------- */
function classifyDigits(vec,ar){
  var r=classify(vec,ar),best=null,k,L=r.all['?']; for(k in r.all){ if(k==='?') continue; if(best===null||r.all[k]>r.all[best]) best=k; }
  return {c:best,s:r.all[best],letter:L,all:r.all};
}
S.shapeRead=function(row){
  var best=null;
  [0,180].forEach(function(ori){
    var seq=ori===0?row.gl:row.gl.slice().reverse(),txt='',tot=0,lett=0,sc=[];
    seq.forEach(function(g){ var v=ori===0?g.vec:flipVec(g.vec), c=classifyDigits(v,g.ar); txt+=c.c; tot+=c.s; sc.push(c.s); if(c.letter>c.s+0.02) lett++; });
    var mean=tot/seq.length, sl=txt.indexOf('/'); var shaped=/^[0-9]{1,4}\/[0-9]{1,4}$/.test(txt);
    var q=mean-0.25*lett/seq.length+(shaped?0.12:0);
    if(!best||q>best.q) best={text:txt,mean:mean,orient:ori,letters:lett,q:q,shaped:shaped,sc:sc};
  });
  return best;
};
/* ---------- crops for tesseract ---------- */
function cutChan(a,w,box){ var x0=box[0],y0=box[1],cw=box[2]-box[0]+1,ch=box[3]-box[1]+1,o=new Uint8Array(cw*ch),y; for(y=0;y<ch;y++) o.set(a.subarray((y0+y)*w+x0,(y0+y)*w+x0+cw),y*cw); return {a:o,w:cw,h:ch}; }
function toCanvas(g,w,h,th,pad){ /* g: 0..255 black text on white; scaled so the crop is th pixels tall, white padding around */
  var src=document.createElement('canvas'); src.width=w; src.height=h; var sx=src.getContext('2d'), id=sx.createImageData(w,h), i; for(i=0;i<w*h;i++){ id.data[i*4]=id.data[i*4+1]=id.data[i*4+2]=g[i]; id.data[i*4+3]=255; } sx.putImageData(id,0,0);
  var sc=th/h, ow=Math.round(w*sc), cv=document.createElement('canvas'); cv.width=ow+pad*2; cv.height=th+pad*2; var cx=cv.getContext('2d'); cx.fillStyle='#fff'; cx.fillRect(0,0,cv.width,cv.height); cx.imageSmoothingQuality='high'; cx.drawImage(src,0,0,w,h,pad,pad,ow,th); return cv;
}
/* variant: {chan, mode:'bright'|'dark'|'raw'} ; frame/orient decide the rotation that makes the text upright */
S.cropVariant=function(ch,box,rowH,v,rot){
  var padx=Math.round(rowH*1.1),pady=Math.round(rowH*.55),b=[Math.max(0,box[0]-padx),Math.max(0,box[1]-pady),Math.min(ch.w-1,box[2]+padx),Math.min(ch.h-1,box[3]+pady)];
  var c=cutChan(ch.chan[v.chan],ch.w,b), g;
  if(v.mode==='raw'){ var hs=new Uint32Array(256),n=c.w*c.h,i,lo=0,hi=255,acc=0; for(i=0;i<n;i++) hs[c.a[i]]++; for(i=0;i<256;i++){ acc+=hs[i]; if(acc>n*.02){lo=i;break;} } acc=0; for(i=255;i>=0;i--){ acc+=hs[i]; if(acc>n*.02){hi=i;break;} }
    var k=255/Math.max(30,hi-lo); g=new Uint8Array(n); for(i=0;i<n;i++) g[i]=Math.max(0,Math.min(255,((c.a[i]-lo)*k)|0)); if(v.invert) for(i=0;i<n;i++) g[i]=255-g[i]; }
  else { var hh=hat(c.a,c.w,c.h,4,v.mode==='bright'), mx=Math.max(1,percentile(hh,.995)), n2=c.w*c.h; g=new Uint8Array(n2); for(var j=0;j<n2;j++) g[j]=255-Math.min(255,(hh[j]*255/mx)|0); }
  var r=rotate(g,c.w,c.h,rot||0); return toCanvas(r.a,r.w,r.h,Math.round(r.h*(v.dh||46)/rowH),24);
};

/* draw only the detected glyph shapes of a row, black on white, evenly spaced and upscaled - removes borders, textures and neighbours that confuse the reader */
S.maskCanvas=function(row,ori,dh,bold){
  var gl=ori===0?row.gl:row.gl.slice().reverse(), hAvg=gl.reduce(function(a,g){return a+(g.box[3]-g.box[1]+1);},0)/gl.length, sc=(dh||46)/hAvg;
  var y0=Math.min.apply(null,gl.map(function(g){return g.box[1];})), y1=Math.max.apply(null,gl.map(function(g){return g.box[3];})), H=Math.round((y1-y0+1)*sc)+48;
  var gap=Math.round(hAvg*.35*sc), W=48, i; var items=gl.map(function(g){ var gw=g.box[2]-g.box[0]+1,gh=g.box[3]-g.box[1]+1; var cv=document.createElement('canvas'); cv.width=gw; cv.height=gh; var cx=cv.getContext('2d'),id=cx.createImageData(gw,gh),k; for(k=0;k<gw*gh;k++){ id.data[k*4]=id.data[k*4+1]=id.data[k*4+2]=0; id.data[k*4+3]=g.gm[k]?255:0; } cx.putImageData(id,0,0); return {cv:cv,w:Math.round(gw*sc),h:Math.round(gh*sc),dy:Math.round((g.box[1]-y0)*sc)}; });
  items.forEach(function(it){ W+=it.w+gap; });
  var out=document.createElement('canvas'); out.width=W; out.height=H; var ox=out.getContext('2d'); ox.fillStyle='#fff'; ox.fillRect(0,0,W,H); ox.imageSmoothingQuality='high'; var x=24;
  items.forEach(function(it){ ox.drawImage(it.cv,x,24+it.dy,it.w,it.h); if(bold){ ox.drawImage(it.cv,x-1,24+it.dy,it.w,it.h); ox.drawImage(it.cv,x+1,24+it.dy,it.w,it.h);} x+=it.w+gap; });
  if(ori===180&&false){} return out;
};
S._parseSerial=function(txt){
  var t=String(txt||'').replace(/\s+/g,'').replace(/[|\\!]/g,'/'), m, out=[], re=/(\d{1,4})\/(\d{1,4})/g;
  while((m=re.exec(t))) out.push({num:m[1],den:m[2]}); return out;
};

/* ---------- the reader ---------- */
function loadChans(im,H){
  var sc=H/im.naturalHeight,w=Math.round(im.naturalWidth*sc),h=H,cv=document.createElement('canvas'); cv.width=w; cv.height=h;
  var cx=cv.getContext('2d',{willReadFrequently:true}); cx.imageSmoothingQuality='high'; cx.drawImage(im,0,0,w,h);
  var d=cx.getImageData(0,0,w,h).data,n=w*h,Y=new Uint8Array(n),R=new Uint8Array(n),B=new Uint8Array(n),i;
  for(i=0;i<n;i++){ R[i]=d[i*4]; B[i]=d[i*4+2]; Y[i]=(d[i*4]*299+d[i*4+1]*587+d[i*4+2]*114)/1000|0; }
  return {w:w,h:h,chan:{Y:Y,R:R,B:B},cv:cv};
}
S.loadChans=loadChans;
S.candidates=function(ch,o){
  var cl=S.findRows(ch,o),out=[];
  cl.forEach(function(c){ var r=c.main; if(r.gl.length<3||r.gl.length>10) return; var sr=S.shapeRead(r); c.shape=sr; c.q=sr.q+(sr.text.indexOf('/')>0&&sr.text.indexOf('/')<sr.text.length-1?.08:0); out.push(c); });
  out.sort(function(a,b){ return b.q-a.q; }); return out;
};
S.variantsFor=function(c){
  var seen={},v=[]; c.alts.forEach(function(a){ var k=a.src; if(seen[k]) return; seen[k]=1; v.push({chan:a.src.charAt(0),mode:a.src.charAt(1)==='+'?'bright':'dark'}); });
  return v;
};
S.ALLVARS=(function(){ var v=[]; ['Y','R','B'].forEach(function(c){ v.push({chan:c,mode:'bright'},{chan:c,mode:'dark'}); }); v.push({chan:'Y',mode:'raw'},{chan:'Y',mode:'raw',invert:1},{chan:'R',mode:'raw'},{chan:'R',mode:'raw',invert:1}); return v; })();
S.read=async function(ch,o){
  o=o||{}; var cands=S.candidates(ch,o.find), t0=Date.now(), votes=[], trace=[], psms=o.psms||[7], dhs=o.dhs||[40,56];
  var top=cands.slice(0,o.stage1||30), WL='0123456789/', cheap=[];
  function geo(c){ var r=c.main; var rowH=r.gl.reduce(function(a,g){return a+(g.box[3]-g.box[1]+1);},0)/r.gl.length, ori=c.shape.orient; return {rowH:rowH,ori:ori,rot:((r.frame===90?90:0)+ori)%360}; }
  async function one(cv,meta,e){ for(var pm=0;pm<psms.length;pm++){ var rr=await CardOCR.recognize(cv,{psm:psms[pm],wl:WL}), txt=(rr.data.text||'').trim(), pr=S._parseSerial(txt); e.reads.push({v:meta,psm:psms[pm],txt:txt}); pr.forEach(function(x){ votes.push({ci:e.ci,num:x.num,den:x.den,v:meta,psm:psms[pm]}); }); e.parsed=e.parsed||pr.length>0; } }
  for(var ci=0;ci<top.length;ci++){
    var c=top[ci], g=geo(c), e={ci:ci,box:c.box,shape:c.shape.text,q:+c.q.toFixed(2),reads:[],parsed:false}; trace.push(e);
    await one(S.maskCanvas(c.main,g.ori,46,false),'mask',e);
    [{chan:'Y',mode:'bright'},{chan:'Y',mode:'dark'},{chan:'Y',mode:'raw'},{chan:'Y',mode:'raw',invert:1}].forEach(function(vv){ cheap.push([c,g,vv,e]); });
    if(c.shape.shaped) e.parsed=true;
  }
  for(var ki=0;ki<cheap.length;ki++){ var ck=cheap[ki]; await one(S.cropVariant(ch,ck[0].box,ck[1].rowH,Object.assign({dh:46},ck[2]),ck[1].rot),ck[2].chan+ck[2].mode+(ck[2].invert?'i':''),ck[3]); }
  var heavy=trace.filter(function(e){ return e.parsed; }).slice(0,o.heavy||6);
  for(var hi=0;hi<heavy.length;hi++){
    var e2=heavy[hi], c2=top[e2.ci], g2=geo(c2);
    for(var di=0;di<dhs.length;di++){
      await one(S.maskCanvas(c2.main,g2.ori,dhs[di],false),'mask'+dhs[di],e2);
      await one(S.maskCanvas(c2.main,g2.ori,dhs[di],true),'maskB'+dhs[di],e2);
      for(var vi=0;vi<S.ALLVARS.length;vi++){ var vv=S.ALLVARS[vi]; await one(S.cropVariant(ch,c2.box,g2.rowH,Object.assign({dh:dhs[di]},vv),g2.rot),vv.chan+vv.mode+(vv.invert?'i':'')+dhs[di],e2); }
    }
  }
  return {votes:votes,trace:trace,ms:Date.now()-t0,ncand:cands.length};
};

/* ---------- deciding from the votes ---------- */
var RUNS={1:1,2:1,3:1,4:1,5:1,6:1,7:1,8:1,9:1,10:1,12:1,15:1,20:1,25:1,30:1,35:1,40:1,45:1,49:1,50:1,60:1,65:1,70:1,75:1,80:1,85:1,90:1,99:1,100:1,110:1,125:1,149:1,150:1,175:1,199:1,200:1,225:1,249:1,250:1,275:1,299:1,300:1,350:1,399:1,400:1,449:1,499:1,500:1,599:1,750:1,799:1,899:1,999:1,1000:1};
function fam(v){ return /^band/.test(v)?'band':/^mask/.test(v)?'mask':/raw/.test(v)?'raw':'hat'; }
S.plausible=function(num,den){ var n=parseInt(num,10),d=parseInt(den,10); return n>=1&&d>=1&&n<=d&&d<=9999&&(RUNS[d]===1||d<=99||d%5===0)&&num.length<=den.length+1; };
/* same print run, one read is a cut-off version of the other (a missing last digit of the run, or missing first digit of the number) */
function compat(a,b){ if(a===b) return true; var A=a.split('/'),B=b.split('/'); if(A[0]===B[0]&&(A[1].length<B[1].length?B[1].indexOf(A[1])===0:A[1].indexOf(B[1])===0)) return true; if(A[1]===B[1]&&(A[0].length<B[0].length?B[0].slice(-A[0].length)===A[0]:A[0].slice(-B[0].length)===B[0])) return true; return false; }
/* returns {fill:'040/150'|null, suggest:[{text,score}], why} ; fill only when two different kinds of preparation agree, 3+ exact reads, and no rival comes close */
S.decide=function(votes){
  var T={},RAW={}; votes.forEach(function(v){ var k=v.num+'/'+v.den; RAW[k]=(RAW[k]||0)+1; if(!S.plausible(v.num,v.den)) return; var t=T[k]=T[k]||{text:k,n:0,fams:{},support:0}; t.n++; t.fams[fam(v.v)]=1; });
  var keys=Object.keys(T); keys.forEach(function(k){ var t=T[k]; Object.keys(RAW).forEach(function(j){ if(j!==k&&compat(j,k)&&j.length<k.length) t.support+=RAW[j]; }); t.score=t.n*2+t.support*.5+Object.keys(t.fams).length; });
  var list=keys.map(function(k){return T[k];}).sort(function(a,b){return b.score-a.score;}), lead=list[0];
  if(!lead) return {fill:null,suggest:[],why:'nothing'};
  var rival=list.filter(function(t){ return t!==lead&&!compat(t.text,lead.text); }).reduce(function(m,t){return Math.max(m,t.n);},0);
  var ok=lead.n>=3&&Object.keys(lead.fams).length>=2&&lead.n>=2*rival;
  /* a longer rival that this read is only a cut-off of must not hide: the cut-off must be the best-supported full reading */
  var longer=list.filter(function(t){ return t!==lead&&t.text.length>lead.text.length&&compat(lead.text,t.text); }).length;
  if(longer) ok=false;
  return {fill:ok?lead.text:null,suggest:list.slice(0,4).filter(function(t){return t.n>=1;}).map(function(t){return {text:t.text,n:t.n};}),why:ok?'agree':'weak',lead:lead.n};
};
root.CardSerial=Object.assign(root.CardSerial||{},S);
})(typeof window!=='undefined'?window:this);
