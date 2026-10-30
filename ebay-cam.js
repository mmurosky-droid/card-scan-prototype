/* Collectors Desk v0.11 — eBay photos camera (Mr. Moose Enterprises, LLC)
   One card at a time: Front, Back, then optional close-ups. Live checks, auto-capture, straighten + crop,
   true colors by default. Everything runs on this device; nothing is sent anywhere. */
(function(){
'use strict';
var SHOTS=[
 {k:'front',t:'Front',req:1,card:1,say:'Lay the card face up inside the frame.'},
 {k:'back',t:'Back',req:1,card:1,say:'Flip the card over. Same spot.'},
 {k:'corner-tl',t:'Top-left corner',cu:1,say:'Move close. Put the top-left corner in the box.'},
 {k:'corner-tr',t:'Top-right corner',cu:1,say:'Now the top-right corner.'},
 {k:'corner-bl',t:'Bottom-left corner',cu:1,say:'Now the bottom-left corner.'},
 {k:'corner-br',t:'Bottom-right corner',cu:1,say:'Last corner: bottom-right.'},
 {k:'serial',t:'Serial number',cu:1,say:'Fill the box with the serial number (like 12/99).'},
 {k:'auto',t:'Autograph',cu:1,say:'Fill the box with the autograph.'},
 {k:'flaw',t:'Surface / flaw',cu:1,say:'Show any scratch, crease or mark up close. Honest photos build trust.'}
];
var ORDER=SHOTS.map(function(s){return s.k});
var BG={dark:'#2b2b2a',white:'#ffffff'};
var CHK=[['fill','Fills frame'],['straight','Straight'],['sharp','Sharp'],['glare','Glare'],['light','Even light'],['bright','Brightness']];
var CHK_CU=[['sharp','Sharp'],['glare','Glare'],['bright','Brightness'],['steady','Steady']];
var TIPS='<div class="ebtip"><b>Photo tips</b><ul><li><b>Soft light from the side</b>, like a window. Turn off the ceiling light right above you; it makes glare and your phone’s shadow.</li><li><b>Dark, plain, matte background</b> (a black mouse pad or a dark towel). No patterns.</li><li><b>Glare on a sleeve, top-loader or slab?</b> Tilt the phone slightly until the white shine slides off the card.</li><li><b>Phone flat</b>, right above the card, so it looks square and not like a trapezoid.</li><li>The phone light is off on purpose. It causes glare.</li></ul></div>';
var $=function(id){return document.getElementById(id)};
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function shot(k){ for(var i=0;i<SHOTS.length;i++) if(SHOTS[i].k===k) return SHOTS[i]; return SHOTS[0]; }
function slug(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40); }
function baseName(n){ n=n||{}; var b=[slug(n.player),slug(n.year),slug(n.set)].filter(Boolean).join('-'); return b||'card'; }
function fileName(base,k){ return base+'-'+k+'.jpg'; }
function toBlob(cv,q){ return new Promise(function(r){ cv.toBlob(function(b){r(b)},'image/jpeg',q||0.9); }); }
function loadImg(blob){ return new Promise(function(res,rej){ var u=URL.createObjectURL(blob),im=new Image(); im.onload=function(){ URL.revokeObjectURL(u); res(im); }; im.onerror=function(){ URL.revokeObjectURL(u); rej(new Error('image')); }; im.src=u; }); }
function canvas(w,h){ var c=document.createElement('canvas'); c.width=Math.max(1,Math.round(w)); c.height=Math.max(1,Math.round(h)); return c; }
function wait(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
function dist(a,b){ return Math.hypot(a[0]-b[0],a[1]-b[1]); }
function areaQ(q){ var s=0; for(var i=0;i<4;i++){ var a=q[i],b=q[(i+1)%4]; s+=a[0]*b[1]-b[0]*a[1]; } return Math.abs(s)/2; }
function rot90(src,cw){ var c=canvas(src.height,src.width), x=c.getContext('2d'); x.translate(c.width/2,c.height/2); x.rotate(cw?Math.PI/2:-Math.PI/2); x.drawImage(src,-src.width/2,-src.height/2); return c; }
function I(){ return (window.Cleanup&&Cleanup._internals)||null; }

var E=null; // the open session

/* ---------- public ---------- */
function open(opts){
  if(E) close(true);
  opts=opts||{};
  E={opts:opts, mode:opts.mode==='graded'?'graded':'raw', side:false, shots:{}, order:ORDER.slice(), i:0, bg:opts.bg||'dark', touch:false,
     auto:localStorage.getItem('ebAuto')!=='0', torch:false, caps:{}, view:'cam', st:null, armed:true, t0:Date.now(), hist:[], peak:0, cache:{}, dirty:false};
  (opts.existing||[]).forEach(function(p){ if(p&&p.k&&p.blob) E.shots[p.k]={src:p.src||p.blob, baked:!p.src, card:!!shot(p.k).card, w:p.w||0, h:p.h||0, low:!!p.low}; });
  if(opts.order&&opts.order.length){ var o=opts.order.filter(function(k){return ORDER.indexOf(k)>=0}); ORDER.forEach(function(k){ if(o.indexOf(k)<0) o.push(k); }); E.order=o; }
  build();
  var first=nextNeeded(-1);
  if(opts.start==='results'||(first<0&&Object.keys(E.shots).length)) showResults(); else { E.i=first<0?0:first; showCam(); }
  if(!localStorage.getItem('ebTips')){ localStorage.setItem('ebTips','1'); tipSheet(); }
  return true;
}
function close(silent){
  if(!E) return; stopCam(); var root=$('ebc'); if(root) root.remove();
  document.documentElement.classList.remove('ebc-on'); var o=E.opts; E=null; if(!silent&&o.onClose) o.onClose();
}
function nextNeeded(from){ for(var i=from+1;i<SHOTS.length;i++){ if(!E.shots[SHOTS[i].k]&&!E['skip_'+SHOTS[i].k]) return i; } return -1; }

/* ---------- layout ---------- */
function build(){
  var r=document.createElement('div'); r.id='ebc'; r.className='ebc'; r.setAttribute('role','dialog'); r.setAttribute('aria-label','eBay photos');
  r.innerHTML=
   '<div class="ebtop"><button class="chip" id="ebClose">‹ Done</button><div class="ebttl" id="ebTtl">eBay photos</div><button class="chip" id="ebTipB" aria-label="Photo tips">? Tips</button></div>'+
   '<div class="ebdots" id="ebDots"></div>'+
   '<div class="ebcam" id="ebCam">'+
     '<div class="ebstage" id="ebStage"><video id="ebV" playsinline muted autoplay></video><canvas id="ebO"></canvas><div class="ebflash" id="ebFlash"></div><div class="ebmsg" id="ebMsg"></div></div>'+
     '<div class="ebside">'+
       '<div class="ebsay" id="ebSay"></div>'+
       '<div class="ebchk" id="ebChk"></div>'+
       '<div class="ebopts"><div class="seg ebseg" id="ebMode"><button data-v="raw">Raw card</button><button data-v="graded">Graded slab</button></div><button class="chip" id="ebSide" aria-pressed="false">↻ Sideways card</button></div>'+
       '<div class="ebctl"><button class="ghost-btn" id="ebSkip">Skip</button><button class="ebshut" id="ebShut" aria-label="Take photo"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" class="r0"/><circle cx="50" cy="50" r="46" class="r1" id="ebRing"/></svg><i></i></button>'+
       '<div class="ebctr"><button class="chip" id="ebAuto"></button><button class="chip" id="ebTorch" style="display:none">🔦 Light off</button></div></div>'+
       '<div class="ebhint" id="ebHint"></div>'+
     '</div></div>'+
   '<div class="ebres" id="ebRes"></div>'+
   '<div class="ebsheet" id="ebSheet"></div>';
  document.body.appendChild(r); document.documentElement.classList.add('ebc-on');
  $('ebClose').onclick=onDoneTap; $('ebTipB').onclick=tipSheet;
  $('ebShut').onclick=function(){ capture('manual'); };
  $('ebSkip').onclick=function(){ var s=SHOTS[E.i]; if(s.req){ return; } E['skip_'+s.k]=1; advance(); };
  $('ebAuto').onclick=function(){ E.auto=!E.auto; localStorage.setItem('ebAuto',E.auto?'1':'0'); paintCtl(); };
  $('ebTorch').onclick=toggleTorch;
  $('ebSide').onclick=function(){ E.side=!E.side; this.setAttribute('aria-pressed',E.side); this.classList.toggle('on',E.side); E.peak=0; };
  $('ebMode').onclick=function(e){ var b=e.target.closest('button'); if(!b) return; E.mode=b.dataset.v; paintCtl(); E.peak=0; };
  $('ebDots').onclick=function(e){ var b=e.target.closest('[data-i]'); if(!b) return; E.i=+b.dataset.i; delete E['skip_'+SHOTS[E.i].k]; showCam(); };
  $('ebStage').addEventListener('click',tapFocus);
  window.addEventListener('resize',onResize);
}
function onResize(){ if(E&&E.view==='cam') sizeOverlay(); }
function paintDots(){
  var h=''; SHOTS.forEach(function(s,i){ var d=E.shots[s.k], sk=E['skip_'+s.k]; h+='<button data-i="'+i+'" class="ebdot'+(i===E.i&&E.view==='cam'?' cur':'')+(d?' done':'')+(sk?' skip':'')+(s.req?' req':'')+'" aria-label="'+esc(s.t)+(d?' (taken, tap to retake)':sk?' (skipped)':'')+'">'+(d?'✓':(i+1))+'</button>'+(i===1?'<span class="ebsep"></span>':''); });
  $('ebDots').innerHTML=h;
}
function paintCtl(){
  var s=SHOTS[E.i];
  [].forEach.call($('ebMode').children,function(b){ b.classList.toggle('on',b.dataset.v===E.mode); });
  $('ebMode').parentNode.style.display=s.card?'':'none';
  $('ebAuto').textContent=E.auto?'Auto: on':'Auto: off'; $('ebAuto').classList.toggle('on',E.auto);
  var sk=$('ebSkip'); if(s.req){ sk.style.visibility=E.shots[s.k]?'visible':'hidden'; sk.textContent='Keep it ›'; sk.onclick=function(){ advance(); }; }
  else { sk.style.visibility='visible'; sk.textContent=E.shots[s.k]?'Keep it ›':'Skip ›'; sk.onclick=function(){ if(!E.shots[s.k]) E['skip_'+s.k]=1; advance(); }; }
  $('ebTtl').textContent='eBay photos · '+s.t+(s.req?'':' (optional)');
  $('ebSay').innerHTML='<b>'+(E.i+1)+' of '+SHOTS.length+' · '+esc(s.t)+'</b>'+esc(s.say)+(E.shots[s.k]?' <i>Taken ✓. Take it again to replace it.</i>':'');
  $('ebSide').style.display=s.card?'':'none';
  paintDots();
}
function advance(){
  var n=nextNeeded(E.i);
  if(n<0){ showResults(); return; }
  E.i=n; E.t0=Date.now(); E.peak=0; E.armed=false; E.armT=Date.now(); paintCtl(); $('ebHint').textContent='';
}
function onDoneTap(){
  var n=Object.keys(E.shots).length;
  if(E.view==='res'){ finish(); return; }
  if(!n){ sheet('Leave eBay photos?','You haven’t taken any photos yet.',[{t:'Leave',fn:function(){ close(); }},{t:'Keep going',g:1}]); return; }
  if(!E.shots.back||!E.shots.front){ sheet('The '+(!E.shots.front?'front':'back')+' isn’t taken yet','eBay buyers expect the front and the back.',[{t:'Take it now',g:1,fn:function(){ E.i=E.shots.front?1:0; showCam(); }},{t:'See my photos',fn:showResults}]); return; }
  showResults();
}

/* ---------- camera ---------- */
async function startCam(){
  if(E.stream) return true;
  var tries=[{width:{ideal:4096},height:{ideal:3072}},{width:{ideal:1920},height:{ideal:1080}},{}];
  for(var i=0;i<tries.length;i++){
    try{ var v=Object.assign({facingMode:{ideal:'environment'}},tries[i]); E.stream=await navigator.mediaDevices.getUserMedia({video:v,audio:false}); break; }catch(e){ E.err=e; }
  }
  if(!E||!E.stream){ camFail(); return false; }
  var tr=E.track=E.stream.getVideoTracks()[0];
  try{ E.caps=tr.getCapabilities?tr.getCapabilities():{}; }catch(e){ E.caps={}; }
  try{ var fm=E.caps.focusMode||[]; if(fm.indexOf('continuous')>=0) await tr.applyConstraints({advanced:[{focusMode:'continuous'}]}); }catch(e){}
  try{ if(E.caps.torch) await tr.applyConstraints({advanced:[{torch:false}]}); }catch(e){}
  $('ebTorch').style.display=E.caps.torch?'':'none';
  try{ if(window.ImageCapture){ E.ic=new ImageCapture(tr); E.pc=await E.ic.getPhotoCapabilities().catch(function(){return null}); } }catch(e){ E.ic=null; }
  var vd=$('ebV'); vd.srcObject=E.stream; try{ await vd.play(); }catch(e){}
  await new Promise(function(r){ if(vd.videoWidth) r(); else vd.onloadedmetadata=function(){ r(); }; setTimeout(r,3000); });
  sizeOverlay(); loop();
  return true;
}
function camFail(){
  $('ebMsg').innerHTML='<div><b>I can’t open the camera.</b><br>Allow camera access for this site in your browser settings, then tap Try again. Or add photos you already took.</div><button class="gold-btn" id="ebRetry">Try again</button><label class="ghost-btn">Add a photo instead<input type="file" accept="image/*" id="ebPick" hidden></label>';
  $('ebMsg').classList.add('on');
  $('ebRetry').onclick=function(){ $('ebMsg').classList.remove('on'); startCam(); };
  $('ebPick').onchange=async function(){ var f=this.files&&this.files[0]; if(!f) return; $('ebMsg').classList.remove('on'); await processPhoto(f,null); };
}
function stopCam(){ if(!E) return; cancelAnimationFrame(E.raf); clearTimeout(E.lt); if(E.stream){ E.stream.getTracks().forEach(function(t){t.stop()}); } E.stream=null; E.track=null; E.ic=null; E.torch=false; window.removeEventListener('resize',onResize); }
async function toggleTorch(){
  if(!E.track) return; var on=!E.torch;
  try{ await E.track.applyConstraints({advanced:[{torch:on}]}); E.torch=on; }catch(e){ toast('This phone won’t let me turn the light on here.'); return; }
  $('ebTorch').textContent=on?'🔦 Light ON':'🔦 Light off'; $('ebTorch').classList.toggle('warn',on);
  if(on) toast('Heads up: the phone light usually makes glare on sleeves, top-loaders and slabs. Side light is better.',4200);
}
async function tapFocus(e){
  if(!E.track||e.target.closest('button,label,input')) return; var fm=E.caps.focusMode||[]; var st=$('ebStage').getBoundingClientRect();
  var x=(e.clientX-st.left)/st.width, y=(e.clientY-st.top)/st.height;
  try{ if(fm.indexOf('single-shot')>=0||E.caps.pointsOfInterest){ await E.track.applyConstraints({advanced:[{pointsOfInterest:[{x:x,y:y}],focusMode:fm.indexOf('single-shot')>=0?'single-shot':'continuous'}]}); E.focusAt={x:x,y:y,t:Date.now()}; }
    else if(fm.indexOf('continuous')>=0){ E.focusAt={x:x,y:y,t:Date.now(),auto:1}; } }catch(er){}
}

/* geometry: screen <-> video (video is object-fit:cover) */
function sizeOverlay(){
  var st=$('ebStage'), o=$('ebO'), dpr=Math.min(2,window.devicePixelRatio||1); if(!st) return;
  var w=st.clientWidth,h=st.clientHeight; o.width=w*dpr; o.height=h*dpr; o.style.width=w+'px'; o.style.height=h+'px'; E.sw=w; E.sh=h; E.dpr=dpr;
}
function mapping(){
  var vd=$('ebV'), vw=vd.videoWidth||1280, vh=vd.videoHeight||720, k=Math.max(E.sw/vw,E.sh/vh);
  return {vw:vw,vh:vh,k:k,ox:(E.sw-vw*k)/2,oy:(E.sh-vh*k)/2};
}
function guideScreen(){
  var s=SHOTS[E.i], W=E.sw, H=E.sh, m=mapping();
  // keep the guide inside the visible video
  var vx0=Math.max(0,m.ox), vy0=Math.max(0,m.oy), vx1=Math.min(W,m.ox+m.vw*m.k), vy1=Math.min(H,m.oy+m.vh*m.k), aw=vx1-vx0, ah=vy1-vy0;
  var asp;
  if(s.cu){ var q=Math.min(aw,ah)*0.66; return {x:vx0+(aw-q)/2,y:vy0+(ah-q)/2,w:q,h:q}; }
  asp=E.mode==='graded'?0.58:(2.5/3.5); if(E.side) asp=1/asp;
  var gh=ah*0.82, gw=gh*asp; if(gw>aw*0.86){ gw=aw*0.86; gh=gw/asp; }
  return {x:vx0+(aw-gw)/2,y:vy0+(ah-gh)/2,w:gw,h:gh};
}
function s2v(m,r){ return {x:(r.x-m.ox)/m.k,y:(r.y-m.oy)/m.k,w:r.w/m.k,h:r.h/m.k}; }

/* ---------- live checks ---------- */
var AC=null, SC=null, DC=null;
function loop(){
  if(!E||E.view!=='cam'||!E.stream) return;
  var t=performance.now();
  try{ analyseFrame(); }catch(e){ if(window.MC) MC().log&&MC().log('ebay check err '+e.message); }
  draw();
  var dt=performance.now()-t; E.lt=setTimeout(function(){ E.raf=requestAnimationFrame(loop); },Math.max(60,150-dt));
}
function lumaStats(d,w,x0,y0,x1,y1){
  var Ys=[],gl=0,n=0; for(var y=y0;y<y1;y+=2)for(var x=x0;x<x1;x+=2){ var i=(y*w+x)*4,r=d[i],g=d[i+1],b=d[i+2]; var Y=0.299*r+0.587*g+0.114*b; Ys.push(Y); n++; if(Math.min(r,g,b)>242) gl++; }
  Ys.sort(function(a,b){return a-b}); return {med:Ys[Ys.length>>1]||0,gl:n?gl/n:0,n:n};
}
function sharpAt(vd,cx,cy,sz){
  sz=Math.max(32,Math.min(256,Math.round(sz))); if(!SC){ SC=canvas(256,256); }
  var x=SC.getContext('2d',{willReadFrequently:true}); SC.width=sz; SC.height=sz;
  x.drawImage(vd,Math.round(cx-sz/2),Math.round(cy-sz/2),sz,sz,0,0,sz,sz);
  var d=x.getImageData(0,0,sz,sz).data, Y=new Float32Array(sz*sz), i; for(i=0;i<sz*sz;i++) Y[i]=0.299*d[i*4]+0.587*d[i*4+1]+0.114*d[i*4+2];
  var s=0,s2=0,n=0; for(var yy=1;yy<sz-1;yy++)for(var xx=1;xx<sz-1;xx++){ var p=yy*sz+xx, l=4*Y[p]-Y[p-1]-Y[p+1]-Y[p-sz]-Y[p+sz]; s+=l; s2+=l*l; n++; }
  var m=s/n; return s2/n-m*m;
}
function frameDiff(vd,m){
  if(!DC) DC=canvas(48,48); var x=DC.getContext('2d',{willReadFrequently:true}); x.drawImage(vd,0,0,48,48); var d=x.getImageData(0,0,48,48).data, Y=new Float32Array(48*48);
  for(var i=0;i<48*48;i++) Y[i]=0.299*d[i*4]+0.587*d[i*4+1]+0.114*d[i*4+2];
  var df=0; if(E.prevY){ for(i=0;i<Y.length;i++) df+=Math.abs(Y[i]-E.prevY[i]); df/=Y.length; } else df=99; E.prevY=Y; E.lastY=Y; return df;
}
function snapDiff(){ if(!E.snapY||!E.lastY) return 99; var df=0; for(var i=0;i<E.lastY.length;i++) df+=Math.abs(E.lastY[i]-E.snapY[i]); return df/E.lastY.length; }
function lvl(v,g,y){ return v?(v===2?'g':(v===1?'y':'r')):'r'; }
function analyseFrame(){
  var vd=$('ebV'); if(!vd.videoWidth) return; var s=SHOTS[E.i], m=mapping(), G=s2v(m,guideScreen()), C={}, now=Date.now(), why={};
  var df=frameDiff(vd,m);
  var q=null, res=null;
  if(s.card&&I()){
    var ex=0.16, R={x:Math.max(0,G.x-G.w*ex),y:Math.max(0,G.y-G.h*ex)}; R.w=Math.min(m.vw,G.x+G.w*(1+ex))-R.x; R.h=Math.min(m.vh,G.y+G.h*(1+ex))-R.y;
    var L=300, sc=L/Math.max(R.w,R.h); if(!AC) AC=canvas(10,10);
    var rw=Math.round(R.w*sc), rh=Math.round(R.h*sc), ax;
    if(E.side){ AC.width=rh; AC.height=rw; ax=AC.getContext('2d',{willReadFrequently:true}); ax.save(); ax.translate(rh/2,rw/2); ax.rotate(-Math.PI/2); ax.drawImage(vd,R.x,R.y,R.w,R.h,-rw/2,-rh/2,rw,rh); ax.restore(); }
    else { AC.width=rw; AC.height=rh; ax=AC.getContext('2d',{willReadFrequently:true}); ax.drawImage(vd,R.x,R.y,R.w,R.h,0,0,rw,rh); }
    AC.naturalWidth=AC.width; AC.naturalHeight=AC.height;
    var A=I().analyse(AC,L); res=I().findQuad(A,E.mode);
    if(res&&res.quad){
      var qa=res.quad;
      q=qa.map(function(p){ var x=p[0],y=p[1]; if(E.side){ var t=x; x=rw-y; y=t; } return [R.x+x/sc,R.y+y/sc]; });
      if(E.side){ q=[q[3],q[0],q[1],q[2]]; }
      // checks
      var ar=areaQ(q)/(G.w*G.h), inside=q.every(function(p){ return p[0]>G.x-G.w*0.1&&p[0]<G.x+G.w*1.1&&p[1]>G.y-G.h*0.1&&p[1]<G.y+G.h*1.1; });
      C.fill=(ar>=0.74&&ar<=1.14&&inside)?2:((ar>=0.5&&ar<=1.32)?1:0); why.fill=ar<0.74?'Move closer':(ar>1.14||!inside)?'Move back a little':'Card fills the frame';
      if(C.fill===0) why.fill=ar<0.5?'Move much closer':'Too close, move back';
      var top=dist(q[0],q[1]),bot=dist(q[3],q[2]),lef=dist(q[0],q[3]),rig=dist(q[1],q[2]), ks=Math.max(Math.abs(1-top/bot),Math.abs(1-lef/rig));
      var ang=Math.abs(Math.atan2(q[1][1]-q[0][1],q[1][0]-q[0][0])*180/Math.PI); if(ang>90) ang=180-ang;
      C.straight=(ang<2.5&&ks<0.05)?2:((ang<6&&ks<0.11)?1:0);
      why.straight=C.straight===2?'Straight':(ks>=0.05&&ks>=ang/50?'Hold the phone flat over the card':'Turn the card to line up');
      // light stats on the analysis canvas inside the card
      var bb=bbox(qa), d=A.d, w=A.w, iw=bb.x1-bb.x0, ih=bb.y1-bb.y0;
      var inn=lumaStats(d,w,Math.round(bb.x0+iw*.1),Math.round(bb.y0+ih*(E.mode==='graded'?.3:.1)),Math.round(bb.x1-iw*.1),Math.round(bb.y1-ih*.1));
      var halves=[lumaStats(d,w,Math.round(bb.x0+iw*.06),Math.round(bb.y0+ih*.06),Math.round(bb.x0+iw*.5),Math.round(bb.y1-ih*.06)).med,lumaStats(d,w,Math.round(bb.x0+iw*.5),Math.round(bb.y0+ih*.06),Math.round(bb.x1-iw*.06),Math.round(bb.y1-ih*.06)).med,
                  lumaStats(d,w,Math.round(bb.x0+iw*.06),Math.round(bb.y0+ih*.06),Math.round(bb.x1-iw*.06),Math.round(bb.y0+ih*.5)).med,lumaStats(d,w,Math.round(bb.x0+iw*.06),Math.round(bb.y0+ih*.5),Math.round(bb.x1-iw*.06),Math.round(bb.y1-ih*.06)).med];
      var un=Math.max(Math.abs(halves[0]-halves[1]),Math.abs(halves[2]-halves[3]))/(Math.max.apply(null,halves)+8);
      C.light=un<0.25?2:(un<0.45?1:0); why.light=C.light===2?'Even light':'Shadow on one side. Don’t block the light';
      setLight(C,why,inn);
      var cx=(q[0][0]+q[1][0]+q[2][0]+q[3][0])/4, cy=(q[0][1]+q[1][1]+q[2][1]+q[3][1])/4;
      setSharp(C,why,sharpAt(vd,cx,cy,Math.min(lef,top)*0.45));
      var mv=E.lastQ?Math.max.apply(null,q.map(function(p,i){return dist(p,E.lastQ[i])}))/Math.hypot(G.w,G.h):1;
      C.steady=(mv<0.012&&df<6)?2:(mv<0.03?1:0);
    } else {
      C.fill=0; why.fill=(res&&res.fail==='small')?'Move closer':'I can’t see the card’s edges. Use a plain dark surface';
      C.straight=0; why.straight='Straight'; C.light=1; why.light='Even light';
      var d2=ctxData(vd,G), st2=lumaStats(d2.d,d2.w,0,0,d2.w,d2.h); setLight(C,why,st2);
      setSharp(C,why,sharpAt(vd,G.x+G.w/2,G.y+G.h/2,G.w*0.4)); C.steady=df<4?2:0;
      if(E.sv<15&&!(res&&res.fail==='small')) why.fill='Put the card inside the frame';
      else if(E.sv>=40){ why.fill=(res&&res.fail==='small')?'Fill the frame, phone flat over the card':'Hold the phone flat over the card'; why.straight='I need to see all 4 edges'; }
    }
    E.lastQ=q;
  } else {
    var d3=ctxData(vd,G), st3=lumaStats(d3.d,d3.w,0,0,d3.w,d3.h); setLight(C,why,st3);
    setSharp(C,why,sharpAt(vd,G.x+G.w/2,G.y+G.h/2,G.w*0.6));
    C.steady=df<3.5?2:(df<8?1:0); why.steady=C.steady===2?'Steady':'Hold still';
  }
  why.steady=C.steady===2?'Steady':'Hold still';
  E.q=q; E.C=C; E.why=why; E.G=G;
  // re-arm auto after a capture once the scene changes
  if(!E.armed){ if(snapDiff()>10||(s.card&&!q)||(now-(E.armT||0)>6000&&!E.shots[s.k])) { if(now-(E.armT||0)>900) E.armed=true; } }
  var keys=s.card?['fill','straight','sharp','steady']:['sharp','steady','bright'], soft=s.card?['glare','light','bright']:['glare'];
  var gate=keys.every(function(k){return C[k]===2}) && soft.every(function(k){return C[k]>0});
  if(gate&&E.armed&&E.auto&&!E.busy){ if(!E.gs) E.gs=now; if(now-E.gs>=500){ E.gs=0; capture('auto'); } } else E.gs=0;
  paintChecks(gate);
  if(!E.busy&&now-E.t0>6000&&!E.shots[s.k]) $('ebHint').textContent='Tap the round button to take it anyway.';
}
function ctxData(vd,G){ var c=canvas(120,120), x=c.getContext('2d',{willReadFrequently:true}); x.drawImage(vd,G.x,G.y,G.w,G.h,0,0,120,120); return {d:x.getImageData(0,0,120,120).data,w:120,h:120}; }
function bbox(q){ var xs=q.map(function(p){return p[0]}),ys=q.map(function(p){return p[1]}); return {x0:Math.max(0,Math.min.apply(null,xs)),x1:Math.max.apply(null,xs),y0:Math.max(0,Math.min.apply(null,ys)),y1:Math.max.apply(null,ys)}; }
function setLight(C,why,st){
  C.bright=(st.med>=70&&st.med<=215)?2:((st.med>=45&&st.med<=235)?1:0); why.bright=C.bright===2?'Brightness':(st.med<70?'Too dark. Add light':'Too bright');
  C.glare=st.gl<0.004?2:(st.gl<0.02?1:0); why.glare=C.glare===2?'No glare':'Glare. Tilt the phone slightly';
}
function setSharp(C,why,v){
  E.peak=Math.max(E.peak*0.985,v); var abs=40;
  C.sharp=(v>=abs&&v>=E.peak*0.6)?2:(v>=abs*0.5?1:0); why.sharp=C.sharp===2?'Sharp':(v<abs*0.5?'Blurry. Hold steady or tap to focus':'A little soft. Hold still');
  E.sv=v;
}
function paintChecks(gate){
  var s=SHOTS[E.i], L=s.card?CHK:CHK_CU, C=E.C, W=E.why, h='';
  L.forEach(function(c){ var v=C[c[0]]; var cls=v===2?'g':v===1?'y':'r'; var word=v===2?c[1]:(W[c[0]]||c[1]); h+='<span class="ebp '+cls+'" data-k="'+c[0]+'"><i></i>'+esc(word)+'</span>'; });
  $('ebChk').innerHTML=h;
  var main='';
  if(E.busy) main='Saving…'; else if(gate) main=E.auto&&E.armed?'Looks great. Hold still…':'Looks great. Tap the round button.';
  else { var bad=L.map(function(c){return c[0]}).concat(['steady']).filter(function(k){return C[k]===0})[0]||L.map(function(c){return c[0]}).filter(function(k){return C[k]===1})[0]; main=bad?(W[bad]||''):'Almost. Hold still'; }
  if(!E.armed&&!E.busy&&E.auto) main=(s.k==='back'?'Flip the card over. ':'')+'Auto waits for the next one…';
  var msg=$('ebMsg'); if(!msg.classList.contains('on')) msg.innerHTML='';
  E.main=main; E.gate=gate;
  var ring=$('ebRing'), pct=E.gs?Math.min(1,(Date.now()-E.gs)/500):0; ring.style.strokeDashoffset=String(289*(1-pct));
}
function draw(){
  var o=$('ebO'), x=o.getContext('2d'), dpr=E.dpr||1, g=guideScreen(), s=SHOTS[E.i], m=mapping();
  x.setTransform(dpr,0,0,dpr,0,0); x.clearRect(0,0,E.sw,E.sh);
  // dim outside the guide
  x.fillStyle='rgba(0,0,0,.45)'; x.beginPath(); x.rect(0,0,E.sw,E.sh); rr(x,g.x,g.y,g.w,g.h,s.cu?10:Math.min(g.w,g.h)*0.045); x.fill('evenodd');
  var col=E.gate?'#3ddc84':'#d4a84b'; x.lineWidth=3; x.strokeStyle=col; x.setLineDash(E.gate?[]:[10,8]); x.beginPath(); rr(x,g.x,g.y,g.w,g.h,s.cu?10:Math.min(g.w,g.h)*0.045); x.stroke(); x.setLineDash([]);
  if(E.q){ var C=E.C||{}, ok=C.fill===2&&C.straight===2, mid=C.fill>0&&C.straight>0; x.strokeStyle=ok?'#3ddc84':mid?'#ffb53d':'#ff5252'; x.lineWidth=3.5; x.beginPath();
    E.q.forEach(function(p,i){ var X=p[0]*m.k+m.ox,Y=p[1]*m.k+m.oy; if(i) x.lineTo(X,Y); else x.moveTo(X,Y); }); x.closePath(); x.stroke(); }
  // label
  x.font='600 16px system-ui,sans-serif'; var t=E.main||'', tw=x.measureText(t).width; if(t){ var bx=Math.max(6,(E.sw-tw)/2-12), by=Math.max(6,g.y-40); x.fillStyle='rgba(10,9,8,.82)'; x.beginPath(); rr(x,bx,by,tw+24,32,16); x.fill(); x.fillStyle=E.gate?'#3ddc84':'#f4efe3'; x.fillText(t,bx+12,by+22); }
  if(E.focusAt&&Date.now()-E.focusAt.t<900){ x.strokeStyle='#f3d98b'; x.lineWidth=2; x.beginPath(); x.arc(E.focusAt.x*E.sw,E.focusAt.y*E.sh,28,0,7); x.stroke(); }
}
function rr(x,a,b,w,h,r){ x.moveTo(a+r,b); x.arcTo(a+w,b,a+w,b+h,r); x.arcTo(a+w,b+h,a,b+h,r); x.arcTo(a,b+h,a,b,r); x.arcTo(a,b,a+w,b,r); x.closePath(); }

/* ---------- capture & processing ---------- */
async function grab(){
  var vd=$('ebV'), blob=null, how='video';
  if(E.ic&&E.pc&&E.pc.imageWidth&&E.pc.imageWidth.max>vd.videoWidth){
    try{ blob=await Promise.race([E.ic.takePhoto({imageWidth:E.pc.imageWidth.max,fillLightMode:'off'}).catch(function(){ return E.ic.takePhoto(); }),wait(6000).then(function(){return null})]); if(blob) how='photo'; }catch(e){ blob=null; }
  }
  if(!blob){ var c=canvas(vd.videoWidth,vd.videoHeight); c.getContext('2d').drawImage(vd,0,0); blob=await toBlob(c,0.95); how='video'; }
  return {blob:blob,how:how,vw:vd.videoWidth,vh:vd.videoHeight};
}
async function capture(why){
  if(!E||E.busy) return; var s=SHOTS[E.i];
  if(!E.stream){ toast('The camera isn’t on.'); return; }
  E.busy=true; E.gs=0; $('ebShut').disabled=true; var fl=$('ebFlash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
  E.snapY=E.lastY; var G=E.G, q=E.q, side=E.side;
  try{ var g=await grab(); await processPhoto(g.blob,{G:G,q:s.card?q:null,vw:g.vw,vh:g.vh,how:g.how,side:side,why:why}); }
  catch(e){ toast('That photo didn’t work. Try again.',2600,1); if(window.MC) MC().log&&MC().log('ebay capture fail '+e.message); }
  E&&(E.busy=false); if($('ebShut')) $('ebShut').disabled=false;
}
async function processPhoto(blob,ctx){
  var s=SHOTS[E.i], k=s.k, im=await loadImg(blob), W0=im.naturalWidth,H0=im.naturalHeight, lim=3200, sc=Math.min(1,lim/Math.max(W0,H0));
  var F=canvas(W0*sc,H0*sc); F.getContext('2d').drawImage(im,0,0,F.width,F.height);
  ctx=ctx||{G:null,q:null,vw:F.width,vh:F.height,side:E.side};
  // video coords -> photo coords (photo may have a wider field than the video: assume a shared center)
  var fx=F.width/ctx.vw, fy=F.height/ctx.vh, f=Math.min(fx,fy), offx=(F.width-ctx.vw*f)/2, offy=(F.height-ctx.vh*f)/2; if(Math.abs(fx-fy)/fx<0.02){ f=fx; offx=0; offy=0; }
  function v2p(p){ return [p[0]*f+offx,p[1]*f+offy]; }
  var G=ctx.G?{x:ctx.G.x*f+offx,y:ctx.G.y*f+offy,w:ctx.G.w*f,h:ctx.G.h*f}:{x:F.width*0.08,y:F.height*0.08,w:F.width*0.84,h:F.height*0.84};
  var out, note='', low=false, found=false;
  if(s.card){
    var src=ctx.side?rot90(F,false):F;
    function rp(p){ return ctx.side?[p[1],F.width-p[0]]:p; } // photo coords -> rotated coords
    var Gr=ctx.side?{x:G.y,y:F.width-G.x-G.w,w:G.h,h:G.w}:G;
    var hq0=ctx.q?ctx.q.map(v2p).map(rp):null; if(hq0&&ctx.side) hq0=[hq0[1],hq0[2],hq0[3],hq0[0]];
    var quad=refineQuad(src,Gr,hq0);
    if(quad){ found=true; } else { quad=[[Gr.x,Gr.y],[Gr.x+Gr.w,Gr.y],[Gr.x+Gr.w,Gr.y+Gr.h],[Gr.x,Gr.y+Gr.h]]; note='I couldn’t find the card edges, so I kept the framed area. Retake on a plain dark surface for a cleaner crop.'; }
    var wq=(dist(quad[0],quad[1])+dist(quad[3],quad[2]))/2, hq=(dist(quad[0],quad[3])+dist(quad[1],quad[2]))/2, asp=wq/hq;
    if(E.mode==='raw'&&asp>0.62&&asp<0.8) asp=2.5/3.5;
    var H=Math.round(Math.max(1600,Math.min(2400,hq))), Wd=Math.round(H*asp); low=hq<1200;
    var id=I().warp(src,quad,Wd,H), oc=canvas(Wd,H); oc.getContext('2d').putImageData(id,0,0);
    out=ctx.side?rot90(oc,true):oc;
    E.lastSrcH=hq;
  } else {
    var c=canvas(Math.round(G.w),Math.round(G.h)); c.getContext('2d').drawImage(F,G.x,G.y,G.w,G.h,0,0,c.width,c.height);
    var L2=Math.max(1600,c.width); out=c; low=c.width<1200;
    if(c.width<1600){ out=canvas(1600,1600); var ox=out.getContext('2d'); ox.imageSmoothingQuality='high'; ox.drawImage(c,0,0,1600,1600); }
  }
  var sb=await toBlob(out,0.95);
  E.shots[k]={src:sb,card:!!s.card,w:out.width,h:out.height,low:low,found:found,how:ctx.how||'file',srcRes:W0+'x'+H0};
  E.cache={}; E.dirty=true;
  var u=URL.createObjectURL(sb);
  toast(s.t+' saved ✓'+(note?' '+note:''),note?4200:1600,!!note);
  showSaved(s,u);
  if(E.opts.onShot) try{ E.opts.onShot(k,E.shots[k]); }catch(e){}
  advance();
}
function refineQuad(F,G,hint){
  if(!I()) return null;
  var tries=[0.16,0.3];
  for(var t=0;t<tries.length;t++){
    var ex=tries[t], R={x:Math.max(0,G.x-G.w*ex),y:Math.max(0,G.y-G.h*ex)}; R.w=Math.min(F.width,G.x+G.w*(1+ex))-R.x; R.h=Math.min(F.height,G.y+G.h*(1+ex))-R.y;
    var L=700, sc=Math.min(1,L/Math.max(R.w,R.h)), c=canvas(R.w*sc,R.h*sc); c.getContext('2d').drawImage(F,R.x,R.y,R.w,R.h,0,0,c.width,c.height); c.naturalWidth=c.width; c.naturalHeight=c.height;
    var A=I().analyse(c,L), r=I().findQuad(A,E.mode);
    if(r&&r.quad){ var q=r.quad.map(function(p){ return [R.x+p[0]/(A.s*sc),R.y+p[1]/(A.s*sc)]; });
      if(!hint) return q; var dd=Math.max.apply(null,q.map(function(p,i){return dist(p,hint[i])}))/Math.hypot(G.w,G.h); if(dd<0.12) return q; if(t===tries.length-1) return q; }
  }
  return hint&&hint.length===4?hint:null;
}
function showSaved(s,u){
  var m=$('ebMsg'); m.classList.remove('on'); var el=document.createElement('div'); el.className='ebsaved'; el.innerHTML='<img src="'+u+'" alt=""><span>'+esc(s.t)+' saved ✓</span><button class="chip" data-rk="'+s.k+'">Retake</button>';
  $('ebStage').appendChild(el); el.querySelector('button').onclick=function(e){ e.stopPropagation(); E.i=SHOTS.indexOf(s); el.remove(); showCam(); };
  setTimeout(function(){ el.classList.add('out'); setTimeout(function(){ el.remove(); },400); },2600);
}

/* ---------- render final files ---------- */
async function finalBlob(k){
  var sh=E.shots[k], key=k+'|'+E.bg+'|'+(E.touch?1:0); if(E.cache[key]) return E.cache[key];
  var im=await loadImg(sh.src), W=im.naturalWidth, H=im.naturalHeight, c;
  var card=canvas(W,H), cx=card.getContext('2d'); cx.drawImage(im,0,0);
  if(E.touch&&I()&&I().enhance){ try{ var id=cx.getImageData(0,0,W,H); I().enhance(id,{sharp:0.35},[]); cx.putImageData(id,0,0); }catch(e){} }
  if(sh.card&&!sh.baked){ var p=Math.round(Math.max(W,H)*0.05); c=canvas(W+2*p,H+2*p); var x=c.getContext('2d'); x.fillStyle=BG[E.bg]; x.fillRect(0,0,c.width,c.height); x.drawImage(card,p,p); }
  else c=card;
  var b=await toBlob(c,0.9); E.cache[key]=b; return b;
}
function taken(){ return E.order.filter(function(k){ return E.shots[k]; }); }
async function files(){ var base=baseName(E.opts.names), out=[]; var L=taken(); for(var i=0;i<L.length;i++){ var b=await finalBlob(L[i]); out.push({k:L[i],name:fileName(base,L[i]),blob:b,src:E.shots[L[i]].baked?null:E.shots[L[i]].src,low:E.shots[L[i]].low}); } return out; }

/* ---------- results ---------- */
function showCam(){
  E.view='cam'; $('ebCam').style.display=''; $('ebRes').style.display='none'; $('ebRes').innerHTML=''; E.t0=Date.now(); E.peak=0; E.armed=true; $('ebHint').textContent='';
  if(E.shots[SHOTS[E.i].k]) E.armed=true;
  paintCtl(); startCam().then(function(ok){ if(ok){ sizeOverlay(); } });
}
function showResults(){
  E.view='res'; stopCam(); $('ebCam').style.display='none'; var R=$('ebRes'); R.style.display='';
  $('ebTtl').textContent='Your eBay photos'; paintDots(); renderRes();
}
async function renderRes(){
  var R=$('ebRes'), L=taken(), base=baseName(E.opts.names);
  var opt=SHOTS.filter(function(s){ return !s.req&&!E.shots[s.k]; });
  var h='<div class="ebrwrap"><p class="ebrsub">'+(L.length?('<b>'+L.length+' photo'+(L.length===1?'':'s')+'</b> in eBay order. Drag ⠿ or use ‹ › to change the order. The first one is your main photo.'):'No photos yet.')+'</p>';
  if(!E.shots.front||!E.shots.back) h+='<div class="warnb">'+(!E.shots.front?'The front is missing. ':'')+(!E.shots.back?'The back is missing. ':'')+'Buyers expect both. <button class="chip" data-r="take" data-k="'+(!E.shots.front?'front':'back')+'">Take it now</button></div>';
  h+='<div class="ebgrid" id="ebGrid">';
  L.forEach(function(k,i){ var s=shot(k); h+='<div class="ebtile" data-k="'+k+'"><div class="ebimg"><img alt="'+esc(s.t)+'" data-img="'+k+'"><span class="ebn">'+(i+1)+'</span><span class="ebdrag" data-drag="'+k+'" aria-label="Drag to reorder">⠿</span></div><div class="ebcap"><b>'+esc(s.t)+'</b><small>'+esc(fileName(base,k))+'</small>'+(E.shots[k].low?'<small class="lo">Camera gave a small photo, may look soft</small>':'')+'</div><div class="ebtb"><button class="chip" data-r="left" data-k="'+k+'" aria-label="Move earlier"'+(i?'':' disabled')+'>‹</button><button class="chip" data-r="take" data-k="'+k+'">Retake</button><button class="chip" data-r="rm" data-k="'+k+'" aria-label="Remove">✕</button><button class="chip" data-r="right" data-k="'+k+'" aria-label="Move later"'+(i<L.length-1?'':' disabled')+'>›</button></div></div>'; });
  h+='</div>';
  h+='<div class="ebset"><div class="lab">Background around the card</div><div class="seg ebseg" id="ebBg"><button data-v="dark" class="'+(E.bg==='dark'?'on':'')+'">Dark gray</button><button data-v="white" class="'+(E.bg==='white'?'on':'')+'">White</button></div>'+
     '<div class="lab">Colors</div><div class="seg ebseg" id="ebTouch"><button data-v="0" class="'+(!E.touch?'on':'')+'">Original (true color)</button><button data-v="1" class="'+(E.touch?'on':'')+'">Light touch-up</button></div>'+
     '<div class="pvnote">'+(E.touch?'Light touch-up evens the light, eases a color cast, softens shine a little and sharpens lightly. It never hides scratches, wear or centering. Tap “Original” to undo.':'True color: the card exactly as the camera saw it, straightened and cropped. Nothing hidden.')+'</div></div>';
  h+='<button class="gold-btn ebbig" data-r="save"'+(L.length?'':' disabled')+'>⬇ Save all to my phone</button>';
  h+='<button class="ghost-btn ebbig" data-r="done">✓ Done'+(E.opts.cardTitle?', keep them with this card':', make a card with these')+'</button>';
  if(opt.length) h+='<button class="ghost-btn ebbig" data-r="more">+ Add close-ups ('+opt.map(function(s){return s.t.replace(' corner','')}).slice(0,3).join(', ')+(opt.length>3?'…':'')+')</button>';
  h+=TIPS+'<div class="pvnote">Made on this phone. Nothing is sent anywhere. Files are JPEG, '+(L.length?'about '+(E.shots[L[0]].h||1600)+' px tall':'1600 px or more')+'.</div></div>';
  R.innerHTML=h;
  for(var i=0;i<L.length;i++){ (function(k){ finalBlob(k).then(function(b){ var im=R.querySelector('[data-img="'+k+'"]'); if(im){ if(im._u) URL.revokeObjectURL(im._u); im._u=URL.createObjectURL(b); im.src=im._u; } }); })(L[i]); }
  R.onclick=resClick; dragSetup($('ebGrid'));
  if(E.dirty){ E.dirty=false; attach(false); }
}
async function resClick(e){
  var b=e.target.closest('[data-r]'); if(b){ var r=b.dataset.r, k=b.dataset.k, L=E.order, i=L.indexOf(k);
    if(r==='left'||r==='right'){ var L2=taken(), j=L2.indexOf(k), o=L2[j+(r==='left'?-1:1)]; if(!o) return; var a=L.indexOf(o); L[i]=o; L[a]=k; E.dirty=true; renderRes(); return; }
    if(r==='take'){ E.i=SHOTS.indexOf(shot(k)); delete E['skip_'+k]; showCam(); return; }
    if(r==='rm'){ sheet('Remove the '+shot(k).t.toLowerCase()+' photo?','You can take it again any time.',[{t:'Remove',fn:function(){ delete E.shots[k]; E.cache={}; E.dirty=true; renderRes(); }},{t:'Keep it',g:1}]); return; }
    if(r==='save'){ saveAll(); return; }
    if(r==='done'){ finish(); return; }
    if(r==='more'){ SHOTS.forEach(function(s){ delete E['skip_'+s.k]; }); var n=nextNeeded(1); E.i=n<0?2:n; showCam(); return; }
  }
  var sg=e.target.closest('#ebBg button,#ebTouch button'); if(sg){ if(sg.parentNode.id==='ebBg') E.bg=sg.dataset.v; else E.touch=sg.dataset.v==='1'; E.dirty=true; renderRes(); return; }
}
function dragSetup(grid){
  if(!grid) return; var drag=null;
  grid.addEventListener('pointerdown',function(e){ var h=e.target.closest('[data-drag]'); if(!h) return; e.preventDefault(); var t=h.closest('.ebtile'); drag={k:t.dataset.k,el:t}; t.classList.add('drag'); try{ h.setPointerCapture(e.pointerId); }catch(er){} });
  grid.addEventListener('pointermove',function(e){ if(!drag) return; e.preventDefault(); var over=document.elementFromPoint(e.clientX,e.clientY), t=over&&over.closest&&over.closest('.ebtile'); [].forEach.call(grid.children,function(c){ c.classList.toggle('over',c===t&&c!==drag.el); }); drag.to=t&&t.dataset.k; });
  function end(){ if(!drag) return; var d=drag; drag=null; if(d.to&&d.to!==d.k){ var L=E.order, a=L.indexOf(d.k); L.splice(a,1); var b=L.indexOf(d.to); var tk=taken(); L.splice(b+(tk.indexOf(d.to)>=tk.indexOf(d.k)?1:0),0,d.k); E.dirty=true; } renderRes(); }
  grid.addEventListener('pointerup',end); grid.addEventListener('pointercancel',end);
}
async function attach(final){
  if(!E.opts.onSave) return; var f=await files(); try{ await E.opts.onSave(f,{bg:E.bg,touch:E.touch,order:E.order.slice(),final:final}); }catch(e){ toast('Couldn’t keep the photos with the card: '+(e.message||e),3500,1); }
}
async function finish(){ if(!E) return; var n=taken().length; if(n) await attach(true); var o=E&&E.opts; close(true); if(o&&o.onClose) o.onClose(n); }
async function saveAll(){
  var f=await files(); if(!f.length) return; await attach(false);
  var fs=f.map(function(x){ return new File([x.blob],x.name,{type:'image/jpeg'}); });
  if(navigator.canShare&&navigator.share){ try{ if(navigator.canShare({files:fs})){ await navigator.share({files:fs,title:'eBay photos'}); toast('Shared ✓ Pick “Save images” to put them in your Photos.',3200); return; } }catch(e){ if(e&&e.name==='AbortError'){ toast('Not saved. Tap “Save all” again when you’re ready.',2600); return; } } }
  for(var i=0;i<f.length;i++){ var a=document.createElement('a'), u=URL.createObjectURL(f[i].blob); a.href=u; a.download=f[i].name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(u){ return function(){ URL.revokeObjectURL(u); }; }(u),8000); await wait(450); }
  toast(f.length+' photo'+(f.length===1?'':'s')+' downloaded ✓ Check your Downloads.',3200);
  E&&(E.savedAt=Date.now());
}

/* ---------- small UI ---------- */
function sheet(title,text,btns){
  var s=$('ebSheet'); s.innerHTML='<div class="ebsh"><h3>'+esc(title)+'</h3><p>'+esc(text)+'</p><div class="ebshb"></div></div>'; s.classList.add('on');
  var row=s.querySelector('.ebshb'); btns.forEach(function(b){ var x=document.createElement('button'); x.className=b.g?'gold-btn':'ghost-btn'; x.textContent=b.t; x.onclick=function(){ s.classList.remove('on'); s.innerHTML=''; if(b.fn) b.fn(); }; row.appendChild(x); });
}
function tipSheet(){
  var s=$('ebSheet'); s.innerHTML='<div class="ebsh">'+TIPS+'<div class="ebshb"><button class="gold-btn" id="ebTipOk">Got it</button></div></div>'; s.classList.add('on');
  $('ebTipOk').onclick=function(){ s.classList.remove('on'); s.innerHTML=''; };
}
function toast(m,ms,w){ if(window.MC&&MC().toast) MC().toast(m,ms||1800,w); }

window.EbayCam={open:open,close:close,isOpen:function(){return !!E},SHOTS:SHOTS,fileName:fileName,baseName:baseName,_state:function(){return E}};
function MC(){ return window.MC; }
})();
