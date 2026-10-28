/* Collectors Desk v0.10 - the "read closer" step. Runs after the first reader, still on this device.
   For one card it: finds and reads a serial number (ocr-serial.js), reads sideways names and set logos (ocr-text.js),
   matches the fragments to the bundled lists (ocr-guess.js) and returns what it is sure of plus tap-to-use suggestions. */
(function(root){
'use strict';
var R={};
function cropToURL(im,box,pad,maxW){ /* box in fractions */
  var W=im.naturalWidth,H=im.naturalHeight, x0=Math.max(0,box[0]-pad),y0=Math.max(0,box[1]-pad),x1=Math.min(1,box[2]+pad),y1=Math.min(1,box[3]+pad);
  var sw=Math.max(8,Math.round((x1-x0)*W)), sh=Math.max(8,Math.round((y1-y0)*H)), sc=Math.min(4,maxW/sw), cv=document.createElement('canvas'); cv.width=Math.round(sw*sc); cv.height=Math.round(sh*sc);
  var cx=cv.getContext('2d'); cx.imageSmoothingQuality='high'; cx.drawImage(im,Math.round(x0*W),Math.round(y0*H),sw,sh,0,0,cv.width,cv.height); return cv.toDataURL('image/jpeg',.8);
}
R.cropToURL=cropToURL;
R.BANDS=[[0,.7,1,1],[.1,.76,.75,.95]];
R.bandVotes=async function(im,o){
  var votes=[], S=root.CardSerial, T=root.CardText, W=im.naturalWidth||im.width, sz=2400, n=0;
  for(var bi=0;bi<R.BANDS.length;bi++) for(var mi=0;mi<2;mi++){ var cv=T.strip(im,R.BANDS[bi],0,sz,mi?'t':'c');
    for(var pi=0;pi<2;pi++){ if(o&&o.shouldStop&&o.shouldStop()) break; var rr; try{ rr=await CardOCR.recognize(cv,{psm:pi?6:12,wl:'0123456789/#'}); }catch(e){ continue; }
      (rr.data.text||'').split(/\s+/).forEach(function(tk){ S._parseSerial(tk).forEach(function(x){ votes.push({ci:100+bi,num:x.num,den:x.den,v:'band'+(mi?'t':'c')+pi,psm:pi?6:12}); }); }); n++; } }
  return {votes:votes,crop:cropToURL(im,[.1,.76,.75,.95],0,520)};
};
function frac(box,ch){ return [box[0]/ch.w,box[1]/ch.h,box[2]/ch.w,box[3]/ch.h]; }
/* one side of the card. side: 'front'|'back' */
R.readSide=async function(im,side,o){
  o=o||{}; var out={side:side,frags:[],serial:null,crop:null,lineBoxes:[]}, d, ch=root.CardSerial.loadChans(im,1200), stop=o.shouldStop||function(){return false;};
  if(o.step) o.step('Looking for a serial number…');
  try{ var sr=await root.CardSerial.read(ch,{stage1:o.fast?14:24,heavy:o.fast?3:5}); d=root.CardSerial.decide(sr.votes); out.serial=d; out.serialMs=sr.ms;
    /* the crop to show next to the keypad: the candidate row that produced the leading read, else the best-supported row, else nothing */
    /* second chance when the main reader did not settle: sparse-text reads of the enlarged bottom band (this is how a small 07/10 under an autograph gets found) */
    if(!d.fill&&!stop()){ if(o.step) o.step('Taking a closer look at the bottom edge…'); var bv=await R.bandVotes(im,o); out.bandCrop=bv.crop; if(bv.votes.length){ sr.votes=sr.votes.concat(bv.votes); d=root.CardSerial.decide(sr.votes); out.serial=d; out.bandVotes=bv.votes.length; } }
    var best=null,bn=-1; sr.trace.forEach(function(e){ var n=e.reads.filter(function(x){ return d.suggest[0]&&x.txt&&x.txt.replace(/\s/g,'').indexOf(d.suggest[0].text)>=0; }).length; if(n>bn){ bn=n; best=e; } });
    if(best&&bn>0) out.crop=cropToURL(im,frac(best.box,ch),.02,420);
    if(!out.crop&&out.bandCrop) out.crop=out.bandCrop;
    out.cands=sr.trace.slice(0,8).map(function(e){ return {box:frac(e.box,ch),q:e.q,shape:e.shape}; });
  }catch(e){ out.serialErr=String(e&&e.message||e); }
  if(stop()) return out;
  if(o.step) o.step('Reading sideways names and logos…');
  try{ var ls=await root.CardText.readLines(ch,{max:o.fast?9:12,shouldStop:stop}); ls.forEach(function(l){ out.lineBoxes.push(frac(l.box,ch)); l.reads.forEach(function(r){ if(/[A-Za-z]{3}/.test(r.t)) out.frags.push({t:r.t,c:r.c,src:side+':L'+out.lineBoxes.length+r.v+r.rot}); }); }); }catch(e){}
  if(stop()) return out;
  try{ var tr=await root.CardText.read(im,{deep:!!o.deep,shouldStop:stop}); tr.frags.forEach(function(f){ f.lines.forEach(function(t,i){ if(/[A-Za-z]{3}/.test(t)) out.frags.push({t:t,c:f.conf,src:side+':'+f.src+f.mode+i}); }); }); }catch(e){}
  return out;
};
/* everything about one card -> suggestions. c: the card; blobs via CardOCR.loadImg */
R.run=async function(c,o){
  o=o||{}; var t0=Date.now(), res={serial:null,sides:{},brand:{fill:null,chips:[],ranked:[]},names:[],nameFill:null,guesses:[],backYear:null,tokens:0,ms:0}, frags=[];
  var sides=[]; if(c.front) sides.push(['front',c.front]); if(c.back) sides.push(['back',c.back]); if(!sides.length) return res;
  for(var i=0;i<sides.length;i++){ if(o.shouldStop&&o.shouldStop()) break; var im=await CardOCR.loadImg(sides[i][1]); var r=await R.readSide(im,sides[i][0],o); res.sides[sides[i][0]]=r; if(!res.strips&&sides[i][0]==='front'){ try{ res.strips={bottom:cropToURL(im,[.02,.7,.98,.98],0,760),top:cropToURL(im,[0,0,1,.2],0,760)}; }catch(e){} } if(!res.bandCrop&&r.bandCrop) res.bandCrop=r.bandCrop; frags=frags.concat(r.frags); (o.extraFrags||[]).forEach(function(f){ frags.push(f); });
    if(r.serial&&(r.serial.fill||r.serial.suggest.length)){ if(!res.serial||(r.serial.fill&&!res.serial.fill)){ res.serial=r.serial; res.serialSide=sides[i][0]; res.crop=r.crop; } else if(res.serial&&!res.serial.fill&&r.serial.suggest.length&&res.serial.suggest.length<2){ res.serial.suggest=res.serial.suggest.concat(r.serial.suggest).slice(0,4); } } }
  if(!res.crop) res.crop=res.bandCrop||(res.strips&&res.strips.bottom)||null; R.digest(res,frags,c); res.ms=Date.now()-t0; return res;
};
/* fragments -> brand, names, guesses (also used when you draw a box, with more fragments added) */
R.digest=function(res,frags,c){
  var G=root.CardGuess, tokens=G.tokens(frags); res.tokens=tokens.length; res.frags=frags;
  var ranked=G.rankSets(tokens,c.sport||'Baseball'); res.brand.ranked=ranked; res.brand.fill=G.brandFill(ranked);
  res.names=G.names(frags); res.nameFill=G.nameFill(G.names(frags.filter(function(f){return /^front/.test(f.src);}))); res.backYear=G.backYear(frags.filter(function(f){return /^back/.test(f.src);}));
  res.fromCatalog=G.fromCatalog(tokens,res.names);
  var den=res.serial&&res.serial.fill?G.denOf(res.serial.fill):(c.serial?G.denOf(c.serial):'');
  res.guesses=G.guesses({ranked:ranked,team:c.team,den:den,auto:!!c.auto});
  return res;
};
root.CardRead=R;
})(typeof window!=='undefined'?window:this);
