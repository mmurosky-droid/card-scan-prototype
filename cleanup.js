/* Collectors Desk v0.9 (Mr. Moose Enterprises, LLC) - Clean up photo. Runs only on this phone, in plain canvas JS.
   What it does: finds the card (or slab / case) outline, straightens it, evens out light and color a little,
   softens glare a little (highlight compression only), sharpens slightly, and puts it on neutral gray.
   What it never does: invent detail, fill in, smooth or hide scratches, creases, dents, wear or centering. */
(function(){
'use strict';
var BG=[214,214,214];
function clamp(v,a,b){return v<a?a:v>b?b:v}
function loadImg(blob){return new Promise(function(res,rej){var u=URL.createObjectURL(blob),im=new Image();im.onload=function(){URL.revokeObjectURL(u);res(im)};im.onerror=function(){URL.revokeObjectURL(u);rej(new Error('image failed to load'))};im.src=u;});}
function tick(){return new Promise(function(r){setTimeout(r,0)})}
function toBlob(cv,q){return new Promise(function(res){cv.toBlob(function(b){res(b)},'image/jpeg',q||.92)})}

/* ---------- 1. find the outline: four straight edges ---------- */
function analyse(im,long){
  var s=Math.min(1,long/Math.max(im.naturalWidth,im.naturalHeight)), w=Math.max(8,Math.round(im.naturalWidth*s)), h=Math.max(8,Math.round(im.naturalHeight*s));
  var cv=document.createElement('canvas'); cv.width=w; cv.height=h; var cx=cv.getContext('2d',{willReadFrequently:true}); cx.drawImage(im,0,0,w,h);
  var d=cx.getImageData(0,0,w,h).data, Y=new Float32Array(w*h), i;
  for(i=0;i<w*h;i++) Y[i]=0.299*d[i*4]+0.587*d[i*4+1]+0.114*d[i*4+2];
  // light box blur (3x3)
  var B=new Float32Array(w*h), x, y;
  for(y=0;y<h;y++)for(x=0;x<w;x++){var sum=0,n=0;for(var dy=-1;dy<=1;dy++){var yy=y+dy;if(yy<0||yy>=h)continue;for(var dx=-1;dx<=1;dx++){var xx=x+dx;if(xx<0||xx>=w)continue;sum+=Y[yy*w+xx];n++}}B[y*w+x]=sum/n;}
  var gx=new Float32Array(w*h), gy=new Float32Array(w*h), mags=[];
  for(y=1;y<h-1;y++)for(x=1;x<w-1;x++){var p=y*w+x;
    var a=B[p-w-1],b=B[p-w],c=B[p-w+1],dd=B[p-1],f=B[p+1],g=B[p+w-1],hh=B[p+w],ii=B[p+w+1];
    var sx=(c+2*f+ii)-(a+2*dd+g), sy=(g+2*hh+ii)-(a+2*b+c); gx[p]=sx/4; gy[p]=sy/4; if((p&3)===0) mags.push(Math.sqrt(sx*sx+sy*sy)/4);}
  mags.sort(function(a,b){return a-b}); var cap=Math.max(6,mags[Math.floor(mags.length*0.93)]||6);
  return {w:w,h:h,s:s,gx:gx,gy:gy,cap:cap,Y:Y,d:d};
}
function sideCands(A,side){
  // vertical sides: x = r + (y-h/2)*t ; horizontal: y = r + (x-w/2)*t
  var w=A.w,h=A.h,vert=(side==='L'||side==='R'), N=vert?h:w, M=vert?w:h, gx=A.gx,gy=A.gy,cap=A.cap;
  var r0,r1; if(side==='L'||side==='T'){r0=1;r1=Math.floor(M*0.5)}else{r0=Math.floor(M*0.5);r1=M-2}
  var best=new Float32Array(M), bang=new Float32Array(M), amax=18, ai, r, k, a0=Math.floor(N*0.04), a1=Math.floor(N*0.96);
  for(ai=-amax;ai<=amax;ai++){
    var th=ai*Math.PI/180, t=Math.tan(th), cs=Math.cos(th), sn=Math.sin(th);
    for(r=r0;r<=r1;r++){
      var sc=0,cnt=0;
      for(k=a0;k<a1;k++){
        var u=r+(k-N/2)*t, xi,yi; if(vert){xi=Math.round(u);yi=k}else{xi=k;yi=Math.round(u)}
        if(xi<1||xi>=w-1||yi<1||yi>=h-1) continue;
        var p=yi*w+xi, nv=vert?(gx[p]*cs-gy[p]*sn):(gy[p]*cs-gx[p]*sn); nv=Math.abs(nv); sc+=nv>cap?1:nv/cap; cnt++;
      }
      var v=cnt>N*0.5?sc/N:0;
      if(v>best[r]){best[r]=v;bang[r]=ai}
    }
  }
  var out=[]; for(r=r0+1;r<r1;r++){ if(best[r]<0.12) continue; var ok=true; for(k=-5;k<=5;k++){ var q=r+k; if(q>=r0&&q<=r1&&best[q]>best[r]) ok=false; if(k<0&&q>=r0&&best[q]===best[r]) ok=false; } if(ok) out.push({r:r,a:bang[r],s:best[r]}); }
  out.sort(function(a,b){return b.s-a.s}); return out.slice(0,5);
}
function lineAt(side,c,A){ // returns {p:[x,y], d:[dx,dy]}
  var t=Math.tan(c.a*Math.PI/180), w=A.w,h=A.h;
  if(side==='L'||side==='R') return {p:[c.r-(h/2)*t,0],d:[t,1]};
  return {p:[0,c.r-(w/2)*t],d:[1,t]};
}
function inter(l1,l2){ var a=l1.d[0],b=-l2.d[0],c=l1.d[1],d=-l2.d[1], det=a*d-b*c; if(Math.abs(det)<1e-6) return null; var rx=l2.p[0]-l1.p[0], ry=l2.p[1]-l1.p[1]; var tt=(rx*d-b*ry)/det; return [l1.p[0]+a*tt,l1.p[1]+c*tt]; }
function dist(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1])}
function areaQ(q){var s=0;for(var i=0;i<4;i++){var a=q[i],b=q[(i+1)%4];s+=a[0]*b[1]-b[0]*a[1]}return Math.abs(s)/2}
function convex(q){var sg=0;for(var i=0;i<4;i++){var a=q[i],b=q[(i+1)%4],c=q[(i+2)%4],cr=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);if(cr===0)return false;var s=cr>0?1:-1;if(sg&&s!==sg)return false;sg=s}return true}
function findQuad(A,mode){
  var C={L:sideCands(A,'L'),R:sideCands(A,'R'),T:sideCands(A,'T'),B:sideCands(A,'B')};
  if(!C.L.length||!C.R.length||!C.T.length||!C.B.length) return {fail:'edges'};
  var best=null, imgA=A.w*A.h, li,ri,ti,bi;
  for(li=0;li<C.L.length;li++)for(ri=0;ri<C.R.length;ri++)for(ti=0;ti<C.T.length;ti++)for(bi=0;bi<C.B.length;bi++){
    var L=C.L[li],R=C.R[ri],T=C.T[ti],Bm=C.B[bi];
    if(Math.abs(L.a-R.a)>6||Math.abs(T.a-Bm.a)>6||Math.abs(L.a-T.a)>9) continue;
    var lL=lineAt('L',L,A),lR=lineAt('R',R,A),lT=lineAt('T',T,A),lB=lineAt('B',Bm,A);
    var tl=inter(lL,lT),tr=inter(lR,lT),br=inter(lR,lB),bl=inter(lL,lB); if(!tl||!tr||!br||!bl) continue;
    var q=[tl,tr,br,bl]; if(!convex(q)) continue;
    var ok=true; q.forEach(function(p){ if(p[0]<-A.w*0.04||p[0]>A.w*1.04||p[1]<-A.h*0.04||p[1]>A.h*1.04) ok=false; }); if(!ok) continue;
    var wq=(dist(tl,tr)+dist(bl,br))/2, hq=(dist(tl,bl)+dist(tr,br))/2, asp=wq/hq, ar=areaQ(q)/imgA;
    if(ar<0.28||asp<0.42||asp>1.0) continue;
    var sc=(L.s+R.s+T.s+Bm.s)/4, minS=Math.min(L.s,R.s,T.s,Bm.s);
    // prefer the outermost strong outline (slab / case outline), and plausible card or slab shapes
    var ap; if(mode==='graded'){ ap=1-Math.min(Math.abs(asp-0.60)/0.12,1); } else { var dv=asp<0.62?0.62-asp:(asp>0.76?asp-0.76:0); ap=1-Math.min(dv/0.12,1); }
    var tot=sc*1.0+minS*0.8+ar*0.55+ap*0.45;
    if(!best||tot>best.tot) best={tot:tot,q:q,sc:sc,minS:minS,ar:ar,asp:asp,ang:(L.a+T.a)/2,sides:[L.s,R.s,T.s,Bm.s],cand:[L.r,R.r,T.r,Bm.r]};
  }
  if(!best) return {fail:'shape'};
  if(best.minS<0.22||best.sc<0.3) return {fail:'weak',best:best};
  if(best.ar<0.4) return {fail:'small',best:best};  // the outline found is too small to be the whole card (card may run off the photo)
  return {quad:best.q,ang:best.ang,conf:best.sc,asp:best.asp,ar:best.ar,sides:best.sides};
}

