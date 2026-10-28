/* Collectors Desk v0.10.2 (Mr. Moose Enterprises, LLC) - fills in the obvious fields after a read.
   Rules: only EMPTY fields, only when there is one strong candidate, always marked "check this" with the reason.
   Never parallel, flaws, condition, grade or price. Blank beats wrong.
   Sources, in order: the read itself, the cards you already confirmed (on this device), a small bundled list of
   current players and their teams (public facts from Wikidata, CC0), and an optional tap-to-use online lookup that
   sends only the player's name text. Nothing else leaves the device. */
(function(){
'use strict';
var D=window.CardDict||{}, PL=window.CardPlayers||null;
var SP={B:'Baseball',F:'Football',K:'Basketball'};
function norm(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim(); }
function lev(a,b){ var m=a.length,n=b.length; if(Math.abs(m-n)>2) return 9; var p=[],i,j; for(j=0;j<=n;j++) p[j]=j; for(i=1;i<=m;i++){ var c=[i]; for(j=1;j<=n;j++) c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a.charAt(i-1)===b.charAt(j-1)?0:1)); p=c; } return p[n]; }
var SUF={jr:1,sr:1,ii:1,iii:1,iv:1};
function parts(name){ var t=norm(name).split(' ').filter(Boolean); var suf=''; if(t.length>1&&SUF[t[t.length-1]]) suf=t.pop(); return {first:t[0]||'',last:t[t.length-1]||'',n:t.length,suf:suf,key:t.join(' ')}; }
function teamSport(full){ var T=D.TEAMS||[]; for(var i=0;i<T.length;i++) if(T[i].full===full) return T[i].sport; return ''; }
/* ---- the bundled list, indexed on first use ---- */
var IDX=null;
function index(){
  if(IDX) return IDX; IDX={byKey:{},byLast:{},n:0};
  if(!PL||!PL.rows) return IDX;
  PL.rows.forEach(function(r){ var f=r.split('|'), nm=f[0], sp=SP[f[1]]||'', tm=f[2].split(',').map(function(i){return PL.teams[+i]}).filter(Boolean), q=f[3]||'';
    var p=parts(nm), e={name:nm,sport:sp,teams:tm,q:q,p:p}; (IDX.byKey[p.key]=IDX.byKey[p.key]||[]).push(e); (IDX.byLast[p.last]=IDX.byLast[p.last]||[]).push(e); IDX.n++; });
  return IDX;
}
function wdUrl(q){ return q?'https://www.wikidata.org/wiki/'+q:''; }
/* an entry is only usable when its name belongs to exactly one person in the list */
function exact(name,sport){ var p=parts(name), L=(index().byKey[p.key]||[]).filter(function(e){return !sport||e.sport===sport}); return L.length===1?L[0]:null; }
function catalog(){ try{ return JSON.parse(localStorage.getItem('mc-catalog')||'[]'); }catch(e){ return []; } }
/* ---- evidence for the sport ---- */
function sportVotes(c,ctx){
  var v={}, why={};
  function add(sp,w){ if(!sp) return; v[sp]=1; (why[sp]=why[sp]||[]).push(w); }
  if(c.team){ var ts=teamSport(c.team); if(ts) add(ts,'the team is '+c.team); }
  var S=(window.CardGuess&&CardGuess.SETS)||[], set=null, i;
  for(i=0;i<S.length;i++) if(c.brand&&(c.brand===S[i][1]||c.brand.indexOf(S[i][1])===0)){ set=S[i]; break; }
  if(set){ var codes=String(set[2]||'').split(',').filter(Boolean); if(codes.length===1) add(SP[codes[0]],'“'+set[1]+'” is a '+SP[codes[0]].toLowerCase()+' set'); }
  if(c.player){ var hit=[]; index(); var p=parts(c.player); (IDX.byKey[p.key]||[]).forEach(function(e){ if(hit.indexOf(e.sport)<0) hit.push(e.sport); }); if(hit.length===1) add(hit[0],'the player is on the bundled '+hit[0].toLowerCase()+' list');
    catalog().forEach(function(e){ if(e.sport&&norm(e.player)===p.key&&e.team&&teamSport(e.team)===e.sport) add(e.sport,'you saved this player as '+e.sport.toLowerCase()+' before'); }); }
  return {v:Object.keys(v),why:why};
}
function sportEvidence(c,ctx){ var s=sportVotes(c,ctx); return s.v.length===1?{sport:s.v[0],why:s.why[s.v[0]][0]}:(s.v.length>1?{conflict:true}:null); }
function askSport(c){ if(c.sportOk||(c.guess&&c.guess.sport)) return false; if(!(c.ocrTs||c.player||c.brand||c.team)) return false; return !sportEvidence(c); }
/* ---- teams for a player ---- */
function teamOptions(c){
  var name=c.player||''; var p=parts(name); if(p.n<2) return null;
  var sp=(c.sportOk||(c.guess&&c.guess.sport))?c.sport:(sportEvidence(c)||{}).sport||'';
  var seen=[], out=[];
  catalog().forEach(function(e){ if(e.team&&norm(e.player)===p.key&&(!sp||!e.sport||e.sport===sp)&&seen.indexOf(e.team)<0){ seen.push(e.team); out.push({team:e.team,src:'cat',why:'You saved '+e.player+' with this team before.'}); } });
  if(out.length) return out;
  index(); var L=(IDX.byKey[p.key]||[]).filter(function(e){return !sp||e.sport===sp});
  if(L.length===1){ L[0].teams.forEach(function(t){ out.push({team:t,src:'wd',q:L[0].q,url:wdUrl(L[0].q),why:'The team this player is listed with now (public Wikidata facts). The card may show an older team, so check it.'}); }); }
  return out;
}
/* ---- the plan: what to put in empty fields ---- */
function set(c,k,v,why,url){ if(v===''||v==null) return false; if(c[k]!==''&&c[k]!=null) return false; if(c.noAuto&&c.noAuto[k]) return false; c[k]=(k==='year'?+v:v); c.guess=c.guess||{}; c.guess[k]=1; c.why=c.why||{}; c.why[k]={t:why||'',u:url||''}; return true; }
/* a name read by the reader is only prefilled when it looks like a person: "First Last" (or Jr./Sr./II/III) with a real first name.
   A stray extra word ("Shohei Ohtani Vos") is cut back to the first two words only when the bundled list or your catalog has exactly that person. */
