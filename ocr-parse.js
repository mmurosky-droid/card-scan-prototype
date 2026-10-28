/* Collectors Desk v0.9 - turns reader words into card fields.
   Rule of thumb: a wrong guess is worse than a blank. Only well-read, dictionary-checked text fills a field ("ok", still marked "check this").
   Weaker reads are returned as "low" suggestions that the screen shows as tappable chips and never fills in by itself. */
(function(root){
'use strict';
var D=root.CardDict||(typeof require!=='undefined'?require('./ocr-dict.js'):null);
function lev(a,b){ var m=a.length,n=b.length; if(Math.abs(m-n)>2) return 9; var p=[],i,j; for(j=0;j<=n;j++) p[j]=j; for(i=1;i<=m;i++){ var c=[i]; for(j=1;j<=n;j++) c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1)); p=c; } return p[n]; }
function norm(t){ return String(t).toUpperCase().replace(/[“”"`]/g,'').replace(/[^A-Z0-9'\/#.\-&]/g,''); }
function alpha(t){ return String(t).toUpperCase().replace(/[^A-Z]/g,''); }
function eq(tok,target){ tok=alpha(tok); target=alpha(target); if(tok===target) return true; return target.length>=6&&tok.length>=5&&lev(tok,target)<=1; }
function cap(w){ return w.charAt(0)+w.slice(1).toLowerCase(); }
var COMMON_RUNS={1:1,2:1,3:1,5:1,8:1,10:1,15:1,20:1,25:1,30:1,35:1,40:1,49:1,50:1,60:1,65:1,75:1,80:1,99:1,100:1,125:1,150:1,175:1,199:1,200:1,249:1,250:1,299:1,300:1,399:1,400:1,499:1,500:1,750:1,999:1,1000:1};
var GENERIC={SELECT:1,SCORE:1,OPTIC:1,MOSAIC:1,ORIGINS:1,ILLUSIONS:1,CHRONICLES:1,REVOLUTION:1,PLAYBOOK:1,CONTENDERS:1,FINEST:1,SPECTRA:1,LEAF:1,PRIZM:1,GENESIS:1,TRIBUTE:1,IMMACULATE:1,FLAWLESS:1,OBSIDIAN:1};
/* group words from one pass into text lines */
function lines(words){
  var by={}; words.forEach(function(w){ (by[w.pass]=by[w.pass]||[]).push(w); });
  var out=[];
  Object.keys(by).forEach(function(p){
    var ws=by[p].slice().sort(function(a,b){return ((a.y0+a.y1)/2)-((b.y0+b.y1)/2)}), cur=null, rows=[];
    ws.forEach(function(w){ var h=w.y1-w.y0, cy=(w.y0+w.y1)/2; if(cur&&Math.abs(cy-cur.cy)<Math.max(h,cur.h)*.6){ cur.w.push(w); cur.cy=(cur.cy*(cur.w.length-1)+cy)/cur.w.length; cur.h=Math.max(cur.h,h);} else{ cur={w:[w],cy:cy,h:h}; rows.push(cur);} });
    rows.forEach(function(r){ r.w.sort(function(a,b){return a.x0-b.x0}); var seg=[r.w[0]]; for(var i=1;i<r.w.length;i++){ var gap=r.w[i].x0-r.w[i-1].x1; if(gap>Math.max(r.h*2.2,.04)){ out.push({pass:p,w:seg}); seg=[]; } seg.push(r.w[i]); } out.push({pass:p,w:seg}); });
  });
  return out;
}
function parse(words,sport,opt){
  sport=sport||'Baseball'; var res={fields:{},flags:{},low:{},conf:{},debug:{}};
  var L=lines(words), toks=words.map(function(w){ return {t:norm(w.t),a:alpha(w.t),c:w.c,pass:w.pass}; }).filter(function(w){return w.t});
  function lowAdd(k,v,c){ var a=res.low[k]=res.low[k]||[]; if(a.every(function(x){return x.v!==v})) a.push({v:v,c:c}); }
  // ---- team ----
  var tf=D.TEAMS.filter(function(t){return t.sport===sport}), other=D.TEAMS.filter(function(t){return t.sport!==sport});
  var teamHits={};
  function hit(t,c,kind){ var h=teamHits[t.full+'|'+t.sport]; if(!h) h=teamHits[t.full+'|'+t.sport]={t:t,c:0,kind:'',n:0}; h.n++; if(c>h.c){h.c=c;} if(kind==='full'||!h.kind) h.kind=kind; if(kind==='full') h.kind='full'; }
  D.TEAMS.forEach(function(t){
    var nickW=t.nick.split(' '), cityW=t.city.split(' ').map(function(x){return x.replace('.','')});
    L.forEach(function(ln){
      var a=ln.w.map(function(w){return alpha(w.t)}), cs=ln.w.map(function(w){return w.c});
      for(var i=0;i<a.length;i++){
        var okN=nickW.every(function(nw,j){ return a[i+j]!==undefined&&eq(a[i+j],nw)&&cs[i+j]>=65 });
        if(okN){ var cc=Math.min.apply(null,cs.slice(i,i+nickW.length)); var withCity=false; if(cityW.length&&i>=cityW.length){ withCity=cityW.every(function(cw,j){return eq(a[i-cityW.length+j],cw)}); }
          hit(t,cc,withCity?'full':'nick'); }
        var okC=cityW.every(function(cw,j){ return a[i+j]!==undefined&&alpha(cw)===a[i+j]&&cs[i+j]>=45 });
        if(okC&&alpha(t.city).length>=5) hit(t,Math.min.apply(null,cs.slice(i,i+cityW.length)),'city');
      }
    });
    // chopped nickname (e.g. AMONDBA from DIAMONDBACKS): 7+ letters of a nickname
    var nk=alpha(t.nick); if(nk.length>=9) toks.forEach(function(w){ if(w.a.length>=7&&w.c>=60&&nk.indexOf(w.a)>=0&&w.a!==nk) hit(t,w.c,'part'); });
  });
  var hs=Object.keys(teamHits).map(function(k){return teamHits[k]});
  var mine=hs.filter(function(h){return h.t.sport===sport}), oth=hs.filter(function(h){return h.t.sport!==sport});
  function rank(h){ return (h.kind==='full'?3:h.kind==='nick'?2:h.kind==='part'?2:1)*1000+h.c+h.n; }
  mine.sort(function(a,b){return rank(b)-rank(a)});
  if(mine.length){
    var best=mine[0], top=mine.filter(function(h){return rank(h)===rank(best)});
    var strongKind=best.kind==='full'||best.kind==='nick'||best.kind==='part';
    // a bare city shared by two teams (Los Angeles, New York, Chicago) is ambiguous
    var amb=top.length>1&&(best.kind==='city'||top.some(function(h){return h.t.nick!==best.t.nick}));
    if(!amb&&(strongKind||best.c>=85||(best.n>=3&&best.c>=55))&&best.c>=45){ res.fields.team=best.t.full; res.conf.team=best.c; }
    else mine.slice(0,3).forEach(function(h){ lowAdd('team',h.t.full,h.c); });
  }
  oth.slice(0,2).forEach(function(h){ if(h.kind!=='city'&&!res.fields.team) lowAdd('team',h.t.full,h.c); });
  // ---- year ----
  var yr=(new Date()).getFullYear()+1, ys={};
  toks.forEach(function(w){ if(/^(19[5-9]\d|20[0-3]\d)$/.test(w.t.replace(/^©/,''))&&w.c>=70){ var y=+w.t.replace(/^©/,''); if(y<=yr){ var o=ys[y]=ys[y]||{n:0,c:0}; o.n++; o.c=Math.max(o.c,w.c); } } });
  var yk=Object.keys(ys).sort(function(a,b){return (ys[b].n*100+ys[b].c)-(ys[a].n*100+ys[a].c)});
  if(yk.length){ var y0=yk[0], o0=ys[y0]; if(o0.n>=2&&o0.c>=85&&yk.length===1){ res.fields.year=y0; res.conf.year=o0.c; } else lowAdd('year',y0,o0.c); }
  // ---- set / brand ----
  var fnd={}, fndN={}; toks.forEach(function(w){ D.BRAND_SET.forEach(function(b){ if(eq(w.a,b)||(b==='BOWMAN'&&/^BOWMANS?'?S?$/.test(w.a)&&w.a.length>=6)){ var thr=GENERIC[b]?85:65; if(w.c>=thr){ fnd[b]=Math.max(fnd[b]||0,w.c); fndN[b]=(fndN[b]||0)+1; } } }); });
  if(fnd.BOWMAN&&toks.some(function(w){return /^BOWMANS/.test(w.a)})&&fnd.BEST) fnd.__BB=Math.min(fnd.BOWMAN,fnd.BEST);
  // "TOPPS CERTIFIED AUTOGRAPH ISSUE" is a printed phrase on Bowman and other cards, not the set name
  if(fnd.TOPPS&&toks.some(function(w){return w.c>=55&&eq(w.a,'CERTIFIED')})){ var onlyCert=true; L.forEach(function(ln){ ln.w.forEach(function(w,i){ if(eq(w.t,'TOPPS')&&w.c>=65){ var nx=ln.w[i+1]; if(!(nx&&eq(nx.t,'CERTIFIED'))) onlyCert=false; } }); }); if(onlyCert) delete fnd.TOPPS; }
  if(fnd.TOPPS&&toks.some(function(w){return w.c>=55&&(eq(w.a,'AUTOGRAPH')||eq(w.a,'CERTIFIED')||w.a==='ISSUE')})){ lowAdd('brand','Topps',fnd.TOPPS); delete fnd.TOPPS; }
  var bPick=null, bc=0;
  if(fnd.__BB){ bPick="Bowman's Best"; bc=fnd.__BB; }
  else D.BRANDS.some(function(b){ var ws=b.toUpperCase().replace(/[^A-Z &]/g,'').split(' ').filter(function(x){return x&&x!=='&'}); if(ws.length<2&&['CHROME','STERLING','GENESIS','BBM','SCORE','SELECT'].indexOf(ws[0])>=0&&!(ws[0]==='GENESIS'||ws[0]==='BBM'||ws[0]==='SCORE'||ws[0]==='SELECT')) return false;
    if(b==="Bowman's Best") return false;
    var cs=ws.map(function(w){ return fnd[w]; }); if(cs.every(function(c){return c})){ bPick=b; bc=Math.min.apply(null,cs); return true; } return false; });
  if(bPick&&bPick==='Chrome'){ lowAdd('brand','Bowman Chrome',bc); lowAdd('brand','Topps Chrome',bc); bPick=null; }
  if(bPick&&bPick==='Sterling'&&!fnd.BOWMAN){ lowAdd('brand','Bowman Sterling',bc); bPick=null; }
  if(bPick){ var nmin=Math.min.apply(null,bPick.toUpperCase().replace(/[^A-Z &]/g,'').split(' ').filter(function(x){return x&&x!=='&'}).map(function(x){return fndN[x]||1}));
  if(bc>=70&&(nmin>=2||bc>=95)){ res.fields.brand=bPick; res.conf.brand=bc; } else lowAdd('brand',bPick,bc); }
  else if(fnd.CHROME&&!res.low.brand){ lowAdd('brand','Bowman Chrome',fnd.CHROME); lowAdd('brand','Topps Chrome',fnd.CHROME); }
  // ---- serial ----
  var sers={};
  function digs(s){ return s.replace(/[OQD]/g,'0').replace(/[Il|]/g,'1').replace(/S/g,'5').replace(/B/g,'8'); }
  function addSer(a,b,c){ a=+a; b=+b; if(!(b>=1&&a>=1&&a<=b&&b<=9999)) return; var k=a+'/'+b; var o=sers[k]=sers[k]||{c:0,n:0}; o.n++; o.c=Math.max(o.c,c); o.run=b; }
  toks.forEach(function(w){ var m=w.t.match(/^([0-9OQDIl|S]{1,4})\/([0-9OQDIl|SB]{1,4})$/i); if(m&&w.c>=50){ var A=digs(m[1].toUpperCase()), Bv=digs(m[2].toUpperCase()); if(/^\d+$/.test(A)&&/^\d+$/.test(Bv)) addSer(A,Bv,w.c); } });
  L.forEach(function(ln){ var t=ln.w.map(function(w){return w.t}).join(' '); var cmin=Math.min.apply(null,ln.w.map(function(w){return w.c})); var m=t.match(/(?:^|\s)(\d{1,4})\s+\/\s*(\d{1,4})(?:\s|$)/); if(m&&cmin>=50) addSer(m[1],m[2],cmin); });
  var sk=Object.keys(sers).sort(function(a,b){return sers[b].c-sers[a].c});
  if(sk.length){ var s0=sk[0], so=sers[s0]; var common=!!COMMON_RUNS[so.run]; var pad=''; if(so.c>=75&&common) { var raw=null; toks.some(function(w){ var mm=w.t.match(/^([0-9]{2,4})\/([0-9]{1,4})$/); if(mm&&(+mm[1]+'/'+ +mm[2])===s0){ raw=w.t; return true; } return false; }); res.fields.serial=raw||s0; res.conf.serial=so.c; } else lowAdd('serial',s0,so.c); }
  // ---- card number ----
  toks.forEach(function(w,i){ var m=w.t.match(/^(?:NO\.?|#)(\d{1,4}[A-Z]?)$/); if(m&&w.c>=70&&!res.fields.number){ res.fields.number=m[1]; res.conf.number=w.c; } else if((w.t==='NO.'||w.t==='NO'||w.t==='#')&&w.c>=70&&toks[i+1]&&/^\d{1,4}[A-Z]?$/.test(toks[i+1].t)&&toks[i+1].c>=70&&!res.fields.number){ res.fields.number=toks[i+1].t; res.conf.number=Math.min(w.c,toks[i+1].c); } });
  // ---- parallel (only when the word is printed on the card) ----
  var TEAMWORDS={RED:'SOX',WHITE:'SOX',BLUE:'JAYS',GREEN:'BAY',GOLD:'STATE'};
  var par=null, parC=0;
  L.forEach(function(ln){ ln.w.forEach(function(w,i){ D.PARALLELS.forEach(function(p){ var P=alpha(p); if(!(alpha(w.t)===P||(P.length>=7&&eq(w.t,P)))) return; var nx=ln.w[i+1]&&alpha(ln.w[i+1].t); if(TEAMWORDS[P]&&nx&&(nx===TEAMWORDS[P]||nx==='BAY')) return; if(w.c>=(P.length>=7?70:90)&&w.c>parC){ par=p; parC=w.c; } }); }); });
  if(par){ if(['Refractor','Superfractor','X-Fractor','Xfractor','Mojo','Prism','Shimmer','Atomic','Rainbow'].indexOf(par)>=0){ res.fields.parallel=par; res.conf.parallel=parC; } else lowAdd('parallel',par,parC); }
  // ---- flags ----
  function has(list,thr,fuzzy){ return toks.some(function(w){ return list.some(function(x){ return w.c>=thr&&(fuzzy&&x.length>=7?eq(w.a,x):w.a===x); }); }); }
  if(has(['AUTOGRAPH','AUTOGRAPHS','AUTOGRAPHED'],60,true)||has(['AUTO'],85)) res.flags.auto=true;
  if(toks.some(function(w){return w.c>=70&&w.a==='ISSUE'})&&toks.some(function(w){return w.c>=60&&w.a.length>=5&&/IFIED$/.test(w.a)})) res.flags.auto=true;
  if(has(['ROOKIE'],70,true)||has(['RC'],92)) res.flags.rookie=true;
  if(has(['PATCH','RELIC','JERSEY','MEMORABILIA'],85,true)) res.flags.relic=true;
  // ---- player ----
  var NN={}; D.NOT_NAME.forEach(function(w){NN[w]=1});
  D.TEAMS.forEach(function(t){ t.nick.split(' ').concat(t.city.replace('.','').split(' ')).forEach(function(w){ NN[w]=1; }); });
  function notName(a){ if(NN[a]) return true; if(a.length>=6){ for(var k in NN){ if(k.length>=6&&lev(a,k)<=1) return true; } } return false; }
  var cands={};
  L.forEach(function(ln){
    var ws=ln.w.filter(function(w){return /[A-Za-z]/.test(w.t)});
    for(var i=0;i<ws.length;i++) for(var n=2;n<=3&&i+n<=ws.length;n++){
      var g=ws.slice(i,i+n), a=g.map(function(w){return alpha(w.t)}), ok=true;
      var suf=/^(JR|SR|II|III|IV)$/.test(a[n-1]); var core=suf?a.slice(0,n-1):a; if(core.length<2) continue;
      if(!D.isFirstName(core[0].toLowerCase())) continue;
      core.forEach(function(x,j){ if(x.length<(j===0?2:3)||!/^[A-Z]+$/.test(x)||!/[AEIOUY]/.test(x)||notName(x)) ok=false; });
      if(core.length>=2&&core[1]===core[0]) ok=false;
      var cm=Math.min.apply(null,g.map(function(w){return w.c})); if(!ok||cm<60) continue;
      var nm=core.map(cap).join(' ')+(suf?' '+(a[n-1].length<=2&&a[n-1]!=='II'?cap(a[n-1])+'.':a[n-1]==='II'||a[n-1]==='III'||a[n-1]==='IV'?a[n-1]:cap(a[n-1])+'.'):'');
      var o=cands[nm]=cands[nm]||{c:0,n:0,passes:{}}; o.n++; o.c=Math.max(o.c,Math.round(g.reduce(function(s,w){return s+w.c},0)/g.length)); o.passes[ln.pass]=1;
    }
  });
  var pk=Object.keys(cands).sort(function(a,b){ var A=cands[a],B=cands[b]; return (B.c+Object.keys(B.passes).length*10+a.length*0)-(A.c+Object.keys(A.passes).length*10); });
  // prefer the longest name when one candidate contains another (e.g. a 3-word read of a 2-word name)
  if(pk.length){ var p0=pk[0], o0=cands[p0]; var np=Object.keys(o0.passes).length;
    if(o0.c>=80&&(np>=2||o0.c>=90)){ res.fields.player=p0; res.conf.player=o0.c; } else lowAdd('player',p0,o0.c);
    pk.slice(1,3).forEach(function(k){ if(cands[k].c>=80) lowAdd('player',k,cands[k].c); }); }
  else {
    // surname only (first name too small to read): offer as a low-confidence hint
    var sn={}; toks.forEach(function(w){ if(w.a.length>=7&&w.c>=88&&/^[A-Z]+$/.test(w.a)&&/[AEIOUY]/.test(w.a)&&!notName(w.a)&&!Object.keys(NN).some(function(k){return k.length>=5&&(k.indexOf(w.a)===0||w.a.indexOf(k)===0)})){ var o=sn[w.a]=sn[w.a]||{n:0,c:0,p:{}}; o.n++; o.p[w.pass]=1; o.c=Math.max(o.c,w.c); } });
    Object.keys(sn).filter(function(k){return Object.keys(sn[k].p).length>=2}).sort(function(a,b){return sn[b].c-sn[a].c}).slice(0,1).forEach(function(k){ lowAdd('surname',cap(k),sn[k].c); });
  }
  return res;
}
var API={parse:parse,lines:lines,lev:lev};
if(typeof module!=='undefined'&&module.exports) module.exports=API; else root.CardParse=API;
})(typeof window!=='undefined'?window:global);