/* ---------- 2. straighten (perspective warp) ---------- */
function homog(q,W,H){ // maps unit-rect output (0..W,0..H) to source quad q (tl,tr,br,bl)
  var x0=q[0][0],y0=q[0][1],x1=q[1][0],y1=q[1][1],x2=q[2][0],y2=q[2][1],x3=q[3][0],y3=q[3][1];
  var dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3,dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3, a,b,c,d,e,f,g,h;
  var den=dx1*dy2-dx2*dy1; g=(dx3*dy2-dx2*dy3)/den; h=(dx1*dy3-dx3*dy1)/den;
  a=x1-x0+g*x1; b=x3-x0+h*x3; c=x0; d=y1-y0+g*y1; e=y3-y0+h*y3; f=y0;
  return {a:a/W,b:b/H,c:c,d:d/W,e:e/H,f:f,g:g/W,h:h/H};
}
function warp(srcCv,q,W,H){
  var sx=srcCv.getContext('2d',{willReadFrequently:true}), sw=srcCv.width, sh=srcCv.height, sd=sx.getImageData(0,0,sw,sh).data;
  var M=homog(q,W,H), out=new Uint8ClampedArray(W*H*4), x,y;
  for(y=0;y<H;y++)for(x=0;x<W;x++){
    var den=M.g*x+M.h*y+1, u=(M.a*x+M.b*y+M.c)/den, v=(M.d*x+M.e*y+M.f)/den, o=(y*W+x)*4;
    if(u<0||v<0||u>sw-1||v>sh-1){ var uu=clamp(u,0,sw-1),vv=clamp(v,0,sh-1); u=uu;v=vv; }
    var x0=u|0,y0=v|0,x1=Math.min(sw-1,x0+1),y1=Math.min(sh-1,y0+1),fx=u-x0,fy=v-y0,i00=(y0*sw+x0)*4,i10=(y0*sw+x1)*4,i01=(y1*sw+x0)*4,i11=(y1*sw+x1)*4;
    for(var k=0;k<3;k++){ out[o+k]=(sd[i00+k]*(1-fx)+sd[i10+k]*fx)*(1-fy)+(sd[i01+k]*(1-fx)+sd[i11+k]*fx)*fy; }
    out[o+3]=255;
  }
  return new ImageData(out,W,H);
}