function okName(nm){
  var tk=String(nm||'').trim().split(/\s+/), po=parts(nm);
  var plain=tk.length===2||(tk.length===3&&/^(jr|sr|ii|iii|iv)\.?$/i.test(tk[2]));
  if(plain) return (!D.isFirstName||D.isFirstName(po.first))?tk.join(' '):'';
  if(tk.length===3){ var two=tk[0]+' '+tk[1], p2=parts(two); index();
    var inList=(IDX.byKey[p2.key]||[]).length===1, inCat=catalog().some(function(e){return norm(e.player)===p2.key});
    if((inList||inCat)&&(!D.isFirstName||D.isFirstName(p2.first))) return two; }
  return '';
}
function nameFromRead(c,ctx){
  var low=ctx.low||{}, names=ctx.names||[], out=null;
  var sn=low.surname&&low.surname.length===1&&low.surname[0].c>=85?low.surname[0].v:null;
  var one=low.player&&low.player.length===1&&low.player[0].c>=70?low.player[0].v:null;
  if(one){ var on=okName(one); return on?{v:on,why:'The only name the reader found on this card.'}:null; }
  /* a surname with nothing else: try to complete it */
  var lastN=sn?norm(sn):'';
  if(!lastN){ /* closer-look names: one clear candidate that two reads agree on */
    var good=names.filter(function(n){return n.n>=2&&n.srcs>=2&&n.fn>=1}); if(good.length===1&&!names.some(function(n){return n!==good[0]&&n.n>=good[0].n})){ var g=good[0], pg=parts(g.name); if(pg.last.length>=5){ var m=snap(pg.first,pg.last,c,g.name+(g.jr||'')); if(m) return m; } }
    return null;
  }
  var firsts=[]; names.forEach(function(n){ if(n.n>=2){ var pn=parts(n.name); if(pn.first&&lev(pn.last,lastN)<=2&&D.isFirstName&&D.isFirstName(pn.first)&&firsts.indexOf(pn.first)<0) firsts.push(pn.first); } });
  var r=snap(firsts.length===1?firsts[0]:'',lastN,c,'',sn); if(r) return r;
  return {v:sn,why:'Only the last name was readable. Add the first name.',surname:true};
}
/* find the full name for a (first,last) read in the catalog, then the bundled list. first may be '' */
function snap(first,last,c,asRead,pretty){
  var cand=[]; function add(nm,src,url,why){ var p=parts(nm); if(p.last===last){ if(!first||p.first===first||lev(p.first,first)<=1){ if(!cand.some(function(x){return norm(x.nm)===norm(nm)})) cand.push({nm:nm,src:src,url:url,why:why}); } } }
  catalog().forEach(function(e){ add(e.player,'cat','','Matches a card you saved before.'); });
  index(); var keys=Object.keys(IDX.byLast).filter(function(k){return k===last});
  keys.forEach(function(k){ IDX.byLast[k].forEach(function(e){ if(!c.sport||!c.sportOk||e.sport===c.sport) add(e.name,'wd',wdUrl(e.q),'Matches the bundled list of players (public Wikidata facts).'); }); });
  if(cand.length===1) return {v:cand[0].nm,why:(first?'Last name and first name were read; ':'Last name was read; ')+cand[0].why,url:cand[0].url};
  return null;
}
function run(c,ctx,opts){
  ctx=ctx||{}; opts=opts||{}; c.guess=c.guess||{}; var any=0, ch=[];
  function S(k,v,why,url){ if(set(c,k,v,why,url)){ any++; ch.push(k); return true; } return false; }
  /* player */
  if(!c.player&&!opts.noRead){ var nm=nameFromRead(c,ctx); if(nm) S('player',nm.v,nm.why,nm.url); }
  if(c.player&&c.guess.player&&!opts.noRead){ /* "Fernando Tatis" -> "Fernando Tatis Jr." when the list has exactly that person */
    var pp=parts(c.player); if(pp.n>=2&&!pp.suf){ var L=(index().byLast[pp.last]||[]).filter(function(e){ return e.p.first===pp.first&&e.p.suf; }); if(L.length===1&&!(index().byKey[pp.key]||[]).length){ c.player=L[0].name; c.why=c.why||{}; c.why.player={t:'Matched the bundled list (public Wikidata facts), which has the Jr.',u:wdUrl(L[0].q)}; any++; ch.push('player'); } } }
  /* brand, serial: only a lone, confident candidate, never the bare maker name */
  var low=ctx.low||{};
  if(!c.brand&&low.brand&&low.brand.length===1&&low.brand[0].c>=85&&/\s/.test(low.brand[0].v)) S('brand',low.brand[0].v,'The only set name the reader found.');
  if(!c.serial&&!c.noSerial&&low.serial&&low.serial.length===1&&low.serial[0].c>=80) S('serial',low.serial[0].v,'The only print-run number the reader found.');
  /* sport from what is known */
  if(!c.sportOk&&!c.guess.sport){ var ev=sportEvidence(c,ctx); if(ev&&ev.sport){ var was=c.sport; c.sport=ev.sport; c.guess.sport=1; c.why=c.why||{}; c.why.sport={t:'Because '+ev.why+'.',u:''}; any++; ch.push('sport'); } }
  /* team from the player */
  if(!c.team&&c.player&&!(c.noAuto&&c.noAuto.team)){ var opts2=teamOptions(c); if(opts2&&opts2.length===1&&opts2[0].src==='cat'){ if(S('team',opts2[0].team,opts2[0].why,opts2[0].url)){ var ts=teamSport(c.team); if(ts&&!c.sportOk&&c.sport!==ts){ c.sport=ts; c.guess.sport=1; c.why.sport={t:'Because the team is '+c.team+'.',u:''}; } } } }
  return {n:any,fields:ch};
}
/* ---- the optional online lookup. Sends the player's name text only, from this page to wikidata.org. ---- */
var API='https://www.wikidata.org/w/api.php';
function jget(params){ var u=API+'?format=json&origin=*&'+Object.keys(params).map(function(k){return k+'='+encodeURIComponent(params[k])}).join('&'); return fetch(u,{credentials:'omit',referrerPolicy:'no-referrer'}).then(function(r){ if(!r.ok) throw new Error('http'); return r.json(); }); }
function lookup(name){
  var p=parts(name); if(p.n<2) return Promise.resolve(null);
  return jget({action:'wbsearchentities',search:name,language:'en',type:'item',limit:'8'}).then(function(j){
    var ids=(j.search||[]).filter(function(x){ return norm(x.label)===p.key||norm(x.label).replace(/ (jr|sr|ii|iii)$/,'')===p.key.replace(/ (jr|sr|ii|iii)$/,''); }).map(function(x){return x.id});
    if(!ids.length) return null;
    return jget({action:'wbgetentities',ids:ids.join('|'),props:'claims|descriptions',languages:'en'}).then(function(e){
      var hits=[]; ids.forEach(function(id){ var en=e.entities&&e.entities[id]; if(!en) return; var d=((en.descriptions&&en.descriptions.en&&en.descriptions.en.value)||'').toLowerCase();
        var sp=/baseball/.test(d)?'Baseball':/american football|football player|nfl/.test(d)?'Football':/basketball|nba/.test(d)?'Basketball':''; if(!sp) return;
        var cl=(en.claims&&en.claims.P54)||[], cur=[]; cl.forEach(function(s){ var q=s.qualifiers||{}; if(q.P582) return; var v=s.mainsnak&&s.mainsnak.datavalue&&s.mainsnak.datavalue.value; if(v&&v.id) cur.push(v.id); });
        hits.push({id:id,sport:sp,teams:cur}); });
      if(hits.length!==1) return null;   /* two people with this name, or none that is a player: stay blank */
      var h=hits[0]; if(!h.teams.length) return {id:h.id,sport:h.sport,teams:[]};
      return jget({action:'wbgetentities',ids:h.teams.join('|'),props:'labels',languages:'en'}).then(function(t){ var out=[]; h.teams.forEach(function(id){ var l=t.entities&&t.entities[id]&&t.entities[id].labels&&t.entities[id].labels.en&&t.entities[id].labels.en.value; if(l){ var ok=(D.TEAMS||[]).filter(function(x){return x.full===l||(l==='Athletics'&&x.nick==='ATHLETICS')}); if(ok.length) out.push(ok[0].full); } });
        return {id:h.id,sport:h.sport,teams:out.filter(function(x,i){return out.indexOf(x)===i})}; });
    });
  });
}
window.CardAuto={okName:okName,run:run,askSport:askSport,sportEvidence:sportEvidence,teamOptions:teamOptions,lookup:lookup,wdUrl:wdUrl,parts:parts,norm:norm,index:index,teamSport:teamSport,SPORTS:['Baseball','Football','Basketball']};
if(typeof module!=='undefined'&&module.exports) module.exports=window.CardAuto;
})();
