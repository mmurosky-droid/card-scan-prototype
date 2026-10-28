/* Collectors Desk v0.10 - turns reader fragments into ranked "check this" suggestions.
   Everything here is bundled and runs on this device. The set list below was written by hand from public facts (names of
   brands and product lines, the years a line is known to exist, and serial-number formats). It is not a copy of any checklist.
   A suggestion is never filled in by itself unless two separate reads agree on a distinct word; the rest are tap-to-use chips. */
(function(root){
'use strict';
var D=root.CardDict, G={};
function alpha(t){ return String(t||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z]/g,''); }
function lev(a,b){ var m=a.length,n=b.length; if(Math.abs(m-n)>2) return 9; var p=[],i,j; for(j=0;j<=n;j++) p[j]=j; for(i=1;i<=m;i++){ var c=[i]; for(j=1;j<=n;j++) c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1)); p=c; } return p[n]; }
G.alpha=alpha; G.lev=lev;
/* [brand, line, sports, keywords, ys (years it is known to exist in, may be empty), subs (named autograph/insert lines), list (official checklist link, if known)]
   sports: B baseball, F football, K basketball, H hockey, A any */
var S=[
['Topps','Topps Chrome','B,F,K',['CHROME','TOPPS'],[],[],''],
['Topps','Topps Heritage','B,F,K',['HERITAGE','TOPPS'],[],[],''],
['Topps','Topps Stadium Club','B,F,K',['STADIUM','CLUB'],[],[],''],
['Topps','Topps Finest','B,F,K',['FINEST','TOPPS'],[],[],''],
['Topps','Topps Allen & Ginter','B',['GINTER','ALLEN'],[],[],''],
['Topps','Topps Gypsy Queen','B',['GYPSY','QUEEN'],[],[],''],
['Topps','Topps Archives','B',['ARCHIVES','TOPPS'],[],[],''],
['Topps','Topps Tribute','B',['TRIBUTE','TOPPS'],[],[],''],
['Topps','Topps Dynasty','B',['DYNASTY','TOPPS'],[],[],''],
['Topps','Topps Inception','B',['INCEPTION','TOPPS'],[],[],''],
['Topps','Topps Tier One','B',['TIER','ONE'],[],[],''],
['Topps','Topps Museum Collection','B',['MUSEUM','COLLECTION'],[],[],''],
['Topps','Topps Triple Threads','B',['TRIPLE','THREADS'],[],[],''],
['Topps','Topps Five Star','B',['FIVE','STAR','TOPPS'],[],[],''],
['Topps','Topps Transcendent','B',['TRANSCENDENT'],[],[],''],
['Topps','Topps Opening Day','B',['OPENING','DAY'],[],[],''],
['Topps','Topps Update','B',['UPDATE','TOPPS'],[],[],''],
['Topps','Topps Series 1','B',['SERIES','TOPPS'],[],[],''],
['Topps','Topps Diamond Icons','B',['DIAMOND','ICONS'],[2020,2021,2023,2024],['Autographs'],'https://www.topps.com/media/pdf/DiamondIconsChecklist.pdf'],
['Topps','Topps Pristine','B',['PRISTINE'],[],[],''],
['Topps','Topps Gallery','B',['GALLERY','TOPPS'],[],[],''],
['Topps','Topps Luminaries','B',['LUMINARIES'],[],[],''],
['Topps','Topps Sapphire','B',['SAPPHIRE'],[],[],''],
['Bowman','Bowman Chrome','B',['BOWMAN','CHROME'],[],[],''],
['Bowman','Bowman Sterling','B',['BOWMAN','STERLING'],[],[],''],
["Bowman","Bowman's Best",'B',['BOWMANS','BEST'],[],[],''],
['Bowman','Bowman Platinum','B',['PLATINUM','BOWMAN'],[],[],''],
['Bowman','Bowman Draft','B',['BOWMAN','DRAFT'],[],[],''],
['Bowman','Bowman Inception','B',['BOWMAN','INCEPTION'],[],[],''],
['Bowman','Bowman Transcendent','B',['BOWMAN','TRANSCENDENT'],[],[],''],
['Bowman','Bowman','B',['BOWMAN'],[],[],''],
['Panini','Panini National Treasures','A',['NATIONAL','TREASURES'],[],[],''],
['Panini','Panini Prizm','A',['PRIZM'],[],[],''],
['Panini','Panini Select','A',['SELECT','PANINI'],[],[],''],
['Panini','Panini Mosaic','A',['MOSAIC'],[],[],''],
['Panini','Donruss Optic','A',['OPTIC'],[],[],''],
['Panini','Donruss','A',['DONRUSS'],[],[],''],
['Panini','Panini Contenders','A',['CONTENDERS'],[],[],''],
['Panini','Panini Chronicles','A',['CHRONICLES'],[],[],''],
['Panini','Panini Immaculate','A',['IMMACULATE'],[],[],''],
['Panini','Panini Flawless','A',['FLAWLESS'],[],[],''],
['Panini','Panini Spectra','A',['SPECTRA'],[],[],''],
['Panini','Panini Obsidian','A',['OBSIDIAN'],[],[],''],
['Panini','Panini Absolute','A',['ABSOLUTE'],[],[],''],
['Panini','Panini Certified','A',['CERTIFIED','PANINI'],[],[],''],
['Panini','Panini Illusions','A',['ILLUSIONS'],[],[],''],
['Panini','Panini Origins','A',['ORIGINS'],[],[],''],
['Panini','Panini Revolution','A',['REVOLUTION'],[],[],''],
['Panini','Panini Playbook','A',['PLAYBOOK'],[],[],''],
['Panini','Panini Prestige','F',['PRESTIGE'],[],[],''],
['Upper Deck','Upper Deck Young Guns','H',['YOUNG','GUNS'],[],[],''],
['Upper Deck','Upper Deck SP Authentic','A',['AUTHENTIC','SP'],[],[],''],
['Upper Deck','Upper Deck','A',['UPPER','DECK'],[],[],''],
['Upper Deck','O-Pee-Chee','H',['PEE','CHEE'],[],[],''],
['Fleer','Fleer','A',['FLEER'],[],[],''],
['Score','Score','A',['SCORE'],[],[],''],
['Leaf','Leaf','A',['LEAF'],[],[],''],
['Pinnacle','Pinnacle','A',['PINNACLE'],[],[],''],
['Skybox','Skybox','A',['SKYBOX'],[],[],''],
['Playoff','Playoff','A',['PLAYOFF'],[],[],'']
];
G.SETS=S;
/* words that decide between two lines but are not enough alone */
var WEAK={TOPPS:1,PANINI:1,BOWMAN:0,CLUB:1,ONE:1,STAR:1,DAY:1,UPDATE:1,SERIES:1,DECK:1,SP:1,ALLEN:1,QUEEN:1,GUNS:1,BEST:1,COLLECTION:1,THREADS:1,PLATINUM:1,CERTIFIED:1};
/* a reading is a close match for a keyword (letters only). Exact, or one or two slips for longer words. */
function near(tok,kw){ if(tok===kw) return 1; if(kw.length>=6&&tok.length>=5){ var d=lev(tok,kw); if(d<=(kw.length>=7?2:1)) return .6; } return 0; }
G.near=near;
/* tokens from every fragment: [{a:LETTERS, src}] ; src tells which read it came from so one read counted twice does not count as two */
G.tokens=function(frags){ var out=[]; frags.forEach(function(f){ String(f.t||'').replace(/[’']/g,'').split(/[^A-Za-z\u00C0-\u017F]+/).forEach(function(w){ var a=alpha(w); if(a.length>=3) out.push({a:a,src:f.src}); }); }); return out; };
/* rank set lines by the keywords seen. returns [{set, score, exact, srcs}] best first */
G.rankSets=function(tokens,sport){
  var sp=sport==='Baseball'?'B':sport==='Football'?'F':sport==='Basketball'?'K':sport==='Hockey'?'H':'';
  var res=[]; S.forEach(function(s){
    if(sp&&s[2]!=='A'&&s[2].split(',').indexOf(sp)<0) return;
    var score=0,exactSrc={},anySrc={},kwHit=0,strong=0;
    s[3].forEach(function(kw){ var best=0,bs=null; tokens.forEach(function(t){ var n=near(t.a,kw); if(n>best){best=n;bs=t.src;} if(n===1){ exactSrc[kw+'|'+t.src]=1; } if(n>0) anySrc[t.src]=1; });
      if(best>0){ kwHit++; score+=best*(WEAK[kw]?1:2); if(!WEAK[kw]&&best===1) strong++; } });
    if(!score||(s[3].length>1&&kwHit<2&&s[3].every(function(k){return WEAK[k];}))) return;
    /* a multi-word line needs most of its words; a one-word line needs that word */
    if(kwHit<Math.ceil(s[3].length/2)) return;
    res.push({set:s,score:score+(kwHit===s[3].length?1:0),exact:Object.keys(exactSrc).length,srcs:Object.keys(anySrc).length,strong:strong});
  });
  /* Bowman cards also say "Topps Certified Autograph Issue", so a Topps-only line must not win when BOWMAN itself was read */
  var hasBow=tokens.some(function(t){ return t.a==='BOWMAN'||near(t.a,'BOWMAN')===1; }); if(hasBow) res.forEach(function(r){ if(r.set[0]!=='Bowman'&&r.set[3].indexOf('TOPPS')>=0) r.score-=2; });
  res=res.filter(function(r){ return r.score>0; });
  res.sort(function(a,b){ return b.score-a.score||b.exact-a.exact||b.set[1].length-a.set[1].length; });
  return res;
};
/* decide whether the top line may be filled: a distinctive word read exactly in two different reads, and the runner-up is clearly behind */
G.brandFill=function(ranked){
  var t=ranked[0]; if(!t) return null; var r=ranked[1];
  if(t.strong<1||t.exact<2||t.srcs<2) return null;
  if(r&&r.score>=t.score-1&&r.set[0]!==t.set[0]) return null;
  if(r&&r.score===t.score&&r.set[1]!==t.set[1]&&t.set[1].indexOf(r.set[1])<0) return null;
  return t.set[1];
};
/* ---------- names ---------- */
function titleCase(w){ return w.charAt(0).toUpperCase()+w.slice(1).toLowerCase(); }
/* Look through the lines of every read for "FIRST LAST (JR)". Fragments from different reads vote on each word with a small slip allowed. */
G.names=function(lineTexts){
  var notName={}; D.NOT_NAME.forEach(function(w){ notName[w]=1; });
  var firsts={}, seen=0;
  lineTexts.forEach(function(lt){
    var ws=String(lt.t).split(/[^A-Za-z\u00C0-\u017F.]+/).filter(function(w){return alpha(w).length>=2;});
    for(var i=0;i<ws.length-1;i++){ var f=alpha(ws[i]); if(f.length<3) continue; var fn=null;
      if(D.isFirstName(f)) fn=f; else { for(var k in D.FIRST){ if(Math.abs(k.length-f.length)<=1&&f.length>=5&&lev(f.toLowerCase(),k)<=1){ fn=k.toUpperCase(); break; } } }
      if(!fn) continue; var sn=alpha(ws[i+1]); if(sn.length<3||notName[sn]) continue;
      var key=fn, e=firsts[key]=firsts[key]||{first:fn,last:{},srcs:{},suf:{}}; e.srcs[lt.src]=1; seen++;
      var matched=null; Object.keys(e.last).forEach(function(l){ if(lev(l,sn)<=1&&Math.min(l.length,sn.length)>=4) matched=l; }); var key2=matched||sn; var le=e.last[key2]=e.last[key2]||{n:0,c:0,forms:{}}; le.n++; le.c=Math.max(le.c,lt.c||0); le.forms[sn]=(le.forms[sn]||0)+1;
      var sfx=alpha(ws[i+2]||''); if(/^(JR|SR|II|III|IV)$/.test(sfx)) e.suf[sfx]=(e.suf[sfx]||0)+1; }
  });
  var out=[]; Object.keys(firsts).forEach(function(k){ var e=firsts[k]; Object.keys(e.last).forEach(function(l){ var le=e.last[l], form=Object.keys(le.forms).sort(function(a,b){return le.forms[b]-le.forms[a];})[0];
      var suf=Object.keys(e.suf).sort(function(a,b){return e.suf[b]-e.suf[a];})[0]||'';
      out.push({name:titleCase(e.first)+' '+titleCase(form),jr:suf?(' '+(suf==='JR'?'Jr.':suf==='SR'?'Sr.':suf)):'',n:le.n,fn:le.forms[form],srcs:Object.keys(e.srcs).length,c:le.c}); }); });
  out.sort(function(a,b){ return b.n-a.n||b.c-a.c; });
  return out;
};
/* fill only when the same first and last name show up in 2+ different reads */
G.nameFill=function(names){ var t=names[0]; if(!t) return null; if(t.n>=2&&t.fn>=2&&t.srcs>=2&&t.name.split(' ')[1].length>=4){ var r=names[1]; if(r&&r.n>=t.n&&r.name!==t.name) return null; return t.name; } return null; };
/* ---------- the back of the card ---------- */
G.backYear=function(frags){ var cnt={}; frags.forEach(function(f){ var m=String(f.t).match(/(?:©|\(c\)|\bc\b|copyright)\s*((?:19|20)\d\d)/i); if(m) cnt[m[1]]=(cnt[m[1]]||0)+1; }); var k=Object.keys(cnt).sort(function(a,b){return cnt[b]-cnt[a];}); return k.length?{year:+k[0],n:cnt[k[0]]}:null; };
/* ---------- the on-device catalog of what you confirmed ---------- */
var CK='mc-catalog';
function cat(){ try{ return JSON.parse(localStorage.getItem(CK)||'[]'); }catch(e){ return []; } }
G.catalog=cat;
G.remember=function(c){
  if(!c||!c.player||!(c.brand||c.year)) return; var L=cat(), key=alpha(c.player)+'|'+alpha(c.brand)+'|'+(c.year||''), f=null;
  L.forEach(function(e){ if(e.k===key) f=e; });
  if(f){ f.n++; f.ts=Date.now(); f.team=c.team||f.team; f.den=denOf(c.serial)||f.den; f.number=c.number||f.number; }
  else L.push({k:key,player:c.player,brand:c.brand||'',year:c.year||'',team:c.team||'',den:denOf(c.serial),number:c.number||'',sport:c.sport||'',n:1,ts:Date.now()});
  L.sort(function(a,b){return b.ts-a.ts;}); try{ localStorage.setItem(CK,JSON.stringify(L.slice(0,400))); }catch(e){}
};
function denOf(s){ var m=String(s||'').match(/\/\s*(\d{1,4})/); return m?m[1]:''; }
G.denOf=denOf;
/* from your own cards: entries whose player or set the reads point at */
G.fromCatalog=function(tokens,names){
  var L=cat(), out=[]; var ta={}; tokens.forEach(function(t){ ta[t.a]=1; });
  L.forEach(function(e){ var last=alpha(e.player.split(' ').slice(-1)[0]).replace(/(JR|SR)$/,''); if(String(e.player).split(' ').length>1&&/^(Jr\.?|Sr\.?)$/i.test(e.player.split(' ').slice(-1)[0])) last=alpha(e.player.split(' ').slice(-2)[0]);
    var hit=0; if(last.length>=4) tokens.forEach(function(t){ if(near(t.a,last)||t.a===last||(t.a.length>=4&&lev(t.a,last)<=1&&last.length>=5)) hit++; });
    if(hit) out.push({e:e,hit:hit}); });
  out.sort(function(a,b){ return b.hit-a.hit||b.e.n-a.e.n||b.e.ts-a.e.ts; }); return out.slice(0,3).map(function(x){return x.e;});
};
/* recent and common set names for the chip row: yours first, then the big ones */
var COMMON=['Topps Chrome','Bowman Chrome','Topps Series 1','Bowman','Topps Heritage','Panini Prizm','Donruss','Donruss Optic','Topps Update','Topps Stadium Club','Panini Select','Panini Mosaic','Topps Diamond Icons','Bowman Draft','Upper Deck','Panini National Treasures'];
G.brandChips=function(c,guesses,last){
  var out=[],seen={}; function add(n,why){ if(!n) return; var k=alpha(n); if(seen[k]) return; seen[k]=1; out.push({n:n,why:why}); }
  (guesses||[]).forEach(function(g){ add(g,'read'); }); add(last,'last');
  var counts={}; cat().forEach(function(e){ if(e.brand) counts[e.brand]=(counts[e.brand]||0)+e.n; }); Object.keys(counts).sort(function(a,b){return counts[b]-counts[a];}).slice(0,4).forEach(function(n){ add(n,'yours'); });
  COMMON.forEach(function(n){ add(n,'common'); }); return out.slice(0,12);
};
/* ---------- guesses: "Topps Diamond Icons Autographs · Padres · /10" ---------- */
G.guesses=function(ctx){
  var ranked=ctx.ranked||[], out=[], den=ctx.den||'';
  ranked.filter(function(r){ return r.strong>=1; }).slice(0,3).forEach(function(r){ var s=r.set, subs=s[5]||[], base={brand:s[1],set:s,years:(s[4]||[]).slice(),team:ctx.team||'',den:den,score:r.score};
    if(subs.length&&ctx.auto) subs.forEach(function(sub){ out.push(Object.assign({},base,{brand:s[1]+' '+sub,sub:sub})); });
    out.push(base); if(subs.length&&!ctx.auto) subs.forEach(function(sub){ out.push(Object.assign({},base,{brand:s[1]+' '+sub,sub:sub,score:r.score-1})); }); });
  /* one line per set first, so two near-tied sets both show before any sub-set variant of the first */
  var seenS={}, first=[], rest=[]; out.forEach(function(g){ var k=g.set[1]; if(!seenS[k]){ seenS[k]=1; first.push(g); } else rest.push(g); }); out=first.concat(rest);
  out.forEach(function(g){ var t=g.team?g.team.replace(/^.*\s/,''):''; g.label=g.brand+(t?' · '+t:'')+(g.den?' · /'+g.den:''); });
  return out.slice(0,4);
};
/* ---------- "Search the web for this card": plain links, opened in a new tab by you. Nothing is sent from the app. ---------- */
G.links=function(ctx){
  var parts=[ctx.year,ctx.brand,ctx.player,ctx.team,ctx.den?('/'+ctx.den):'','card'].filter(function(x){return x;}), q=parts.join(' ').trim()||'baseball card', e=encodeURIComponent;
  var out=[{label:'Search Google for this card',url:'https://www.google.com/search?q='+e(q)}];
  var set=ctx.set&&ctx.set[6]; if(set) out.push({label:'Topps checklist (official PDF)',url:set});
  var tb=/topps|bowman/i.test(ctx.brand||''), pb=/panini|prizm|donruss|optic|mosaic|select|national/i.test(ctx.brand||'');
  out.push({label:(pb?'Panini':'Topps')+' checklist search',url:'https://www.google.com/search?q='+e((pb?'site:paniniamerica.net ':'site:topps.com ')+(ctx.year||'')+' '+(ctx.brand||'')+' checklist '+(ctx.player||''))});
  out.push({label:'Cardboard Connection checklists',url:'https://www.google.com/search?q='+e('site:cardboardconnection.com '+(ctx.year||'')+' '+(ctx.brand||'')+' checklist '+(ctx.player||''))});
  out.push({label:'CardSight AI (card search site)',url:'https://cardsight.ai'});
  return out;
};
root.CardGuess=G;
})(typeof window!=='undefined'?window:this);