/* ---------- 3. gentle light, color, glare, sharpen (no invented detail) ---------- */
function boxBlurLuma(Y,w,h,r){ // separable box blur, returns Float32Array
  var t=new Float32Array(w*h), o=new Float32Array(w*h), x,y,k;
  for(y=0;y<h;y++){var s=0,c=0,row=y*w;for(x=-r;x<=r;x++){var xx=clamp(x,0,w-1);s+=Y[row+xx];c++}for(x=0;x<w;x++){t[row+x]=s/c;var a=clamp(x+r+1,0,w-1),b=clamp(x-r,0,w-1);s+=Y[row+a]-Y[row+b]}}
  for(x=0;x<w;x++){var s2=0,c2=0;for(y=-r;y<=r;y++){s2+=t[clamp(y,0,h-1)*w+x];c2++}for(y=0;y<h;y++){o[y*w+x]=s2/c2;var a2=clamp(y+r+1,0,h-1),b2=clamp(y-r,0,h-1);s2+=t[a2*w+x]-t[b2*w+x]}}
  return o;
}
function pct(arr,p){var s=Array.prototype.slice.call(arr).sort(function(a,b){return a-b});return s[Math.min(s.length-1,Math.floor(s.length*p))]}
function enhance(id,opts,notes){
  var w=id.width,h=id.height,d=id.data,n=w*h,i,x,y;
  var Y=new Float32Array(n); for(i=0;i<n;i++) Y[i]=0.299*d[i*4]+0.587*d[i*4+1]+0.114*d[i*4+2];
  // glare measure (before anything)
  var gl=0; for(i=0;i<n;i+=3) if(Y[i]>238) gl++; var glFrac=gl/(n/3);
  // a) even out lighting (big, gentle, bounded)
  var gw=40, gh=Math.max(8,Math.round(40*h/w)), sm=new Float32Array(gw*gh), cnt=new Float32Array(gw*gh);
  for(y=0;y<h;y++)for(x=0;x<w;x++){var gi=Math.min(gh-1,(y*gh/h)|0)*gw+Math.min(gw-1,(x*gw/w)|0); sm[gi]+=Y[y*w+x]; cnt[gi]++;}
  for(i=0;i<sm.length;i++) sm[i]=cnt[i]?sm[i]/cnt[i]:128;
  var bl=boxBlurLuma(boxBlurLuma(sm,gw,gh,7),gw,gh,7), mean=0; for(i=0;i<bl.length;i++) mean+=bl[i]; mean/=bl.length;
  var spread=0; for(i=0;i<bl.length;i++) spread=Math.max(spread,Math.abs(bl[i]/mean-1));
  var evenOn=spread>0.05; var gains=new Float32Array(bl.length); for(i=0;i<bl.length;i++) gains[i]=evenOn?clamp(Math.pow(mean/Math.max(20,bl[i]),0.6),0.85,1.3):1;
  for(y=0;y<h;y++){var fy=clamp(y*gh/h-0.5,0,gh-1.001),y0=fy|0,ty=fy-y0;
    for(x=0;x<w;x++){var fx=clamp(x*gw/w-0.5,0,gw-1.001),x0=fx|0,tx=fx-x0,g=(gains[y0*gw+x0]*(1-tx)+gains[y0*gw+x0+1]*tx)*(1-ty)+(gains[(y0+1)*gw+x0]*(1-tx)+gains[(y0+1)*gw+x0+1]*tx)*ty, o=(y*w+x)*4;
      d[o]=clamp(d[o]*g,0,255);d[o+1]=clamp(d[o+1]*g,0,255);d[o+2]=clamp(d[o+2]*g,0,255);}}
  if(evenOn) notes.push('lighting evened out a little');
  // b) gentle white balance: per-channel white point from bright, not-glare pixels, limited to +-8%
  var hist=[[],[],[]], st=Math.max(1,Math.floor(n/20000)); for(i=0;i<n;i+=st){var yy=0.299*d[i*4]+0.587*d[i*4+1]+0.114*d[i*4+2]; if(yy>60&&yy<235){hist[0].push(d[i*4]);hist[1].push(d[i*4+1]);hist[2].push(d[i*4+2]);}}
  var wbOn=false;
  if(hist[0].length>200){
    var m=[0,1,2].map(function(k){var s=0;hist[k].forEach(function(v){s+=v});return s/hist[k].length}), avg=(m[0]+m[1]+m[2])/3;
    var gn=m.map(function(v){return clamp(Math.pow(avg/v,0.5),0.93,1.07)}); // half-strength gray-world, tiny range: colored cards stay colored
    if(Math.max.apply(null,gn)-Math.min.apply(null,gn)>0.03){ wbOn=true; for(i=0;i<n;i++){d[i*4]=clamp(d[i*4]*gn[0],0,255);d[i*4+1]=clamp(d[i*4+1]*gn[1],0,255);d[i*4+2]=clamp(d[i*4+2]*gn[2],0,255);} notes.push('color cast eased'); }
  }
  // c) glare: modest highlight compression only (no fill-in)
  var gOn=glFrac>0.001;
  if(gOn){
    var knee=190, k2=0.5;
    for(i=0;i<n;i++){var o=i*4, yv=0.299*d[o]+0.587*d[o+1]+0.114*d[o+2]; if(yv>knee){ var ny=knee+(yv-knee)*k2, r=ny/yv; d[o]*=r;d[o+1]*=r;d[o+2]*=r; }}
    notes.push('glare softened a little');
  }
  // d) levels: stretch black/white points a little (capped), lift if clearly dark
  for(i=0;i<n;i++) Y[i]=0.299*d[i*4]+0.587*d[i*4+1]+0.114*d[i*4+2];
  var sub=[]; for(i=0;i<n;i+=st) sub.push(Y[i]); sub.sort(function(a,b){return a-b});
  var lo=sub[Math.floor(sub.length*0.004)], hi=sub[Math.floor(sub.length*0.996)], med=sub[Math.floor(sub.length*0.5)];
  var gainW=clamp(250/Math.max(hi,100),1,1.14), blk=clamp(lo-2,0,18);
  var gam=med<95?clamp(Math.log(112/255)/Math.log(Math.max(med,30)/255),0.78,1):1;
  var lut=new Uint8ClampedArray(256); for(i=0;i<256;i++){var v=clamp((i-blk)/(255-blk),0,1); v=Math.pow(v,gam); lut[i]=clamp(v*255*gainW,0,255);} 
  var lvOn=gainW>1.03||blk>3||gam<0.97;
  if(lvOn){ for(i=0;i<n;i++){d[i*4]=lut[d[i*4]|0];d[i*4+1]=lut[d[i*4+1]|0];d[i*4+2]=lut[d[i*4+2]|0];} notes.push(gam<0.97?'brightened a little':'contrast set'); }
  // e) slight sharpen (luma delta, noise threshold, capped so no halos)
  var amt=opts.sharp==null?0.5:opts.sharp;
  for(i=0;i<n;i++) Y[i]=0.299*d[i*4]+0.587*d[i*4+1]+0.114*d[i*4+2];
  var rr=Math.max(1,Math.round(Math.min(w,h)/700)), b1=boxBlurLuma(boxBlurLuma(boxBlurLuma(Y,w,h,rr),w,h,rr),w,h,rr);
  for(i=0;i<n;i++){var dl=Y[i]-b1[i]; if(Math.abs(dl)<2.5) continue; dl=clamp(dl*amt,-24,24); var o=i*4; d[o]=clamp(d[o]+dl,0,255);d[o+1]=clamp(d[o+1]+dl,0,255);d[o+2]=clamp(d[o+2]+dl,0,255);}
  notes.push('lightly sharpened');
  return {glare:gOn,glFrac:glFrac};
}

/* ---------- main ---------- */
// blob: original photo. mode: 'raw'|'graded'. Returns {blob,thumb?,ok,quadFound,notes,msg,w,h}
async function cleanBlob(blob,mode,onlyLight){
  var im=await loadImg(blob), notes=[], A=analyse(im,360), fq=onlyLight?{fail:'skipped'}:findQuad(A,mode), W0=im.naturalWidth,H0=im.naturalHeight;
  var big=document.createElement('canvas'), scale=Math.min(1,1700/Math.max(W0,H0)); big.width=Math.round(W0*scale); big.height=Math.round(H0*scale); big.getContext('2d').drawImage(im,0,0,big.width,big.height);
  var inv=scale/A.s, id, found=!!fq.quad;
  await tick();
  var pad=Math.round(Math.max(big.width,big.height)*0.04), cw, ch, out=document.createElement('canvas'), octx;
  if(found){
    var q=fq.quad, cxm=0,cym=0; q.forEach(function(p){cxm+=p[0]/4;cym+=p[1]/4});
    var q2=q.map(function(p){return [(cxm+(p[0]-cxm)*1.012)*inv,(cym+(p[1]-cym)*1.012)*inv]}); // 1% outward so no edge is clipped
    var wq=(dist(q2[0],q2[1])+dist(q2[3],q2[2]))/2, hq=(dist(q2[0],q2[3])+dist(q2[1],q2[2]))/2;
    cw=Math.round(wq); ch=Math.round(hq);
    id=warp(big,q2,cw,ch);
    var ang=fq.ang; notes.push(Math.abs(ang)>=0.5?('straightened '+Math.abs(ang).toFixed(1)+'°'):'edges squared up'); notes.push(mode==='graded'?'cropped to the slab outline':'cropped to the card or case outline');
  }else{
    cw=big.width; ch=big.height; id=big.getContext('2d').getImageData(0,0,cw,ch);
  }
  await tick();
  var info=enhance(id,{sharp:mode==='graded'?0.35:0.5},notes);
  octx=out.getContext('2d'); out.width=cw+pad*2; out.height=ch+pad*2; octx.fillStyle='rgb('+BG.join(',')+')'; octx.fillRect(0,0,out.width,out.height); octx.putImageData(id,pad,pad);
  notes.push('background set to neutral gray');
  var b=await toBlob(out,.92);
  var res={blob:b,ok:true,quadFound:found,notes:notes,w:out.width,h:out.height,glare:info.glare,conf:fq.conf||0,ang:fq.ang||0,ar:fq.ar||0,sides:fq.sides||[]};
  if(!found) res.msg='I could not find the card edges clearly, so only the lighting was tidied. Nothing was straightened or cropped. Try a plainer, lighter surface and retake if you want a straightened copy.';
  return res;
}
function describe(r){ return 'Cleaned scan, card unchanged'; }
function noteText(notes){ return 'Done on this phone: '+notes.join(', ')+'. Scratches, creases, dents, edge and corner wear, and the card\u2019s own centering were not touched.'; }
window.Cleanup={cleanBlob:cleanBlob,describe:describe,noteText:noteText,_internals:{analyse:analyse,findQuad:findQuad}};
})();
