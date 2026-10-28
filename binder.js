/* Collectors Desk v0.10.4 (Mr. Moose Enterprises, LLC) - Binder (all data stays on this phone, in IndexedDB) */
(function(){
'use strict';
var $=function(id){return document.getElementById(id)};
function MC(){return window.MC||{log:function(){},toast:function(){},show:function(){},askDlg:function(){},closeDlg:function(){}}}
function log(m){try{MC().log(m)}catch(e){}}
var PHNOTE='Placeholder, not a price. Prices are information only, never a promise.';
var MLB=['Arizona Diamondbacks','Atlanta Braves','Baltimore Orioles','Boston Red Sox','Chicago Cubs','Chicago White Sox','Cincinnati Reds','Cleveland Guardians','Colorado Rockies','Detroit Tigers','Houston Astros','Kansas City Royals','Los Angeles Angels','Los Angeles Dodgers','Miami Marlins','Milwaukee Brewers','Minnesota Twins','New York Mets','New York Yankees','Oakland Athletics','Philadelphia Phillies','Pittsburgh Pirates','San Diego Padres','San Francisco Giants','Seattle Mariners','St. Louis Cardinals','Tampa Bay Rays','Texas Rangers','Toronto Blue Jays','Washington Nationals'];
var NFL=['Arizona Cardinals','Atlanta Falcons','Baltimore Ravens','Buffalo Bills','Carolina Panthers','Chicago Bears','Cincinnati Bengals','Cleveland Browns','Dallas Cowboys','Denver Broncos','Detroit Lions','Green Bay Packers','Houston Texans','Indianapolis Colts','Jacksonville Jaguars','Kansas City Chiefs','Las Vegas Raiders','Los Angeles Chargers','Los Angeles Rams','Miami Dolphins','Minnesota Vikings','New England Patriots','New Orleans Saints','New York Giants','New York Jets','Philadelphia Eagles','Pittsburgh Steelers','San Francisco 49ers','Seattle Seahawks','Tampa Bay Buccaneers','Tennessee Titans','Washington Commanders'];
var NBA=['Atlanta Hawks','Boston Celtics','Brooklyn Nets','Charlotte Hornets','Chicago Bulls','Cleveland Cavaliers','Dallas Mavericks','Denver Nuggets','Detroit Pistons','Golden State Warriors','Houston Rockets','Indiana Pacers','Los Angeles Clippers','Los Angeles Lakers','Memphis Grizzlies','Miami Heat','Milwaukee Bucks','Minnesota Timberwolves','New Orleans Pelicans','New York Knicks','Oklahoma City Thunder','Orlando Magic','Philadelphia 76ers','Phoenix Suns','Portland Trail Blazers','Sacramento Kings','San Antonio Spurs','Toronto Raptors','Utah Jazz','Washington Wizards'];
var SPORTS=['Baseball','Football','Basketball','Other'];   /* sports cards first; Pokemon etc. can be added later as more sports */
var TEAMS_BY={Baseball:MLB,Football:NFL,Basketball:NBA};
var TEAMS=[].concat(MLB,NFL,NBA);
function teamsFor(sp){ return TEAMS_BY[sp]||TEAMS; }
var NICK={}; TEAMS.forEach(function(t){ var p=t.split(' '), k=p[p.length-1].toLowerCase(); if(/^(sox|jays|blazers)$/.test(k)) k=p.slice(-2).join(' ').toLowerCase(); (NICK[k]=NICK[k]||[]).push(t); });
NICK['d-backs']=['Arizona Diamondbacks']; NICK.indians=['Cleveland Guardians']; NICK.expos=['Washington Nationals']; NICK.sixers=['Philadelphia 76ers'];
var GRADERS=['PSA','BGS','SGC','CGC','Other'];
var B={db:null,ready:false,cards:[],binders:[],gone:{},trash:{},view:{id:'all',pick:null},sel:{},selMode:false,q:Promise.resolve(),tab:'h',saveT:{}};
var urlMap=(window.WeakMap?new WeakMap():null);
function urlOf(b){ if(!b) return ''; if(urlMap){ var u=urlMap.get(b); if(!u){u=URL.createObjectURL(b);urlMap.set(b,u);} return u; } return URL.createObjectURL(b); }
function G(id){ return document.getElementById(id); }
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function rid(p){return (p||'c')+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function num(v){ if(v===''||v==null) return ''; var n=parseFloat(String(v).replace(/[$,\s]/g,'')); return isFinite(n)?n:''; }
function money(n){ if(n===''||n==null||!isFinite(n)) return '—'; var neg=n<0; n=Math.abs(n); return (neg?'-':'')+'$'+(Math.round(n*100)%100===0?n.toFixed(0):n.toFixed(2)); }
function lsGet(k,d){ try{ var v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(e){ return d; } }
function lsSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
var LAST=lsGet('mc-last',{});
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}

/* ---------- storage ---------- */
function openDB(){
  return new Promise(function(res){
    try{
      if(!window.indexedDB) return res(null);
      var r=indexedDB.open('moose-binder-v07',1);
      r.onupgradeneeded=function(){ var d=r.result; d.createObjectStore('cards',{keyPath:'id'}); d.createObjectStore('binders',{keyPath:'id'}); d.createObjectStore('gone',{keyPath:'id'}); };
      r.onsuccess=function(){res(r.result)}; r.onerror=r.onblocked=function(){res(null)};
    }catch(e){res(null)}
  });
}
function getAll(st){ return new Promise(function(res){ if(!B.db) return res([]); try{ var q=B.db.transaction(st,'readonly').objectStore(st).getAll(); q.onsuccess=function(){res(q.result||[])}; q.onerror=function(){res([])}; }catch(e){res([])} }); }
function put(st,o){ return new Promise(function(res){ if(!B.db) return res(false); try{ var tx=B.db.transaction(st,'readwrite'); tx.objectStore(st).put(o); tx.oncomplete=function(){res(true)}; tx.onerror=tx.onabort=function(){res(false)}; }catch(e){res(false)} }); }
function del(st,id){ return new Promise(function(res){ if(!B.db) return res(false); try{ var tx=B.db.transaction(st,'readwrite'); tx.objectStore(st).delete(id); tx.oncomplete=function(){res(true)}; tx.onerror=tx.onabort=function(){res(false)}; }catch(e){res(false)} }); }
function saveCard(c){ clearTimeout(B.saveT[c.id]); c.upd=Date.now(); B.saveT[c.id]=setTimeout(function(){ delete B.saveT[c.id]; put('cards',c); },350); }
function flush(){ Object.keys(B.saveT).forEach(function(id){ clearTimeout(B.saveT[id]); delete B.saveT[id]; var c=byId(id); if(c) put('cards',c); }); }
function saveBinder(b){ return put('binders',b); }
function byId(id){ for(var i=0;i<B.cards.length;i++) if(B.cards[i].id===id) return B.cards[i]; return null; }
function binderById(id){ for(var i=0;i<B.binders.length;i++) if(B.binders[i].id===id) return B.binders[i]; return null; }
function newCard(id){ return {id:id,ts:Date.now(),upd:0,sid:'',snum:0,idx:0,fu:'',bu:'',player:'',team:'',year:'',brand:'',number:'',parallel:'',cond:'raw',grader:'',grade:'',status:'owned',cost:'',sold:'',notes:'',label:'',tags:[],pv:'',front:null,back:null,thumb:null,fsize:0,bsize:0,photos:[],edited:false,named:false,sport:LAST.sport||'Baseball',serial:'',rookie:false,auto:false,relic:false,cert:'',condNotes:'',flaws:[],flawText:'',price:'',ls:{title:'',titleEdited:false,desc:'',descEdited:false},guess:{},clean:{},cthumb:null}; }
function normCard(c){ if(!c.tags)c.tags=[]; if(!c.photos)c.photos=[]; if(!c.sport)c.sport='Baseball'; ['serial','cert','condNotes','flawText','price'].forEach(function(k){ if(c[k]==null)c[k]=''; }); ['rookie','auto','relic'].forEach(function(k){ if(c[k]==null)c[k]=false; }); if(!c.flaws)c.flaws=[]; if(!c.ls)c.ls={title:'',titleEdited:false,desc:'',descEdited:false}; if(!c.guess)c.guess={}; if(!c.clean)c.clean={}; if(c.cthumb===undefined)c.cthumb=null; return c; }
B.init=async function(){
  B.db=await openDB();
  var cs=await getAll('cards'), bs=await getAll('binders'), gs=await getAll('gone');
  var gm={}; gs.forEach(function(g){B.gone[g.id]=1; if(g.trash) gm[g.id]=g;});
  B.binders=bs.sort(function(a,b){return a.ts-b.ts});
  B.cards=cs.filter(function(c){ var g=gm[c.id]; if(g){ B.trash[c.id]={ts:g.trash,mem:g.mem||[],c:c}; return false; } return true; });
  Object.keys(gm).forEach(function(id){ if(!B.trash[id]) put('gone',{id:id}); });   // a Recently-deleted note with no card left: keep only the "don't re-add" mark
  B.cards.forEach(normCard); Object.keys(B.trash).forEach(function(id){ normCard(B.trash[id].c); });
  B.ready=true; try{ askPersist(); }catch(e){} log('binder ready: '+B.cards.length+' cards, '+B.binders.length+' binders, db '+(B.db?'ok':'MISSING'));
  return B.cards.length;
};
B.hasDB=function(){return !!B.db};
B.count=function(){return B.cards.length};
function thumb(blob,w){
  w=w||320;
  return new Promise(function(res){
    var u=URL.createObjectURL(blob), im=new Image();
    im.onload=function(){ try{ var s=Math.min(1,w/im.naturalWidth), c=document.createElement('canvas'); c.width=Math.max(1,Math.round(im.naturalWidth*s)); c.height=Math.max(1,Math.round(im.naturalHeight*s)); c.getContext('2d').drawImage(im,0,0,c.width,c.height); URL.revokeObjectURL(u); c.toBlob(function(b){res(b||null)},'image/jpeg',.8); }catch(e){ URL.revokeObjectURL(u); res(null); } };
    im.onerror=function(){ URL.revokeObjectURL(u); res(null); };
    im.src=u;
  });
}

/* ---------- scan sessions -> binder (also migrates v0.5/v0.6 scans) ---------- */
B.syncSession=function(s){
  B.q=B.q.then(function(){return doSync(s)}).catch(function(e){ log('sync error: '+(e&&e.message||e)); return 0; });
  return B.q;
};
async function doSync(s){
  if(!s||!B.ready) return 0;
  var all=s.fronts.concat(s.backs); if(!all.length) return 0;
  if(!all.every(function(x){return !x||x.blob})) return 0;
  MC().ensureUids(s);
  var n=Math.max(s.fronts.length,s.backs.length), seen={}, added=0, base=Date.now(), i;
  for(i=0;i<n;i++){
    var f=s.fronts[i], b=s.backs[i]; if(!f&&!b) continue;
    var id=f?f.uid:('b'+b.uid); seen[id]=1;
    if(B.gone[id]) continue;
    var c=byId(id), isNew=false, upd=false;
    if(!c){ c=newCard(id); c.ts=base; c.cond=s.mode==='graded'?'graded':'raw'; c.label=(f&&f.label)||''; B.cards.push(c); isNew=true; added++; }
    if(c.idx!==i||c.sid!==s.id||c.snum!==s.num){ c.idx=i; c.sid=s.id; c.snum=s.num; upd=true; }
    c.fu=f?f.uid:''; c.bu=b?b.uid:'';
    if(f&&f.blob&&c.fsize!==f.blob.size){ c.front=f.blob; c.fsize=f.blob.size; c.thumb=await thumb(f.blob); if(c.clean&&c.clean.front){ delete c.clean.front; c.cthumb=null; } upd=true; }
    if(b&&b.blob&&c.bsize!==b.blob.size){ c.back=b.blob; c.bsize=b.blob.size; if(!c.front) c.thumb=await thumb(b.blob); if(c.clean&&c.clean.back){ delete c.clean.back; if(!c.front) c.cthumb=null; } upd=true; }
    if(!c.thumb&&(c.front||c.back)){ c.thumb=await thumb(c.front||c.back); upd=true; }
    if(upd&&!isNew) c.upd=Date.now();
    if(isNew||upd) await put('cards',c);
  }
  // photos removed in the scan review (and never named or edited) leave the binder too
  var gone=B.cards.filter(function(c){return c.sid===s.id&&!seen[c.id]&&!c.edited&&!c.named});
  for(i=0;i<gone.length;i++) await removeCard(gone[i],false);
  if(added){ log('binder: +'+added+' cards from section '+s.num); askPersist(); B.noteScan(added); }
  return added;
}
B.setLabelByUid=function(uid,label){ var c=byId(uid); if(c){ c.label=label||''; saveCard(c); } };
async function removeCard(c,tomb){
  B.cards=B.cards.filter(function(x){return x!==c});
  for(var i=0;i<B.binders.length;i++){ var b=B.binders[i], k=b.ids.indexOf(c.id); if(k>=0){ b.ids.splice(k,1); await saveBinder(b); } }
  await del('cards',c.id);
  if(tomb!==false){ B.gone[c.id]=1; await put('gone',{id:c.id}); }
}

/* ---------- v0.10.2: Recently deleted (soft delete, kept 30 days; the photos' storage is freed only when it purges) ----------
   A deleted card is only marked: its record and photos stay in the 'cards' store untouched, and a small note in the 'gone' store
   says "deleted at <time>, was in these binders". So deleting 30 cards is instant (one tiny write), and Undo / Restore just remove the note. */
var TRASH_MS=30*864e5;
function plural(n,w){ return n+' '+w+(n===1?'':'s'); }
function batch(ops){ return new Promise(function(res){ if(!B.db||!ops.length) return res(false); try{ var tx=B.db.transaction(['cards','binders','gone'],'readwrite'); ops.forEach(function(o){ var s=tx.objectStore(o[1]); if(o[0]==='put') s.put(o[2]); else s.delete(o[2]); }); tx.oncomplete=function(){res(true)}; tx.onerror=tx.onabort=function(){res(false)}; }catch(e){res(false)} }); }
function trashList(){ return Object.keys(B.trash).map(function(k){return B.trash[k]}).sort(function(a,b){return b.ts-a.ts}); }
function daysLeft(t){ return Math.max(0,Math.ceil((t.ts+TRASH_MS-Date.now())/864e5)); }
function cardBytes(c){ var n=0; ['front','back','thumb','cthumb'].forEach(function(k){ if(c[k]&&c[k].size) n+=c[k].size; }); (c.photos||[]).forEach(function(p){ if(p.blob) n+=p.blob.size||0; if(p.thumb) n+=p.thumb.size||0; }); ['front','back'].forEach(function(k){ if(c.clean&&c.clean[k]&&c.clean[k].blob) n+=c.clean[k].blob.size||0; }); return n; }
function trashCards(ids){
  flush();
  var now=Date.now(), set={}, out=[], ops=[], mem={}, tb=[];
  ids.forEach(function(id){ if(set[id]) return; var c=byId(id); if(c){ set[id]=c; out.push(id); } });
  if(!out.length) return [];
  B.binders.forEach(function(b){ var keep=[], ch=false; b.ids.forEach(function(id){ if(set[id]){ (mem[id]=mem[id]||[]).push(b.id); ch=true; } else keep.push(id); }); if(ch){ b.ids=keep; tb.push(b); } });
  B.cards=B.cards.filter(function(c){ return !set[c.id]; });
  out.forEach(function(id){ B.trash[id]={ts:now,mem:mem[id]||[],c:set[id]}; B.gone[id]=1; ops.push(['put','gone',{id:id,trash:now,mem:mem[id]||[]}]); });
  tb.forEach(function(b){ ops.push(['put','binders',b]); });
  B.pend=batch(ops);
  return out;
}
function restoreTrash(ids){
  var ops=[], tb={}, n=0;
  ids.forEach(function(id){ var t=B.trash[id]; if(!t) return; delete B.trash[id]; delete B.gone[id]; if(!byId(id)) B.cards.push(t.c); n++;
    t.mem.forEach(function(bid){ var b=binderById(bid); if(b&&b.ids.indexOf(id)<0){ b.ids.push(id); tb[b.id]=b; } });
    ops.push(['delete','gone',id]); });
  Object.keys(tb).forEach(function(k){ ops.push(['put','binders',tb[k]]); });
  B.pend=batch(ops); return n;
}
function revokeCard(c){ if(!urlMap) return; var l=[c.front,c.back,c.thumb,c.cthumb]; (c.photos||[]).forEach(function(p){ l.push(p.blob,p.thumb); }); ['front','back'].forEach(function(k){ if(c.clean&&c.clean[k]) l.push(c.clean[k].blob); }); l.forEach(function(b){ if(b){ var u=urlMap.get(b); if(u){ try{URL.revokeObjectURL(u)}catch(e){} urlMap.delete(b); } } }); }
function purgeTrash(ids){
  var ops=[], freed=0, gone=[];
  ids.forEach(function(id){ var t=B.trash[id]; if(!t) return; freed+=cardBytes(t.c); clearTimeout(B.saveT[id]); delete B.saveT[id]; delete B.trash[id]; revokeCard(t.c); ops.push(['delete','cards',id]); ops.push(['put','gone',{id:id}]); gone.push(id); });
  B.pend=batch(ops);
  var f2=0; try{ f2=MC().dropScanPhotos(gone)||0; }catch(e){ log('scan photo cleanup: '+e); }
  return {n:gone.length,freed:freed+f2};
}
function purgeExpired(){ var old=Object.keys(B.trash).filter(function(id){ return B.trash[id].ts+TRASH_MS<Date.now(); }); if(old.length){ var r=purgeTrash(old); log('recently deleted: removed '+r.n+' cards older than 30 days, freed '+mbs(r.freed)); } }
B.purgeExpired=purgeExpired;

/* ---------- Protect my binder: storage permission, backup status, nudges (v0.9) ---------- */
var HONEST='Your binder is stored on this device and browser. If you clear browser data, delete the app, or lose the device, it\u2019s erased unless you\u2019ve saved a backup.';
var WHATS_IN='Includes every card: original photos, cleaned photos, names, notes and binders. Spreadsheet and listing exports are separate and don\u2019t replace a backup.';
B.persist='unknown';
function askPersist(force){
  try{
    if(!(navigator.storage&&navigator.storage.persist)){ B.persist='unsupported'; return; }
    if(!force&&lsGet('mc-persist-asked',false)){ persistStatus().then(function(s){ B.persist=s; refreshProt(); }); return; }
    lsSet('mc-persist-asked',true);
    navigator.storage.persist().then(function(ok){ B.persist=ok?'on':'off'; log('storage.persist -> '+ok); refreshProt(); if(force) MC().toast(ok?'Done. Your browser will keep this binder safe from automatic clean-ups.':'Your browser said not now. That\u2019s okay. A saved backup is your safety net.',3600); },function(){ B.persist='off'; refreshProt(); });
  }catch(e){}
}
function persistStatus(){
  return new Promise(function(res){
    try{ if(!(navigator.storage&&navigator.storage.persisted)) return res('unsupported'); navigator.storage.persisted().then(function(p){res(p?'on':'off')},function(){res('unsupported')}); }catch(e){res('unsupported')}
  });
}
function persistWords(){
  if(B.persist==='on') return 'Protected from automatic clean-ups \u2713 (your browser agreed to keep it)';
  if(B.persist==='off') return 'Not granted. Your browser may clear it if the device runs low on space. A backup covers you';
  if(B.persist==='unsupported') return 'Not available in this browser. A backup is the way to keep your binder safe';
  return 'Checking\u2026';
}
function lastBackup(){ return lsGet('mc-lastexport',0); }
function unsavedCount(){ var t=lastBackup(); return B.cards.filter(function(c){ return Math.max(c.ts||0,c.upd||0)>t; }).length; }
/* green = everything is in your last backup. yellow = a few new/changed cards. red = never backed up, over 7 days with changes, or 25+ unsaved */
function prot(){
  var n=B.cards.length, t=lastBackup(), u=unsavedCount(), age=t?(Date.now()-t):0, lvl, head, line;
  if(!n){ lvl='green'; head='Nothing to protect yet'; line='Scan some cards and this will keep watch for you.'; }
  else if(!t){ lvl='red'; head='Not backed up yet'; line='One tap saves a copy you can keep in Files, Drive or email.'; }
  else if(u>=25||(u>0&&age>7*864e5)){ lvl='red'; head='Time for a backup'; line=u+' card'+(u===1?'':'s')+' not yet backed up.'; }
  else if(u>0){ lvl='yellow'; head='Mostly protected'; line=u+' card'+(u===1?'':'s')+' not yet backed up.'; }
  else { lvl='green'; head='Protected'; line='Every card is in your latest backup.'; }
  return {n:n,last:t,unsaved:u,lvl:lvl,head:head,line:line,due:n>0&&(!t||u>=25||(u>0&&age>7*864e5))};
}
function when(t){
  if(!t) return 'Never';
  var d=new Date(t), now=new Date(), tm=d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
  var dd=Math.round((new Date(now.getFullYear(),now.getMonth(),now.getDate())-new Date(d.getFullYear(),d.getMonth(),d.getDate()))/864e5);
  if(dd===0) return 'Today, '+tm; if(dd===1) return 'Yesterday, '+tm;
  return d.toLocaleDateString([], {month:'short',day:'numeric',year:d.getFullYear()===now.getFullYear()?undefined:'numeric'})+', '+tm;
}
function protectHTML(attr,full){
  var p=prot();
  var h='<div class="prot '+p.lvl+'" id="protCard"><div class="pt"><i class="dot"></i><b>Protect my binder</b><span class="pstate">'+(p.lvl==='green'?'Green':p.lvl==='yellow'?'Yellow':'Red')+' \u00b7 '+esc(p.head)+'</span></div>';
  h+='<div class="pl">Last backed up: <b>'+esc(when(p.last))+'</b></div>';
  h+='<div class="pl"><b>'+p.unsaved+'</b> card'+(p.unsaved===1?'':'s')+' not yet backed up'+(p.n&&!p.last?' (all of them)':'')+'</div>';
  h+='<div class="pl small">Browser storage: '+esc(persistWords())+'</div>';
  h+='<button class="'+(p.lvl==='green'?'ghost-btn':'gold-btn')+' psave" '+attr+'="savebk">Save backup</button>';
  h+='<div class="pl small">'+esc(WHATS_IN)+'</div>';
  if(full) h+='<p class="honest">'+esc(HONEST)+'</p>';
  else h+='<details class="pdet"><summary>Where is my binder stored?</summary><p class="honest">'+esc(HONEST)+'</p></details>';
  return h+'</div>';
}
function refreshProt(){
  var e=$('protCard'); if(e&&B.tab==='h') renderHomeTab(); else if(e&&B.tab==='d') renderBackup();
  var db=$('tabs').querySelector('[data-t="d"]'); if(db){ var p=prot(); db.classList.toggle('alert',p.lvl==='red'&&p.n>0); }
}
/* nudges: after a scan ("N new cards") and when overdue. Dismissible, never blocking. */
function nudgeState(){ return lsGet('mc-nudge',{newN:0,newTs:0,snooze:0}); }
B.noteScan=function(added){ if(!added) return; var s=nudgeState(); s.newN=(s.newN||0)+added; s.newTs=Date.now(); s.snooze=0; lsSet('mc-nudge',s); };
function nudgeHTML(attr){
  var p=prot(), s=nudgeState(); if(!p.n) return '';
  var newN=Math.min(s.newN||0,p.unsaved);
  if(s.newN&&!p.unsaved){ s.newN=0; lsSet('mc-nudge',s); newN=0; }
  var msg='', k='';
  if(newN>0){ msg='Save a backup of your '+newN+' new card'+(newN===1?'':'s')+'?'; k='new'; }
  else if(p.due&&Date.now()>(s.snooze||0)){ msg=!p.last?'Your binder has no backup yet. Save one?':'It\u2019s been a while. Save a backup of your '+p.unsaved+' unsaved card'+(p.unsaved===1?'':'s')+'?'; k='due'; }
  if(!msg) return '';
  return '<div class="nudge" data-k="'+k+'"><span>'+esc(msg)+'</span><button class="gold-btn" '+attr+'="savebk">Save backup</button><button class="linkb" '+attr+'="nudgeno" aria-label="Not now">Not now</button></div>';
}
function dismissNudge(){ var s=nudgeState(); if(s.newN) s.newN=0; s.snooze=Date.now()+864e5; lsSet('mc-nudge',s); }
B.nudgeHTML=nudgeHTML; B.dismissNudge=dismissNudge; B.saveBackup=function(){ exportJSON(); };

/* ---------- Home tabs ---------- */
function setTab(t){
  B.tab=t; $('home').classList.toggle('hometab',t==='h'); ['h','b','s','d'].forEach(function(k){ $('pane'+k.toUpperCase()).classList.toggle('on',k===t); });
  [].forEach.call($('tabs').children,function(b){ b.classList.toggle('on',b.dataset.t===t); });
  if(t==='h') renderHomeTab(); if(t==='b') renderBinders(); if(t==='d') renderBackup(); if(t==='s'&&window.MC&&MC().renderScans) MC().renderScans();
  var sc=$('homeScroll'); if(sc) sc.scrollTop=0;
}
B.tabTo=setTab;
function totals(list){
  var t={n:list.length,cost:0,pv:0,listed:0,sold:0,profit:0,soldNoCost:0,hasPv:false,onHand:0};
  list.forEach(function(c){
    var cost=c.cost===''?0:c.cost; t.cost+=cost; if(c.pv!==''){t.pv+=c.pv;t.hasPv=true;}
    if(c.status==='listed') t.listed++;
    if(c.status==='sold'){ t.sold++; if(c.sold!==''){ t.profit+=c.sold-cost; if(c.cost==='') t.soldNoCost++; } }
    else t.onHand+=cost;
  });
  return t;
}
function unnamedCount(){ return B.cards.filter(function(c){return !c.player||(c.guess&&c.guess.player)}).length; }
function renderBinders(){
  var h='', n=B.cards.length, un=unnamedCount();
  if(!B.db) h+='<div class="warnb">Heads up: this browser can\'t keep your Binder after you close the page. Export a backup before you leave.</div>';
  h+='<button class="ghost-btn" data-act="scan">Scan more cards</button>';
  if(un) h+='<button class="ghost-btn dbtn" data-act="name">Name your cards<small>'+un+' card'+(un===1?'':'s')+' still need a name. Quick, one at a time.</small></button>';
  var last=B.cards.slice().sort(cmpDate)[0];
  h+='<div class="lab">My Binders</div>';
  var ta=totals(B.cards);
  h+='<button class="brow" data-act="open" data-id="all"><div class="bi" style="'+(last?'background-image:url('+urlOf(last.thumb||last.front)+')':'')+'">'+(last?'':'📚')+'</div><div class="bm"><div class="t1">All cards</div><div class="t2">'+n+' card'+(n===1?'':'s')+(ta.hasPv?' · placeholder value '+money(ta.pv):'')+'</div></div><span class="go">›</span></button>';
  B.binders.forEach(function(b){
    var list=bCards(b), t=totals(list), first=list[0], inv=b.type==='inventory';
    var sub=list.length+' card'+(list.length===1?'':'s');
    if(inv) sub+=' · cost '+money(t.cost)+' · '+t.listed+' listed · '+t.sold+' sold';
    h+='<button class="brow" data-act="open" data-id="'+b.id+'"><div class="bi" style="'+(first?'background-image:url('+urlOf(first.thumb||first.front)+')':'')+'">'+(first?'':(inv?'🏷️':'📖'))+'</div><div class="bm"><div class="t1">'+esc(b.name)+'<span class="badge">'+(inv?'Inventory':'Collection')+'</span></div><div class="t2">'+sub+'</div></div><span class="go">›</span></button>';
  });
  h+='<button class="ghost-btn" data-act="newb" style="margin-top:4px">＋ New binder</button>';
  if(n>1) h+='<button class="ghost-btn dbtn" data-act="dups">Find duplicates<small>Compare every card on this device and clean up repeat scans.</small></button>';
  var tn=Object.keys(B.trash).length; if(tn) h+='<button class="brow" data-act="trash"><div class="bi">🗑️</div><div class="bm"><div class="t1">Recently deleted</div><div class="t2">'+plural(tn,'card')+' · restore any time for 30 days</div></div><span class="go">›</span></button>';
  if(!n) h+='<div class="big-empty">Your Binder is empty. Tap <b>Scan cards</b>. After each scan your cards land here, and you can name them one by one.</div>';
  else h+='<div class="pvnote">'+PHNOTE+' Everything is stored on this phone only.</div>';
  $('paneB').innerHTML=h;
}
B.renderHome=function(){ if(B.tab==='h') renderHomeTab(); else if(B.tab==='b') renderBinders(); else if(B.tab==='d') renderBackup(); refreshTabDot(); };
$('paneB').addEventListener('click',homeAct);
/* ---------- Home tab (v0.9): the showcase front screen ---------- */
function mainPhoto(c){ var cl=cleanOf(c,'front'); return urlOf((cl&&cl.blob)||c.front||c.back||c.thumb); }
function cardName(c){ var p=(c.player&&!(c.guess&&c.guess.player))?c.player:''; return p||('Card '+(c.idx+1)+(c.snum?' · section '+c.snum:'')); }
function featuredCards(){
  var named=B.cards.filter(function(c){return c.front||c.back});
  function score(c){ var s=0; if(c.player&&!(c.guess&&c.guess.player)) s+=2; if(c.label==='keep'||c.label==='grade') s+=2; if(c.auto||c.rookie||c.relic) s+=1; return s; }
  var feat=named.filter(function(c){return score(c)>=3}).sort(cmpDate).slice(0,4);
  var seen={}; feat.forEach(function(c){seen[c.id]=1});
  var rec=named.slice().sort(cmpDate).filter(function(c){return !seen[c.id]}).slice(0,8-feat.length);
  return feat.concat(rec);
}
function topOf(key,n){
  var m={}; B.cards.forEach(function(c){ var v=c[key]; if(!v||(c.guess&&c.guess[key])) return; m[v]=(m[v]||0)+1; });
  return Object.keys(m).map(function(k){return {k:k,n:m[k]}}).sort(function(a,b){return b.n-a.n||(a.k<b.k?-1:1)}).slice(0,n);
}
function todoList(){
  var p=prot(), un=unnamedCount(), noClean=B.cards.filter(function(c){return c.front&&!cleanOf(c,'front')}).length, chk=B.cards.filter(function(c){return c.guess&&Object.keys(c.guess).length}).length, out=[];
  if(p.n&&(p.lvl==='red'||p.lvl==='yellow')) out.push({id:'backup',pri:p.lvl==='red'?0:3,t:p.last?'Back up '+p.unsaved+' card'+(p.unsaved===1?'':'s'):'Back up your binder',d:p.last?'Last saved '+when(p.last)+'.':'Nothing saved yet. One tap, then you\u2019re covered.'});
  if(un) out.push({id:'name',pri:1,t:'Name '+un+' card'+(un===1?'':'s'),d:'I read each photo and fill in what I\u2019m sure of. You check it.'});
  if(noClean) out.push({id:'clean',pri:4,t:'Clean up '+noClean+' photo'+(noClean===1?'':'s'),d:'Straighten and even out the lighting. Originals are kept.'});
  if(!un&&chk) out.push({id:'check',pri:2,t:'Check '+chk+' card'+(chk===1?'':'s')+' marked \u201ccheck this\u201d',d:'Tap the badge on each field once it\u2019s right.'});
  out.sort(function(a,b){return a.pri-b.pri}); return out;
}
function renderHomeTab(){
  var n=B.cards.length, h='', p=prot();
  var nudge=nudgeHTML('data-act');
  h+='<div class="hhead"><span class="crest2">Collectors Desk</span></div>';
  if(!B.db) h+='<div class="warnb">Heads up: this browser can\u2019t keep your binder after you close the page. Save a backup before you leave.</div>';
  if(!n){
    h+='<div class="hero0"><div class="ring"><svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="12" y="6" width="34" height="48" rx="4" transform="rotate(-8 29 30)"/><rect x="20" y="10" width="34" height="48" rx="4"/><path d="M30 34l6 6 10-12" stroke-linecap="round" stroke-linejoin="round"/></svg></div>'+
      '<h2>Your cards, beautifully kept.</h2><p>Scan a row of cards with your phone. Collectors Desk finds each one, reads it, and files it in a private binder on this device.</p>'+
      '<button class="gold-btn bigscan" data-act="scan">Scan your first cards</button>'+
      '<ol class="how3"><li><b>1</b>Scan<small>Glide along a row</small></li><li><b>2</b>Name<small>Auto-filled, you check</small></li><li><b>3</b>Keep<small>Binder + backup</small></li></ol>'+
      '<button class="linkb" data-act="restore">Already have a backup? Restore it</button></div>';
    h+='<div class="pvnote" style="text-align:center">'+esc(HONEST)+'</div>';
    $('paneH').innerHTML=h; return;
  }
  h+=nudge;
  var fc=featuredCards();
  h+='<div class="hgrid"><div class="hcol1">';
  h+='<div class="lab2">Featured &amp; recent</div><div class="car" id="car"><button class="carb l" data-act="carl" aria-label="Previous">\u2039</button><div class="strip" id="carS">';
  fc.forEach(function(c,i){ var nm=cardName(c), sub=[c.year,c.brand].filter(Boolean).join(' \u00b7 '); var tags=(c.rookie?'<u>RC</u>':'')+(c.auto?'<u>Auto</u>':'')+(c.relic?'<u>Relic</u>':'');
    h+='<button class="slide" data-act="card" data-id="'+c.id+'"><span class="ph"><img src="'+mainPhoto(c)+'" alt="'+esc(nm)+'" '+(i>2?'loading="lazy"':'')+'></span><span class="cap"><b>'+esc(nm)+'</b>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</span>'+(tags?'<span class="tg">'+tags+'</span>':'')+'</button>'; });
  h+='</div><button class="carb r" data-act="carr" aria-label="Next">\u203a</button></div>';
  h+='<button class="gold-btn bigscan" data-act="scan">Scan cards</button>';
  h+='</div><div class="hcol2">';
  var td=todoList().filter(function(x){return !(nudge&&x.id==='backup')}), nx=td[0];
  if(nx){ h+='<div class="nextc"><small>Next step</small><div class="nt">'+esc(nx.t)+'</div><p>'+esc(nx.d)+'</p><button class="ghost-btn" data-act="todo" data-id="'+nx.id+'">Start \u203a</button></div>';
    var rest=td.slice(1); if(rest.length) h+='<div class="chips2">'+rest.map(function(x){return '<button class="chip" data-act="todo" data-id="'+x.id+'">'+esc(x.t)+'</button>'}).join('')+'</div>'; }
  else h+='<div class="nextc"><small>Next step</small><div class="nt">You\u2019re all caught up</div><p>Scan more cards whenever you\u2019re ready.</p></div>';
  var ta=totals(B.cards), tt=topOf('team',3), tp=topOf('player',3);
  h+='<div class="lab2">Your collection at a glance</div><div class="glance"><div class="gt"><b>'+n+'</b><small>card'+(n===1?'':'s')+'</small></div><div class="gt"><b>'+(B.binders.length+1)+'</b><small>binder'+(B.binders.length?'s':'')+'</small></div>'+(ta.hasPv?'<div class="gt"><b>'+money(ta.pv)+'</b><small>Placeholder, info only</small></div>':'')+'</div>';
  if(tt.length||tp.length){ h+='<div class="tops">'; if(tt.length) h+='<div><small>Top teams</small>'+tt.map(function(x){return '<span>'+esc(x.k)+' <i>'+x.n+'</i></span>'}).join('')+'</div>'; if(tp.length) h+='<div><small>Top players</small>'+tp.map(function(x){return '<span>'+esc(x.k)+' <i>'+x.n+'</i></span>'}).join('')+'</div>'; h+='</div>'; }
  else h+='<div class="pvnote">Name a few cards and your top teams and players show up here.</div>';
  var ls=B.cards.slice().sort(cmpDate)[0], le=B.cards.filter(function(c){return c.upd}).sort(function(a,b){return b.upd-a.upd})[0];
  var sc=ls?B.cards.filter(function(c){return c.sid===ls.sid}).length:0;
  h+='<div class="lab2">Recent activity</div><ul class="act"><li><span>Last scan</span><b>'+(ls?esc(when(ls.ts))+' \u00b7 '+sc+' card'+(sc===1?'':'s'):'None yet')+'</b></li><li><span>Last backup</span><b>'+esc(when(p.last))+'</b></li><li><span>Last edit</span><b>'+(le?esc(cardName(le))+' \u00b7 '+esc(when(le.upd)):'None yet')+'</b></li></ul>';
  h+=protectHTML('data-act',false);
  h+='</div></div>';
  h+='<div class="pvnote" style="text-align:center">'+PHNOTE+'</div>';
  $('paneH').innerHTML=h;
}
function carStep(d){ var s=$('carS'); if(!s) return; var w=(s.querySelector('.slide')||{offsetWidth:240}).offsetWidth+14; s.scrollBy({left:d*w,behavior:'smooth'}); }
function homeAct(e){
  var b=e.target.closest('[data-act]'); if(!b) return; var a=b.dataset.act;
  if(a==='scan') MC().startScan();
  else if(a==='open') B.openBinder(b.dataset.id);
  else if(a==='name') B.openName({});
  else if(a==='newb') newBinderDlg();
  else if(a==='dups') B.openDups('home');
  else if(a==='trash') B.openTrash('home');
  else if(a==='gobackup') setTab('d');
  else if(a==='card'){ var ids=featuredCards().map(function(c){return c.id}); B.openCard(b.dataset.id,ids); }
  else if(a==='carl') carStep(-1); else if(a==='carr') carStep(1);
  else if(a==='savebk') exportJSON();
  else if(a==='nudgeno'){ dismissNudge(); renderHomeTab(); }
  else if(a==='restore'){ setTab('d'); setTimeout(function(){ var f=$('impFile'); if(f) f.click(); },50); }
  else if(a==='todo'){ var id=b.dataset.id;
    if(id==='backup') exportJSON(); else if(id==='name') B.openName({}); else if(id==='clean'){ B.openBinder('all'); MC().toast('Tap “Clean up photos” near the top.',3200); } else if(id==='check'){ var c=B.cards.filter(function(c){return c.guess&&Object.keys(c.guess).length})[0]; if(c) B.openCard(c.id,B.cards.filter(function(c){return c.guess&&Object.keys(c.guess).length}).map(function(c){return c.id})); } }
}
$('paneH').addEventListener('click',homeAct);

$('tabs').addEventListener('click',function(e){ var b=e.target.closest('button'); if(b) setTab(b.dataset.t); });

/* ---------- small prompt ---------- */
function promptDlg(title,initial,okLabel,opts,cb){
  opts=opts||{};
  $('prT').textContent=title; var inp=$('prIn'); inp.value=initial||''; inp.placeholder=opts.ph||'';
  var tr=$('prType'); tr.style.display=opts.type?'flex':'none'; var ty=opts.typeVal||'collection';
  [].forEach.call(tr.children,function(x){ x.classList.toggle('on',x.dataset.v===ty); });
  tr.onclick=function(e){ var x=e.target.closest('button'); if(!x) return; ty=x.dataset.v; [].forEach.call(tr.children,function(y){y.classList.toggle('on',y===x)}); };
  $('prNote').textContent=opts.note||'';
  $('prOk').textContent=okLabel||'Save';
  $('prOk').onclick=function(){ var v=inp.value.trim(); if(!v){ inp.focus(); return; } $('pr').classList.remove('on'); cb(v,ty); };
  $('prNo').onclick=function(){ $('pr').classList.remove('on'); };
  inp.onkeydown=function(e){ if(e.key==='Enter') $('prOk').click(); };
  $('pr').classList.add('on'); setTimeout(function(){inp.focus();inp.select()},60);
}
function newBinderDlg(after){
  promptDlg('New binder','','Create',{ph:'e.g. Yankees, or Shop stock',type:true,note:'Collection = just organize. Inventory = also totals cost, listed, sold and profit.'},function(v,ty){
    var b={id:rid('b'),name:v,type:ty,ts:Date.now(),ids:[]}; B.binders.push(b); saveBinder(b).then(function(){ MC().toast('Binder created.'); if(after) after(b); else renderHome(); });
  });
}

/* ---------- binder view ---------- */
function cmpDate(a,b){ return (b.ts-a.ts)||((a.sid<b.sid)?-1:(a.sid>b.sid)?1:0)||(a.idx-b.idx); }
function bCards(b){ var out=[]; b.ids.forEach(function(id){ var c=byId(id); if(c) out.push(c); }); return out; }
function viewCards(){ var v=B.view; if(v.id==='all') return B.cards.slice(); var b=binderById(v.id); return b?bCards(b):[]; }
var SORTS=[['date','Date added'],['player','Player A–Z'],['team','Team A–Z'],['year','Year'],['value','Value (placeholder)']];
function cmpStr(a,b,k){ var x=(a[k]||'').toString(), y=(b[k]||'').toString(); if(!x&&!y) return 0; if(!x) return 1; if(!y) return -1; return x.localeCompare(y,undefined,{sensitivity:'base'}); }
function sortList(list,key){
  var f={date:cmpDate,
    player:function(a,b){return cmpStr(a,b,'player')||cmpDate(a,b)},
    team:function(a,b){return cmpStr(a,b,'team')||cmpStr(a,b,'player')||cmpDate(a,b)},
    year:function(a,b){var x=a.year===''?9999:a.year,y=b.year===''?9999:b.year; return (x-y)||cmpStr(a,b,'player')||cmpDate(a,b)},
    value:function(a,b){var x=a.pv===''?-1:a.pv,y=b.pv===''?-1:b.pv; return (y-x)||cmpDate(a,b)}}[key]||cmpDate;
  return list.sort(f);
}
function cardTitle(c){ return c.player||('Card '+((c.snum?'S'+c.snum+'·':'')+(c.idx+1))); }
function cardSub(c){ var t=[]; if(c.year) t.push(c.year); if(c.team) t.push(shortTeam(c.team)); else if(c.brand) t.push(c.brand); return t.join(' · ')||'tap to name'; }
function shortTeam(t){ var p=t.split(' '); if(p.length<2||TEAMS.indexOf(t)<0) return t; var l=p[p.length-1]; return /^(Sox|Jays|Blazers)$/.test(l)?p.slice(-2).join(' '):l; }
B.openBinder=function(id,opts){
  opts=opts||{}; flush();
  B.view={id:id,pick:opts.pick||null}; B.selMode=!!opts.pick; B.sel={}; B.q2='';
  $('bvSearch').value=''; MC().show('bv'); renderBV(); $('bvBody').scrollTop=0;
};
var curList=[];
function renderBV(){
  var v=B.view, bd=v.id==='all'?null:binderById(v.id);
  if(v.id!=='all'&&!bd){ B.goHome(); return; }
  var sortKey=lsGet('mc-sort','date'), q=($('bvSearch').value||'').trim().toLowerCase();
  $('bvSort').value=sortKey;
  var all=viewCards(), list=all;
  if(q) list=all.filter(function(c){ return [c.player,c.team,c.year,c.brand,c.number,c.parallel,c.notes,(c.tags||[]).join(' ')].join(' ').toLowerCase().indexOf(q)>=0; });
  list=sortList(list.slice(),sortKey); curList=list;
  var pick=v.pick?binderById(v.pick):null;
  $('bvTitle').textContent=pick?('Add to “'+pick.name+'”'):(bd?bd.name:'All cards');
  $('bvMenu').style.display=(bd&&!pick)?'inline-flex':'none';
  $('bvAdd').style.display=(bd&&!pick)?'inline-flex':'none';
  var t=totals(all), inv=bd&&bd.type==='inventory'&&!pick;
  $('bvSub').textContent=all.length+' card'+(all.length===1?'':'s')+(q?' · showing '+list.length:'')+(bd?(bd.type==='inventory'?' · Inventory binder':' · Collection'):'');
  var tot=$('bvTot'); tot.className=inv?'on':'';
  if(inv) tot.innerHTML='<div><b>'+money(t.cost)+'</b>cost paid</div><div><b>'+money(t.pv)+'</b>placeholder value*</div><div><b>'+t.listed+'</b>listed</div><div><b>'+t.sold+'</b>sold</div><div><b style="color:'+(t.profit<0?'#ff8a8a':'#8dffbd')+'">'+money(t.profit)+'</b>profit on sold</div><div><b>'+money(t.onHand)+'</b>cost not yet sold</div>';
  var h='', last=null;
  list.forEach(function(c){
    if(sortKey==='team'||sortKey==='year'){ var g=sortKey==='team'?(c.team||'No team yet'):(c.year!==''?String(c.year):'No year yet'); if(g!==last){ h+='<h3>'+esc(g)+'</h3>'; last=g; } }
    var on=!!B.sel[c.id], inB=pick&&pick.ids.indexOf(c.id)>=0;
    var tags='<span class="tg">'+(c.label?'<u class="'+c.label+'">'+c.label.toUpperCase()+'</u>':'')+(c.status!=='owned'?'<u class="'+c.status+'">'+c.status.toUpperCase()+'</u>':'')+'</span>';
    h+='<button class="bt'+(on?' on':'')+(inB?' dim':'')+'" data-id="'+c.id+'"><img src="'+urlOf((c.cthumb&&hasClean(c)?c.cthumb:null)||c.thumb||c.front||c.back)+'" alt="" loading="lazy">'+tags+(hasClean(c)?'<span class="cln-b">CLEANED</span>':'')+(sortKey==='value'&&c.pv!==''?'<span class="pvt">'+money(c.pv)+' ph</span>':'')+'<span class="ck">'+(on?'✓':'')+'</span><span class="cap"><b>'+esc(cardTitle(c))+'</b><i>'+esc(inB?'Already in binder':cardSub(c))+'</i></span></button>';
  });
  if(!list.length) h='<div class="big-empty" style="grid-column:1/-1">'+(q?'No cards match that search.':(bd?'This binder is empty. Tap <b>＋ Add cards</b> to pick cards from All cards.':'No cards yet. Scan some cards and they will land here.'))+'</div>';
  $('bvGrid').innerHTML=h; $('bvGrid').className=B.selMode?'sel':'';
  var anyPv=all.some(function(c){return c.pv!==''});
  $('bvNote').textContent=(anyPv||inv||sortKey==='value')?('*'+PHNOTE):'';
  $('bvSel').textContent=B.selMode&&!pick?'Done':'☑ Select'; $('bvSel').classList.toggle('on',B.selMode&&!pick); $('bvSel').style.display=pick?'none':'inline-flex';
  var dupb=$('bvDup'); dupb.style.display=(v.id==='all'&&!B.selMode&&!pick&&B.cards.length>1)?'block':'none';
  renderTools();
  var todo=cleanTodo(all), cb=$('bvClean'); cb.style.display=(!B.selMode&&!pick&&todo.length)?'block':'none'; cb.textContent='✨ Clean up photos ('+todo.length+')';
  renderBar();
}
function selIds(){ return Object.keys(B.sel).filter(function(k){return B.sel[k]}); }
function renderBar(){
  var bar=$('bvBar'), n=selIds().length, v=B.view, pick=v.pick?binderById(v.pick):null;
  document.body.classList.toggle('barOn',!!B.selMode);
  if(!B.selMode){ bar.className=''; $('bvBody').style.paddingBottom='24px'; return; }
  bar.className='on'; $('bvBody').style.paddingBottom='150px';
  var h='<div class="msg">'+(n?'<b>'+n+' selected</b>':'Tap cards to select them')+'</div>';
  if(pick){
    h+='<div class="r"><button class="ghost-btn" data-b="selall">Select all</button><button class="gold-btn" data-b="doadd"'+(n?'':' disabled')+'>Add '+(n||'')+' to binder</button></div><div class="r"><button class="ghost-btn" data-b="cancelpick">Cancel</button></div>';
  }else{
    h+='<div class="r"><button class="ghost-btn" data-b="cancel">Cancel</button><button class="ghost-btn" data-b="more"'+(n?'':' disabled')+'>More…</button><button class="del-btn" data-b="delc"'+(n?'':' disabled')+'>Delete'+(n?' '+n:'')+'</button></div>';
  }
  bar.innerHTML=h;
}
/* select tools: Select all, by scan or date, older duplicates, find duplicates */
function renderTools(){
  var el=$('bvTools'); if(!(B.selMode&&!B.view.pick)){ el.innerHTML=''; el.className=''; return; }
  var all=viewCards().length, n=selIds().length;
  el.className='on';
  el.innerHTML='<button class="chip" data-t="all">Select all '+curList.length+'</button><button class="chip" data-t="scan">By scan or date…</button><button class="chip" data-t="old">Older duplicates</button><button class="chip" data-t="dups">Find duplicates ›</button>'+(n?'<button class="chip" data-t="none">Clear</button>':'');
}
$('bvTools').addEventListener('click',function(e){
  var b=e.target.closest('[data-t]'); if(!b) return; var a=b.dataset.t;
  if(a==='all'){ curList.forEach(function(c){B.sel[c.id]=true}); renderBV(); }
  else if(a==='none'){ B.sel={}; renderBV(); }
  else if(a==='scan') selectByScan();
  else if(a==='old') selectOlderDups();
  else if(a==='dups') B.openDups();
});
$('bvDup').addEventListener('click',function(){ B.openDups(); });
$('bvGrid').addEventListener('click',function(e){
  var t=e.target.closest('.bt'); if(!t) return; var id=t.dataset.id;
  if(B.selMode){ B.sel[id]=!B.sel[id]; t.classList.toggle('on',!!B.sel[id]); t.querySelector('.ck').textContent=B.sel[id]?'✓':''; renderBar(); return; }
  B.openCard(id,curList.map(function(c){return c.id}));
});
$('bvSel').addEventListener('click',function(){ if(!B.selMode) hideUndo(); B.selMode=!B.selMode; B.sel={}; renderBV(); if(B.selMode) MC().toast('Tap cards to select them. Use the buttons above for Select all, scan or date, and repeats.',3600); });
$('bvSort').addEventListener('change',function(){ lsSet('mc-sort',$('bvSort').value); renderBV(); });
$('bvSearch').addEventListener('input',function(){ renderBV(); });
$('bvBack').addEventListener('click',function(){ B.goHome(); });
B.goHome=function(){ flush(); B.selMode=false; document.body.classList.remove('barOn'); MC().show('home'); setTab('h'); };
$('bvAdd').addEventListener('click',function(){ var id=B.view.id; B.openBinder('all',{pick:id}); });
$('bvMenu').addEventListener('click',function(){
  var bd=binderById(B.view.id); if(!bd) return;
  MC().askDlg(bd.name,'What would you like to do with this binder?',[
    {label:'Rename',cls:'gold',fn:function(){ setTimeout(function(){ promptDlg('Rename binder',bd.name,'Save',{},function(v){ bd.name=v; saveBinder(bd); renderBV(); MC().toast('Renamed.'); }); },50); }},
    {label:bd.type==='inventory'?'Make it a Collection binder':'Make it an Inventory binder',cls:'ghost',fn:function(){ bd.type=bd.type==='inventory'?'collection':'inventory'; saveBinder(bd); renderBV(); }},
    {label:'Delete binder',cls:'ghost',fn:function(){ setTimeout(function(){ MC().askDlg('Delete “'+bd.name+'”?','The cards stay in All cards. Only this binder is removed.',[{label:'Delete binder',cls:'ghost',fn:function(){ B.binders=B.binders.filter(function(x){return x!==bd}); del('binders',bd.id); B.goHome(); MC().toast('Binder deleted. Your cards are safe.'); }},{label:'Keep it',cls:'gold'}]); },50); }},
    {label:'Close',cls:'ghost'}]);
});
$('bvBar').addEventListener('click',function(e){
  var b=e.target.closest('button'); if(!b||b.disabled) return; var a=b.dataset.b, ids=selIds();
  if(a==='selall'){ curList.forEach(function(c){B.sel[c.id]=true}); renderBV(); }
  else if(a==='cancelpick'){ var pid=B.view.pick; B.openBinder(pid); }
  else if(a==='doadd'){ var pb=binderById(B.view.pick); addTo(pb,ids); MC().toast('Added '+ids.length+' to “'+pb.name+'”.'); B.openBinder(pb.id); }
  else if(a==='addto') pickBinder(ids,false);
  else if(a==='moveto') pickBinder(ids,true);
  else if(a==='rmfrom'){ var bd=binderById(B.view.id); bd.ids=bd.ids.filter(function(x){return ids.indexOf(x)<0}); saveBinder(bd); B.sel={}; renderBV(); MC().toast('Taken out of this binder. Still in All cards.'); }
  else if(a==='cancel'){ B.selMode=false; B.sel={}; renderBV(); }
  else if(a==='more'){ var bdm=B.view.id==='all'?null:binderById(B.view.id);
    MC().askDlg(ids.length+' selected','What would you like to do with them?',[{label:'Add to a binder…',cls:'gold',fn:function(){ setTimeout(function(){ pickBinder(ids,false); },50); }},{label:'Move to another binder…',cls:'gold',fn:function(){ setTimeout(function(){ pickBinder(ids,true); },50); }}].concat(bdm?[{label:'Take out of this binder (keeps the cards)',cls:'ghost',fn:function(){ bdm.ids=bdm.ids.filter(function(x){return ids.indexOf(x)<0}); saveBinder(bdm); B.sel={}; renderBV(); MC().toast('Taken out of this binder. Still in All cards.'); }}]:[]).concat([{label:'Close',cls:'ghost'}])); }
  else if(a==='delc') confirmDelete(ids,{});
});
function addTo(b,ids){ var n=0; ids.forEach(function(id){ if(b.ids.indexOf(id)<0){ b.ids.push(id); n++; var c=byId(id); if(c){c.edited=true;saveCard(c);} } }); saveBinder(b); return n; }
async function deleteCards(ids){ for(var i=0;i<ids.length;i++){ var c=byId(ids[i]); if(c) await removeCard(c,true); } }
function pickBinder(ids,move){
  var cur=B.view.id==='all'?null:binderById(B.view.id), btns=[];
  B.binders.forEach(function(b){ if(cur&&b===cur&&move) return; btns.push({label:b.name+' ('+b.ids.length+')',cls:'gold',fn:function(){
    addTo(b,ids); if(move&&cur){ cur.ids=cur.ids.filter(function(x){return ids.indexOf(x)<0}); saveBinder(cur); }
    B.sel={}; B.selMode=false; MC().toast((move?'Moved ':'Added ')+ids.length+' card'+(ids.length===1?'':'s')+' to “'+b.name+'”.'); renderBV(); if(B.cdOpen) renderCD(); }}); });
  btns.push({label:'＋ New binder…',cls:'ghost',fn:function(){ setTimeout(function(){ newBinderDlg(function(b){ addTo(b,ids); if(move&&cur){ cur.ids=cur.ids.filter(function(x){return ids.indexOf(x)<0}); saveBinder(cur); } B.sel={}; B.selMode=false; MC().toast((move?'Moved to ':'Added to ')+'“'+b.name+'”.'); if(B.cdOpen) renderCD(); else renderBV(); }); },50); }});
  btns.push({label:'Cancel',cls:'ghost'});
  MC().askDlg((move?'Move to which binder?':'Add to which binder?'),(move&&cur?'They leave “'+cur.name+'” and go into the one you pick.':'A card can be in as many binders as you like. It always stays in All cards.'),btns);
}

/* ---------- form builder (card detail + name flow) ---------- */
function histVals(key){ var m={}; B.cards.forEach(function(c){ var v=(c[key]==null?'':String(c[key])).trim(); if(v) m[v]=(m[v]||0)+1; }); return Object.keys(m).sort(function(a,b){return m[b]-m[a]}); }
function sugFor(key,typed,c){
  var t=(typed||'').trim().toLowerCase(), list=histVals(key), tf=teamsFor(c&&c.sport);
  if(key==='team'){ var rec=list.filter(function(x){return tf.indexOf(x)>=0||TEAMS.indexOf(x)<0}); list=rec.concat(tf.filter(function(x){return rec.indexOf(x)<0})); }
  if(!t) return key==='player'?[]:list.slice(0,5);
  var out=list.filter(function(x){ var l=x.toLowerCase(); return l!==t&&l.indexOf(t)>=0; });
  if(key==='team'&&out.length<6){ Object.keys(NICK).forEach(function(n){ if(n.indexOf(t)===0){ NICK[n].forEach(function(full){ if(tf.indexOf(full)>=0&&out.indexOf(full)<0) out.push(full); }); } }); }
  return out.slice(0,6);
}
var FDEF={
  player:['Player','text','e.g. Shohei Ohtani','player'],team:['Team','text','Start typing a team','team'],year:['Year','numeric','e.g. 2023'],
  brand:['Set / brand','text','e.g. Topps Chrome','brand'],number:['Card number','text','e.g. 27'],parallel:['Parallel','text','e.g. Gold /50','parallel'],
  serial:['Serial / print run','text','e.g. 12/99 (leave blank if none)'],cost:['Cost paid ($)','decimal','e.g. 5'],tags:['Tags (comma separated)','text','e.g. rookie, auto, numbered']
};
var GK={grader:'slab',grade:'slab',cert:'slab'};   /* which "check this" badge a field belongs to */
function cleanOf(c,side){ var k=c.clean&&c.clean[side]; return (k&&c[side]&&k.src===c[side].size)?k:null; }
function hasClean(c){ return !!(cleanOf(c,'front')||cleanOf(c,'back')); }
var CLRK=['player','team','year','brand','number','serial','parallel'];
function gbadge(c,k){ return (c.guess&&c.guess[k])?' <button type="button" class="chk" data-ck="'+k+'">check this</button>'+(CLRK.indexOf(k)>=0?'<button type="button" class="chk clr" data-cl="'+k+'" aria-label="Clear '+k+'">✕ clear</button>':''):''; }
function whyHtml(c,k){ var w=c.why&&c.why[k]; if(!(c.guess&&c.guess[k])||!w||!w.t) return ''; return esc(w.t)+(w.u?' <a href="'+esc(w.u)+'" target="_blank" rel="noopener">source ↗</a>':''); }
function lab(c,k,text,forId,bk){ return '<label'+(forId?' for="'+forId+'"':'')+'>'+text+gbadge(c,bk||k)+'</label>'; }
function ensureDrafts(c){ if(!c.ls) c.ls={title:'',titleEdited:false,desc:'',descEdited:false}; if(!c.ls.titleEdited) c.ls.title=Listing.draftTitle(c); if(!c.ls.descEdited) c.ls.desc=Listing.draftDesc(c,{cleaned:hasClean(c)}); }
function buildForm(host,c,keys,onch){
  var h='';
  keys.forEach(function(k){
    var d=FDEF[k];
    if(d){ var v=k==='tags'?(c.tags||[]).join(', '):(c[k]===''||c[k]==null?'':c[k]);
      h+='<div class="fld">'+lab(c,k,d[0],'f_'+k)+'<input id="f_'+k+'" data-k="'+k+'" type="text" inputmode="'+(d[1]==='text'?'text':d[1])+'" placeholder="'+esc(d[2])+'" value="'+esc(v)+'" autocomplete="off" autocapitalize="'+(k==='tags'||k==='serial'?'none':'words')+'" enterkeyhint="next">'+(d[3]?'<div class="sug" data-sug="'+k+'"></div>':'')+'<div class="why" data-why="'+k+'">'+whyHtml(c,k)+'</div>'+(k==='team'?'<div class="autoT" data-autoT></div>':'')+'</div>'; }
    else if(k==='sport') h+='<div class="fld"><label data-lab="sport">Sport'+gbadge(c,'sport')+'</label><div class="segb" data-seg="sport">'+SPORTS.map(function(x){return '<button data-v="'+x+'" class="'+(c.sport===x?'on':'')+'">'+x+'</button>'}).join('')+'</div><div class="why" data-why="sport">'+whyHtml(c,'sport')+'</div><div class="sportAsk" data-sportask></div></div>';
    else if(k==='cond'){
      var gopts='<option value="">Grader…</option>'+GRADERS.map(function(g){return '<option'+(c.grader===g?' selected':'')+'>'+g+'</option>'}).join('');
      h+='<div class="fld">'+lab(c,'cond','Raw or graded?',null,'slab')+'<div class="segb" data-seg="cond"><button data-v="raw" class="'+(c.cond!=='graded'?'on':'')+'">Raw</button><button data-v="graded" class="'+(c.cond==='graded'?'on':'')+'">Graded</button></div>'+
        '<div id="gradeRow" style="margin-top:8px;display:'+(c.cond==='graded'?'block':'none')+'"><div class="row2"><select data-k="grader" aria-label="Grader">'+gopts+'</select><input data-k="grade" type="text" inputmode="decimal" placeholder="Grade, e.g. 9" value="'+esc(c.grade)+'" aria-label="Grade"></div><input data-k="cert" type="text" inputmode="numeric" placeholder="Cert number (printed on the slab label)" value="'+esc(c.cert)+'" aria-label="Cert number" style="margin-top:8px"></div></div>';
    }
    else if(k==='flags') h+='<div class="fld">'+lab(c,'flags','Features')+'<div class="tgl"><button type="button" data-flag="rookie" class="'+(c.rookie?'on':'')+'">Rookie</button><button type="button" data-flag="auto" class="'+(c.auto?'on':'')+'">Autograph</button><button type="button" data-flag="relic" class="'+(c.relic?'on':'')+'">Patch / relic</button></div></div>';
    else if(k==='flaws') h+='<div class="fld"><label>Flaws I can see <small>(tap any that apply)</small></label><div class="tgl">'+Listing.FLAWS.map(function(f){return '<button type="button" data-flaw="'+f[0]+'" class="'+((c.flaws||[]).indexOf(f[0])>=0?'on':'')+'">'+f[1]+'</button>'}).join('')+'</div></div>';
    else if(k==='flawText') h+='<div class="fld"><label for="f_flawText">Flaws in my own words <small>(optional)</small></label><textarea id="f_flawText" data-k="flawText" placeholder="e.g. light wear on the top left corner, small print line on the back">'+esc(c.flawText)+'</textarea></div>';
    else if(k==='condNotes') h+='<div class="fld"><label for="f_condNotes">Condition notes <small>(optional)</small></label><textarea id="f_condNotes" data-k="condNotes" placeholder="e.g. stored in a sleeve and top loader since I got it">'+esc(c.condNotes)+'</textarea></div>';
    else if(k==='price') h+='<div class="fld pvbox"><label for="f_price">Your price ($) <small>(optional)</small></label><input id="f_price" data-k="price" type="text" inputmode="decimal" placeholder="Only if you want it on the sheet" value="'+esc(c.price)+'"><div class="pvn">This is only a number you type. Nothing is looked up or suggested here.</div></div>';
    else if(k==='title') h+='<div class="fld"><label for="f_title">Title <span class="cnt" id="tcnt"></span></label><input id="f_title" data-k="title" type="text" maxlength="80" autocomplete="off" value="'+esc(c.ls.title)+'"><div class="hint" id="tHint"></div><div class="r"><button type="button" class="chip" data-redraft="title">↻ Re-draft from my fields</button></div></div>';
    else if(k==='desc') h+='<div class="fld"><label for="f_desc">Description</label><textarea id="f_desc" data-k="desc" rows="11">'+esc(c.ls.desc)+'</textarea><div class="hint" id="dHint"></div><div class="r"><button type="button" class="chip" data-redraft="desc">↻ Re-draft from my fields</button></div></div>';
    else if(k==='status') h+='<div class="fld"><label>Status</label><div class="segb" data-seg="status"><button data-v="owned" class="'+(c.status==='owned'?'on':'')+'">Owned</button><button data-v="listed" class="'+(c.status==='listed'?'on':'')+'">Listed</button><button data-v="sold" class="'+(c.status==='sold'?'on':'')+'">Sold</button></div></div>';
    else if(k==='sold') h+='<div class="fld" id="soldFld" style="display:'+(c.status==='sold'?'block':'none')+'"><label for="f_sold">Sold price ($)</label><input id="f_sold" data-k="sold" type="text" inputmode="decimal" placeholder="What it sold for" value="'+esc(c.sold)+'"><div class="profit" id="profit" style="margin-top:8px"></div></div>';
    else if(k==='label') h+='<div class="fld"><label>Label</label><div class="segb" data-seg="label"><button data-v="" class="'+(!c.label?'on':'')+'">None</button><button data-v="sell" class="'+(c.label==='sell'?'on':'')+'">Sell</button><button data-v="keep" class="'+(c.label==='keep'?'on':'')+'">Keep</button><button data-v="grade" class="'+(c.label==='grade'?'on':'')+'">Grade</button></div></div>';
    else if(k==='pv') h+='<div class="fld pvbox"><label for="f_pv">Placeholder value ($)</label><input id="f_pv" data-k="pv" type="text" inputmode="decimal" placeholder="Your own number" value="'+esc(c.pv)+'"><div class="pvn"><b>'+PHNOTE+'</b> It is only a number you type, so you can sort and total. Nothing here is looked up.</div></div>';
    else if(k==='notes') h+='<div class="fld"><label for="f_notes">Notes</label><textarea id="f_notes" data-k="notes" placeholder="Where you got it, condition, anything you want to remember">'+esc(c.notes)+'</textarea></div>';
  });
  host.innerHTML=h;
  var $f=function(q){return host.querySelector(q)};
  function derived(){
    var gr=$f('#gradeRow'); if(gr) gr.style.display=c.cond==='graded'?'block':'none';
    var sf=$f('#soldFld'); if(sf) sf.style.display=c.status==='sold'?'block':'none';
    var pf=$f('#profit'); if(pf){ var cost=c.cost===''?null:c.cost, s=c.sold;
      if(s===''){ pf.className='profit'; pf.textContent='Enter the sold price to see your profit.'; }
      else{ var p=s-(cost||0); pf.className='profit'+(p<0?' neg':''); pf.textContent='Profit: '+money(p)+(cost===null?' (no cost entered, so this is the full sold price)':' (sold '+money(s)+' − cost '+money(cost)+')'); } }
  }
  function dropBadge(k){ var bd=host.querySelector('[data-ck="'+(GK[k]||k)+'"]'); if(bd) bd.remove(); var cb=host.querySelector('[data-cl="'+k+'"]'); if(cb) cb.remove(); var w=host.querySelector('[data-why="'+k+'"]'); if(w) w.innerHTML=''; }
  function drafts(k){
    var t=G('f_title'), dd=G('f_desc'); if(!t&&!dd) return;
    if(k!=='title'&&k!=='desc'){ ensureDrafts(c); if(t&&document.activeElement!==t) t.value=c.ls.title; if(dd&&document.activeElement!==dd) dd.value=c.ls.desc; }
    if(t){ var n=t.value.length; G('tcnt').textContent=n+'/80'; G('tcnt').className='cnt'+(n>=80?' full':''); G('tHint').textContent=c.ls.titleEdited?'You edited this title, so it will not change by itself. Tap ↻ to start over from your fields.':'Drafted from your fields. It updates as you change them. Edit it any time.'; }
    if(dd) G('dHint').textContent=c.ls.descEdited?'You edited this description, so it will not change by itself. Tap ↻ to start over from your fields.':'Drafted from your fields (no price, no hype). It updates as you change them. Edit it any time.';
  }
  function sugRender(k,inp){
    var box=host.querySelector('[data-sug="'+k+'"]'); if(!box) return;
    var items=sugFor(k,inp.value,c); box.innerHTML=items.map(function(x){return '<button type="button" data-sv="'+esc(x)+'">'+esc(x)+'</button>'}).join('');
  }
  var WDT=buildForm.WDT||(buildForm.WDT={});
  function syncBadge(f){ var lb=host.querySelector('label[for="f_'+f+'"]')||host.querySelector('[data-lab="'+f+'"]'); if(lb){ [].forEach.call(lb.querySelectorAll('.chk'),function(x){x.remove()}); lb.insertAdjacentHTML('beforeend',gbadge(c,f)); } var w=host.querySelector('[data-why="'+f+'"]'); if(w) w.innerHTML=whyHtml(c,f); }
  function showSport(){ [].forEach.call(host.querySelectorAll('[data-seg="sport"] button'),function(b){ b.classList.toggle('on',b.dataset.v===c.sport); }); }
  function autoBoxes(){
    var sa=$f('[data-sportask]'); if(sa){ sa.innerHTML=(window.CardAuto&&CardAuto.askSport(c))?'<div class="saq"><b>Which sport is this card?</b> I could not tell from the photo. Tap one.</div><div class="sab">'+SPORTS.map(function(x){return '<button type="button" data-sa="'+x+'">'+x+'</button>'}).join('')+'</div>':''; }
    var tb=$f('[data-autoT]'); if(!tb||!window.CardAuto) return; var h='';
    if(!c.team&&c.player&&CardAuto.parts(c.player).n>=2){
      var o=CardAuto.teamOptions(c)||[];
      if(o.length>=1) h='<div class="hint2"><span>Team might be:</span>'+o.map(function(x){return '<button type="button" class="chip" data-at="'+esc(x.team)+'">'+esc(x.team)+'</button>'}).join('')+'</div>'+(o[0].url?'<div class="why"><a href="'+esc(o[0].url)+'" target="_blank" rel="noopener">source ↗</a></div>':'');
      else if(!o.length&&navigator.onLine!==false&&!(WDT[c.player]==='none')) h='<div class="wdRow"><button type="button" class="chip" data-wd="1">'+(WDT[c.player]==='busy'?'Looking…':'🌐 Look up the team online')+'</button><small>Optional. Sends only the name “'+esc(c.player)+'” to wikidata.org. No photos, nothing else.</small></div>';
    }
    tb.innerHTML=h;
  }
  function autoRefresh(){
    if(!window.CardAuto) return; var r=CardAuto.run(c,{},{noRead:true});
    if(r.n){ r.fields.forEach(function(f){ var inp=host.querySelector('[data-k="'+f+'"]'); if(inp&&document.activeElement!==inp) inp.value=c[f]; if(f==='sport') showSport(); syncBadge(f); }); c.upd=Date.now(); saveCard(c); drafts('x'); }
    autoBoxes();
  }
  host.oninput=function(e){ var el=e.target; if(!el.dataset||!el.dataset.k) return; var k=el.dataset.k; setField(c,k,el.value); dropBadge(k); if(k==='cost'||k==='sold') derived(); sugRender(k,el); drafts(k); if(k==='player'||k==='brand'||k==='team') autoRefresh(); if(onch) onch(k); };
  host.onchange=function(e){ var el=e.target; if(el.tagName==='SELECT'&&el.dataset.k){ setField(c,el.dataset.k,el.value); dropBadge(el.dataset.k); drafts(el.dataset.k); if(onch) onch(el.dataset.k); } };
  host.onfocusin=function(e){ var el=e.target; if(el.dataset&&el.dataset.k&&FDEF[el.dataset.k]&&FDEF[el.dataset.k][3]) sugRender(el.dataset.k,el); };
  host.onfocusout=function(e){ var el=e.target; if(el.dataset&&el.dataset.k){ var k=el.dataset.k; setTimeout(function(){ var bx=host.querySelector('[data-sug="'+k+'"]'); if(bx&&document.activeElement!==el) bx.innerHTML=''; },300); } };
  host.onclick=function(e){
    var cl=e.target.closest('[data-cl]'); if(cl){ e.preventDefault(); var ck2=cl.dataset.cl; c[ck2]=''; delete c.guess[ck2]; if(c.why) delete c.why[ck2]; c.noAuto=c.noAuto||{}; c.noAuto[ck2]=1; c.edited=true; c.upd=Date.now(); saveCard(c); var i2=host.querySelector('[data-k="'+ck2+'"]'); if(i2) i2.value=''; syncBadge(ck2); drafts(ck2); autoRefresh(); if(onch) onch(ck2); return; }
    var ck=e.target.closest('[data-ck]'); if(ck){ e.preventDefault(); var kk=ck.dataset.ck; delete c.guess[kk]; if(kk==='sport') c.sportOk=true; c.edited=true; c.upd=Date.now(); saveCard(c); syncBadge(kk); if(kk==='player'||kk==='team') autoBoxes(); if(onch) onch('guess'); return; }
    var sa=e.target.closest('[data-sa]'); if(sa){ setField(c,'sport',sa.dataset.sa); c.sportOk=true; saveCard(c); showSport(); syncBadge('sport'); drafts('sport'); autoRefresh(); if(onch) onch('sport'); return; }
    var at=e.target.closest('[data-at]'); if(at){ var tv=at.dataset.at; setField(c,'team',tv); var ti=host.querySelector('[data-k="team"]'); if(ti) ti.value=tv; syncBadge('team'); drafts('team'); autoRefresh(); if(onch) onch('team'); return; }
    var wd=e.target.closest('[data-wd]'); if(wd){ var nm=c.player; if(!nm||WDT[nm]==='busy') return; WDT[nm]='busy'; autoBoxes();
      CardAuto.lookup(nm).then(function(r){ WDT[nm]='none'; if(c.player!==nm||!r) { autoBoxes(); return; } var ts=r.teams||[];
        if(ts.length===1&&!c.team){ c.team=ts[0]; c.guess.team=1; c.why=c.why||{}; c.why.team={t:'Wikidata lists '+ts[0]+' as the current team. Check the card, it may show another.',u:CardAuto.wdUrl(r.id)}; var ti2=host.querySelector('[data-k="team"]'); if(ti2) ti2.value=c.team; if(!c.sportOk&&c.sport!==r.sport){ c.sport=r.sport; c.guess.sport=1; c.why.sport={t:'Because Wikidata lists '+nm+' as a '+r.sport.toLowerCase()+' player.',u:CardAuto.wdUrl(r.id)}; showSport(); syncBadge('sport'); } syncBadge('team'); c.upd=Date.now(); saveCard(c); drafts('x'); autoBoxes(); }
        else if(ts.length>1){ WDT[nm]='list'; var tb=host.querySelector('[data-autoT]'); if(tb) tb.innerHTML='<div class="hint2"><span>Team might be (Wikidata):</span>'+ts.map(function(x){return '<button type="button" class="chip" data-at="'+esc(x)+'">'+esc(x)+'</button>'}).join('')+'</div><div class="why"><a href="'+esc(CardAuto.wdUrl(r.id))+'" target="_blank" rel="noopener">source ↗</a></div>'; }
        else { if(r.sport&&!c.sportOk&&!c.guess.sport){ c.sport=r.sport; c.guess.sport=1; c.why=c.why||{}; c.why.sport={t:'Because Wikidata calls '+nm+' a '+r.sport.toLowerCase()+' player.',u:CardAuto.wdUrl(r.id)}; showSport(); syncBadge('sport'); c.upd=Date.now(); saveCard(c); drafts('x'); }
          autoBoxes(); var tb2=host.querySelector('[data-autoT]'); if(tb2) tb2.innerHTML='<div class="why">Wikidata knows '+esc(nm)+' as a '+esc((r.sport||'').toLowerCase())+' player but lists no current team. Type the team from the card. <a href="'+esc(CardAuto.wdUrl(r.id))+'" target="_blank" rel="noopener">source ↗</a></div>'; }
      }).catch(function(){ WDT[nm]='none'; autoBoxes(); }); return; }
    var sb=e.target.closest('[data-sv]'); if(sb){ var box=sb.parentNode, k=box.dataset.sug, inp=host.querySelector('[data-k="'+k+'"]'); inp.value=sb.dataset.sv; setField(c,k,sb.dataset.sv); dropBadge(k); box.innerHTML=''; drafts(k); if(k==='player'||k==='brand'||k==='team') autoRefresh(); if(onch) onch(k); return; }
    var fg=e.target.closest('[data-flag]'); if(fg){ var f=fg.dataset.flag; c[f]=!c[f]; fg.classList.toggle('on',!!c[f]); if(c.guess) delete c.guess.flags; dropBadge('flags'); c.edited=true; c.upd=Date.now(); saveCard(c); drafts(f); if(onch) onch(f); return; }
    var fw=e.target.closest('[data-flaw]'); if(fw){ var w=fw.dataset.flaw, ix=c.flaws.indexOf(w); if(ix>=0) c.flaws.splice(ix,1); else c.flaws.push(w); fw.classList.toggle('on',ix<0); c.edited=true; c.upd=Date.now(); saveCard(c); drafts('flaws'); if(onch) onch('flaws'); return; }
    var rd=e.target.closest('[data-redraft]'); if(rd){ var what=rd.dataset.redraft;
      var doIt=function(){ c.ls[what+'Edited']=false; ensureDrafts(c); var el2=G(what==='title'?'f_title':'f_desc'); if(el2) el2.value=c.ls[what]; c.edited=true; saveCard(c); drafts('x'); MC().toast('Re-drafted from your fields.'); if(onch) onch(what); };
      if(c.ls[what+'Edited']) MC().askDlg('Replace what you wrote?','This swaps your edited '+(what==='title'?'title':'description')+' for a fresh draft built from the fields above.',[{label:'Re-draft it',cls:'gold',fn:doIt},{label:'Keep mine',cls:'ghost'}]); else doIt(); return; }
    var b=e.target.closest('.segb button'); if(!b) return; var sg=b.parentNode.dataset.seg;
    [].forEach.call(b.parentNode.children,function(x){x.classList.toggle('on',x===b)});
    setField(c,sg,b.dataset.v); dropBadge(sg); if(sg==='sport'){ syncBadge('sport'); autoRefresh(); } derived(); drafts(sg); if(onch) onch(sg);
  };
  derived(); drafts('init'); autoBoxes();
}
function setField(c,k,v){
  if(k==='title'||k==='desc'){ c.ls[k]=v; c.ls[k+'Edited']=String(v).trim()!==''; c.edited=true; c.upd=Date.now(); saveCard(c); return; }
  if(k==='year'){ v=String(v).replace(/\D/g,'').slice(0,4); v=v===''?'':parseInt(v,10); }
  else if(k==='cost'||k==='sold'||k==='pv'||k==='price') v=num(v);
  else if(k==='tags') v=String(v).split(',').map(function(x){return x.trim()}).filter(function(x,i,a){return x&&a.indexOf(x)===i});
  c[k]=v; c.edited=true; c.upd=Date.now(); if(k==='player') c.named=!!String(v).trim(); if(k==='sport') c.sportOk=true;
  if(c.guess){ delete c.guess[GK[k]||k]; } if(c.why) delete c.why[k];
  if(['year','brand','parallel','team','cond','grader','sport'].indexOf(k)>=0&&v!==''){ LAST[k]=v; lsSet('mc-last',LAST); }
  saveCard(c);
}
/* mark a value as a guess (auto-read, or copied from the last card) so the screen says "check this" until the user taps it or edits it */
function setGuess(c,k,v){ setField(c,k,v); c.guess=c.guess||{}; c.guess[GK[k]||k]=1; }

/* ---------- card detail ---------- */
var D={id:null,list:[],i:0,side:'front'};
B.openCard=function(id,list){
  D.list=list&&list.length?list:[id]; D.i=Math.max(0,D.list.indexOf(id)); D.id=D.list[D.i]; D.side='front'; D.orig=false;
  B.cdOpen=true; MC().show('cd'); renderCD(); $('cdBody').scrollTop=0;
};
function renderCD(){
  var c=byId(D.id); if(!c){ closeCD(); return; }
  $('cdN').textContent='Card '+(D.i+1)+' of '+D.list.length;
  $('cdPrev').disabled=D.i<=0; $('cdNext').disabled=D.i>=D.list.length-1;
  drawCDPhoto(c);
  buildForm($('cdForm'),c,['sport','player','team','year','brand','number','serial','parallel','cond','status','cost','sold','label','tags','pv','notes'],function(k){ $('cdSaved').textContent='Saved ✓'; if(k==='player'||k==='team'||k==='year') {} });
  $('cdSaved').textContent='';
  var h=''; B.binders.forEach(function(b){ h+='<button data-bid="'+b.id+'" class="'+(b.ids.indexOf(c.id)>=0?'on':'')+'">'+(b.ids.indexOf(c.id)>=0?'✓ ':'')+esc(b.name)+'</button>'; });
  h+='<button data-bid="__new">＋ New binder</button>';
  $('cdBinders').innerHTML=h;
  $('cdMeta').textContent=(c.snum?'From scan section '+c.snum+' · ':'')+'Added '+new Date(c.ts).toLocaleDateString();
}
function realSide(c){ if(D.side==='front') return c.front?'front':(c.back?'back':null); if(D.side==='back') return c.back?'back':(c.front?'front':null); return null; }
function drawCDPhoto(c){
  var blob=null, label='', rm=false, rs=null, cl=null;
  if(D.side==='front'){ blob=c.front||c.back; label=c.front?'Front':'Back'; rs=realSide(c); }
  else if(D.side==='back'){ blob=c.back; label='Back'; if(!blob){ blob=c.front; label='Front (no back yet)'; } rs=realSide(c); }
  else { var p=(c.photos||[]).filter(function(x){return 'p:'+x.id===D.side})[0]; if(p){ blob=p.blob; label='My photo'; rm=true; } else { D.side='front'; blob=c.front; label='Front'; rs=realSide(c); } }
  cl=rs?cleanOf(c,rs):null; var showC=!!cl&&!D.orig;
  if(showC) blob=cl.blob;
  var flip=c.back&&c.front&&!rm;
  $('cdImg').src=urlOf(blob); $('cdFl').textContent=label+(showC?' · Cleaned scan, card unchanged':(cl?' · Original':(flip?' · tap to flip':''))); $('cdRm').style.display=rm?'block':'none';
  var h='';
  h+='<button data-s="front" class="'+(D.side==='front'?'on':'')+'" style="background-image:url('+urlOf(c.front||c.back)+')"><span>Front</span></button>';
  if(c.back) h+='<button data-s="back" class="'+(D.side==='back'?'on':'')+'" style="background-image:url('+urlOf(c.back)+')"><span>Back</span></button>';
  (c.photos||[]).forEach(function(p,i){ h+='<button data-s="p:'+p.id+'" class="'+(D.side==='p:'+p.id?'on':'')+'" style="background-image:url('+urlOf(p.thumb||p.blob)+')"><span>Mine '+(i+1)+'</span></button>'; });
  h+='<button class="add" data-s="__add" aria-label="Add my photo">＋<span>My photo</span></button>';
  $('cdStrip').innerHTML=h;
  renderClean(c);
}
function renderClean(c){
  var host=$('cdClean'), rs=realSide(c), h='';
  if(!rs){ host.innerHTML=''; return; }
  var cl=cleanOf(c,rs), nm=rs==='front'?'front':'back';
  if(D.busy===c.id+rs) h='<div class="clbox"><div class="cl-l"><b>Cleaning up this photo…</b><br>This takes a second or two. Your original is not touched.</div></div>';
  else if(!cl) h='<button class="ghost-btn dbtn2" data-cl="do">✨ Clean up photo<small>Straightens the '+nm+' photo and evens out the light, so it is ready for a listing. Your original is always kept.</small></button>';
  else{
    h='<div class="clbox"><div class="segb clseg"><button data-cl="view" data-v="clean" class="'+(!D.orig?'on':'')+'">Cleaned</button><button data-cl="view" data-v="orig" class="'+(D.orig?'on':'')+'">Original</button></div>';
    if(!D.orig) h+='<div class="cl-l"><b>Cleaned scan, card unchanged</b><br>'+esc(Cleanup.noteText(cl.notes))+(cl.msg?'<div class="cl-w">'+esc(cl.msg)+'</div>':'')+'</div>';
    else h+='<div class="cl-l">This is your photo exactly as you took it.'+(cl.msg?'':' Tap <b>Cleaned</b> to see the straightened one.')+'</div>';
    h+='<div class="r"><button class="chip" data-cl="do">↻ Clean up again</button><button class="chip" data-cl="rm">Remove cleaned version</button></div></div>';
  }
  host.innerHTML=h;
}
async function cleanSide(c,side){
  var src=c[side]; if(!src) return null;
  var r=await Cleanup.cleanBlob(src,c.cond==='graded'?'graded':'raw');
  c.clean=c.clean||{}; c.clean[side]={blob:r.blob,notes:r.notes,found:r.quadFound,msg:r.msg||'',ts:Date.now(),mode:c.cond==='graded'?'graded':'raw',src:src.size};
  await refreshCThumb(c); c.edited=true; c.upd=Date.now(); await put('cards',c); return r;
}
async function refreshCThumb(c){ var k=cleanOf(c,'front')||(!c.front?cleanOf(c,'back'):null); c.cthumb=k?await thumb(k.blob):null; }
async function doClean(c,rs){
  if(D.busy) return; D.busy=c.id+rs; D.orig=false; renderClean(c); await sleep(30);
  var msg='', warn=false;
  try{ var r=await cleanSide(c,rs); msg=r&&r.quadFound?'Cleaned ✓ Your original is still here.':'Tidied the light only. I could not find the card edges, so nothing was straightened. See the note.'; warn=!(r&&r.quadFound); }
  catch(e){ log('cleanup fail: '+(e&&e.message||e)); msg='Sorry, clean-up did not work on this photo. Nothing was changed.'; warn=true; }
  D.busy=null; MC().toast(msg,3600,warn); if(D.id===c.id) drawCDPhoto(c);
}
$('cdClean').addEventListener('click',function(e){
  var b=e.target.closest('[data-cl]'); if(!b) return; var c=byId(D.id); if(!c) return; var a=b.dataset.cl, rs=realSide(c);
  if(a==='view'){ D.orig=b.dataset.v==='orig'; drawCDPhoto(c); }
  else if(a==='do'&&rs) doClean(c,rs);
  else if(a==='rm'&&rs) MC().askDlg('Remove the cleaned version?','Your original photo stays exactly as it is. You can clean it up again any time.',[{label:'Remove cleaned version',cls:'ghost',fn:function(){ if(c.clean) delete c.clean[rs]; refreshCThumb(c).then(function(){ c.edited=true; saveCard(c); D.orig=false; if(D.id===c.id) drawCDPhoto(c); MC().toast('Cleaned version removed.'); }); }},{label:'Keep it',cls:'gold'}]);
});
$('cdListing').addEventListener('click',function(){ B.openListing(D.id); });
function closeCD(){ flush(); B.cdOpen=false; if(B.view.id&&$('bv')){ MC().show('bv'); renderBV(); } else B.goHome(); }
$('cdBack').addEventListener('click',closeCD);
function cdGo(d){ var j=D.i+d; if(j<0||j>=D.list.length) return; flush(); D.i=j; D.id=D.list[j]; D.side='front'; D.orig=false; renderCD(); $('cdBody').scrollTop=0; }
$('cdPrev').addEventListener('click',function(){cdGo(-1)}); $('cdNext').addEventListener('click',function(){cdGo(1)});
$('cdImg').addEventListener('click',function(){ var c=byId(D.id); if(!c||!c.front||!c.back) return; if(D.side==='front') D.side='back'; else if(D.side==='back') D.side='front'; else return; D.orig=false; drawCDPhoto(c); });
$('cdStrip').addEventListener('click',function(e){
  var b=e.target.closest('button'); if(!b) return; var s=b.dataset.s, c=byId(D.id);
  if(s==='__add'){ MC().askDlg('Add my photo','Add your own extra photo: a close-up, the corners, a receipt, anything.',[{label:'Take a photo',cls:'gold',fn:function(){ $('cdCam').click(); }},{label:'Choose from my phone',cls:'ghost',fn:function(){ $('cdFile').click(); }},{label:'Cancel',cls:'ghost'}]); return; }
  D.side=s; D.orig=false; drawCDPhoto(c);
});
$('cdRm').addEventListener('click',function(){
  var c=byId(D.id), id=D.side.slice(2);
  MC().askDlg('Remove this photo?','It is removed from this card on this phone.',[{label:'Remove photo',cls:'ghost',fn:function(){ c.photos=c.photos.filter(function(p){return p.id!==id}); c.edited=true; saveCard(c); D.side='front'; drawCDPhoto(c); MC().toast('Photo removed.'); }},{label:'Keep it',cls:'gold'}]);
});
function scaleFile(file,maxW){
  return new Promise(function(res){
    var u=URL.createObjectURL(file), im=new Image();
    im.onload=function(){ try{ var s=Math.min(1,maxW/Math.max(im.naturalWidth,im.naturalHeight)), c=document.createElement('canvas'); c.width=Math.round(im.naturalWidth*s); c.height=Math.round(im.naturalHeight*s); c.getContext('2d').drawImage(im,0,0,c.width,c.height); URL.revokeObjectURL(u); c.toBlob(function(b){res(b||file)},'image/jpeg',.88); }catch(e){ URL.revokeObjectURL(u); res(file); } };
    im.onerror=function(){ URL.revokeObjectURL(u); res(file); };
    im.src=u;
  });
}
async function addPhotos(files){
  var c=byId(D.id); if(!c||!files||!files.length) return;
  for(var i=0;i<files.length;i++){ var b=await scaleFile(files[i],1800), t=await thumb(b,200); c.photos.push({id:rid('p'),blob:b,thumb:t}); }
  c.edited=true; saveCard(c); D.side='p:'+c.photos[c.photos.length-1].id; drawCDPhoto(c); MC().toast(files.length+' photo'+(files.length===1?'':'s')+' added.');
}
$('cdFile').addEventListener('change',function(e){ var f=[].slice.call(e.target.files||[]); e.target.value=''; addPhotos(f); });
$('cdCam').addEventListener('change',function(e){ var f=[].slice.call(e.target.files||[]); e.target.value=''; addPhotos(f); });
$('cdBinders').addEventListener('click',function(e){
  var b=e.target.closest('button'); if(!b) return; var c=byId(D.id), id=b.dataset.bid;
  if(id==='__new'){ newBinderDlg(function(nb){ addTo(nb,[c.id]); renderCD(); }); return; }
  var bd=binderById(id), k=bd.ids.indexOf(c.id);
  if(k>=0) bd.ids.splice(k,1); else bd.ids.push(c.id); c.edited=true; saveCard(c); saveBinder(bd); renderCD();
});
$('cdMove').addEventListener('click',function(){ pickBinder([D.id],true); });
$('cdDel').addEventListener('click',function(){
  var c=byId(D.id); if(!c) return;
  confirmDelete([c.id],{at:D.i,fromCD:true});
});
/* Undo banner: stays at least 30 seconds (45 s here), with a plain line about Recently deleted */
var UB={t:null,fn:null};
function undoBar(msg,fn,ms){ $('ubMsg').innerHTML=msg; UB.fn=fn; $('undoBar').classList.add('on'); clearTimeout(UB.t); UB.t=setTimeout(function(){ $('undoBar').classList.remove('on'); UB.fn=null; },ms||45000); }
function hideUndo(){ clearTimeout(UB.t); UB.fn=null; $('undoBar').classList.remove('on'); }
$('ubBtn').addEventListener('click',function(){ var f=UB.fn; UB.fn=null; clearTimeout(UB.t); $('undoBar').classList.remove('on'); if(f) f(); });
function snapshot(ids){ return ids.map(function(id){ var c=byId(id); return c?{c:c,mem:B.binders.filter(function(b){return b.ids.indexOf(id)>=0}).map(function(b){return b.id})}:null; }).filter(Boolean); }
async function restoreSnap(snaps){
  for(var i=0;i<snaps.length;i++){ var sn=snaps[i], c=sn.c; if(!byId(c.id)) B.cards.push(c); await put('cards',c); delete B.gone[c.id]; await del('gone',c.id);
    sn.mem.forEach(function(bid){ var b=binderById(bid); if(b&&b.ids.indexOf(c.id)<0){ b.ids.push(c.id); saveBinder(b); } }); }
}
function afterRestore(id,at){
  var onCd=$('cd').classList.contains('on'), onBv=$('bv').classList.contains('on');
  if(onCd&&id){ if(D.list.indexOf(id)<0) D.list.splice(Math.min(at==null?D.list.length:at,D.list.length),0,id); D.i=D.list.indexOf(id); D.id=id; D.side='front'; D.orig=false; renderCD(); }
  else if(onBv) renderBV(); else renderHome();
}

/* ---------- Name your cards (v0.9: the app reads each photo on this device and pre-fills what it is sure of) ---------- */
var N={ids:[],i:0,side:'front',named:0,sid:null,rd:null};
function needsName(c){ return !c.player||!!(c.guess&&c.guess.player); }
B.openName=function(opts){
  opts=opts||{}; flush();
  var list=B.cards.filter(function(c){return needsName(c)&&(!opts.sid||c.sid===opts.sid)});
  list.sort(function(a,b){return (a.snum-b.snum)||(a.idx-b.idx)||cmpDate(a,b)});
  if(!list.length){ MC().toast('Every card already has a name.'); B.goHome(); return; }
  if(N.rd) N.rd.stop=true;
  N={ids:list.map(function(c){return c.id}),i:0,side:'front',named:0,sid:opts.sid||null,rd:null,help:{}};
  MC().show('nm'); renderNM(true); startReading();
};
/* reader queue: one card at a time in the page, the heavy work runs in the reader's own worker, so taps stay smooth */
function startReading(){
  var rd=N.rd={stop:false,done:0,fail:null,cur:null,pending:0};
  var todo=N.ids.filter(function(id){ var c=byId(id); return c&&!c.ocrTs&&!c.edited; });
  rd.total=todo.length; rd.pending=todo.length;
  if(!todo.length&&!(v10ok()&&N.ids.some(function(id){ var c=byId(id); return c&&!c.ocr10; }))){ updateRd(); return; }
  updateRd(); if(!window.CardOCR||!window.CardParse){ rd.fail='The reader files are missing'; updateRd(); return; }
  (async function loop(){
    try{ await CardOCR.init(function(m){ rd.msg=m; updateRd(); }); }catch(e){ rd.fail=(e&&e.message)||'The reader did not start'; log('reader init failed: '+rd.fail); updateRd(); return; }
    rd.msg='';
    while(!rd.stop){
      var id=null, k, job=null, cur0=byId(N.ids[N.i]);
      function needCloser(cc,isCur){ return v10ok()&&cc&&!cc.ocr10&&!rd['z'+cc.id]&&(cc.ocrTs||cc.ocrFail||rd['x'+cc.id]||(isCur&&cc.edited))&&(isCur||!cc.edited); }
      if(needCloser(cur0,true)) job=['c',cur0.id];
      else { for(k=0;k<N.ids.length;k++){ var j=(N.i+k)%N.ids.length, cc=byId(N.ids[j]); if(cc&&!cc.ocrTs&&!cc.ocrFail&&!cc.edited&&todo.indexOf(cc.id)>=0&&!rd['x'+cc.id]){ job=['r',cc.id]; break; } }
        if(!job) for(k=N.i;k<N.ids.length;k++){ var c3=byId(N.ids[k]); if(needCloser(c3,false)){ job=['c',c3.id]; break; } } }
      if(!job) break;
      var c=byId(job[1]); id=c.id; rd.cur=id; updateRd();
      if(job[0]==='c'){ var done=true; try{ done=await readCloser(c,rd.words&&rd.words[id]); }catch(e){ log('closer error '+id+': '+(e&&e.message||e)); } if(done!==false) rd['z'+id]=1; rd.cur=null; updateRd(); await sleep(30); continue; }
      try{
        var r=await CardOCR.readWords(c.front||c.back,{shouldStop:function(){return rd.stop}});
        if(rd.stop) break;
        (rd.words=rd.words||{})[id]=r.words;
        var p=CardParse.parse(r.words,c.sport||'Baseball'); applyRead(c,p,r.ms);
      }catch(e){ log('read fail '+id+': '+(e&&e.message||e)); c.ocrFail=true; rd['x'+id]=1; }
      rd['x'+id]=1; rd.done++; rd.pending=Math.max(0,rd.pending-1); rd.cur=null; updateRd();
      await sleep(30);
    }
    rd.cur=null; updateRd();
  })();
}
function applyRead(c,p,ms){
  c.guess=c.guess||{}; var any=0, F=p.fields;
  ['player','team','year','brand','number','serial','parallel'].forEach(function(k){ var v=F[k]; if(k==='player'&&v&&window.CardAuto) v=CardAuto.okName(v); if(v!=null&&v!==''&&(c[k]===''||c[k]==null)){ c[k]=(k==='year'?+v:v); c.guess[k]=1; any++; } });
  var fl=0; ['rookie','auto','relic'].forEach(function(f){ if(p.flags[f]&&!c[f]){ c[f]=true; fl++; } }); if(fl){ c.guess.flags=1; any++; }
  c.ocrLow=p.low||{}; try{ if(window.CardAuto) any+=CardAuto.run(c,{low:c.ocrLow}).n; }catch(e){ log('auto: '+e.message); } c.ocrTs=Date.now(); c.ocrN=any; c.upd=Date.now(); saveCard(c); log('read '+c.id+': '+any+' fields in '+ms+' ms');
  if(N.ids[N.i]===c.id){ renderNMForm(c); renderNMHints(c); }
}
function updateRd(){
  var rd=N.rd, el=$('nmRd'); if(!el||!rd) return; var c=byId(N.ids[N.i]), t=N.ids.length;
  var read=N.ids.filter(function(id){var x=byId(id); return x&&x.ocrTs}).length;
  var h='';
  if(rd.fail) h='<b>The auto-reader could not start on this device.</b> Nothing is wrong with your cards. Type each name and use Next.';
  else if(rd.msg) h='<b>'+esc(rd.msg)+'</b>';
  else if(rd.pending>0||rd.cur){ h='<b>Reading your cards on this device…</b> '+read+' of '+t+' done'+(c&&!c.ocrTs&&!c.edited&&!c.ocrFail?' · this one is next':''); }
  else if(read){ h='<b>Auto-read finished.</b> Everything it filled says “check this”.'; }
  else h='';
  el.className=(rd.pending>0||rd.cur||rd.msg)&&!rd.fail?'busy':''; el.innerHTML=h+((rd.pending>0||rd.cur)&&!rd.fail?'<i><u style="width:'+Math.round(100*read/Math.max(1,t))+'%"></u></i>':'');
  el.style.display=h?'block':'none';
  var st=$('nmCardSt'); if(st&&c){ var s=''; if(c.ocrTs) s=c.ocrN?('✨ Read from the photo: '+c.ocrN+' field'+(c.ocrN===1?'':'s')+' filled. Please check them.'):'I couldn’t read this one automatically. Draw a box over the name, or type it and I’ll help.'; else if(c.ocrFail) s='I couldn’t read this one automatically. Draw a box over the name, or type it and I’ll help.'; else if(c.edited&&!c.ocrTs) s=''; else if(!rd.fail&&(rd.cur===c.id)) s='Reading this card…'; else if(!rd.fail&&rd.pending>0) s='Waiting in line to be read…'; st.textContent=s; }
}
function renderNMHints(c){
  var box=$('nmHints'); if(!box) return; var L=c.ocrLow||{}, h='';
  var lab={player:'Player',team:'Team',year:'Year',brand:'Set',serial:'Serial',parallel:'Parallel',surname:'Last name'};
  Object.keys(L).forEach(function(k){ var tgt=k==='surname'?'player':k; if(c[tgt]&&k!=='surname'&&!c.guess[tgt]) return; var vals=L[k].filter(function(x){return String(x.v)!==String(c[tgt])&&!(k==='surname'&&c.player&&c.player.toLowerCase().indexOf(String(x.v).toLowerCase())>=0)}); if(!vals.length) return;
    h+='<div class="hint2"><span>'+lab[k]+', not sure:</span>'+vals.slice(0,3).map(function(x){return '<button type="button" class="chip" data-hk="'+k+'" data-v="'+esc(x.v)+'">'+esc(x.v)+'</button>'}).join('')+'</div>'; });
  box.innerHTML=h?('<div class="hintbox"><small>Low confidence, so I left these blank. Tap one only if it is right.</small>'+h+'</div>'):'';
}
$('nmHints').addEventListener('click',function(e){ var b=e.target.closest('[data-hk]'); if(!b) return; var c=byId(N.ids[N.i]); if(!c) return; var k=b.dataset.hk, tgt=k==='surname'?'player':k, v=b.dataset.v; setGuess(c,tgt,tgt==='year'?+v:v); if(k==='surname'){ var inp=$('nmForm').querySelector('[data-k="player"]'); renderNMForm(c); inp=$('nmForm').querySelector('[data-k="player"]'); if(inp){ inp.focus(); try{ inp.setSelectionRange(0,0); }catch(x){} } } else renderNMForm(c); renderNMHints(c); });
function renderNM(first){
  var c=byId(N.ids[N.i]); if(!c){ finishNM(); return; }
  $('nmN').textContent='Card '+(N.i+1)+' of '+N.ids.length;
  $('nmProg').firstChild.style.width=Math.round(100*N.i/N.ids.length)+'%';
  N.side='front'; drawNMPhoto(c);
  // prefill from the last card you typed (year, set, parallel, raw/graded) only when the reader found nothing for that field. Marked “check this”.
  var pre=false;
  if(!c.edited&&!c.ocrTs&&(c.ocrFail||!(N.rd&&N.rd.pending>0&&!N.rd.fail))){ c.guess=c.guess||{}; if(LAST.sport) c.sport=LAST.sport; if(c.year===''&&LAST.year){c.year=LAST.year;c.guess.year=1;pre=true} if(!c.brand&&LAST.brand){c.brand=LAST.brand;c.guess.brand=1;pre=true} if(!c.parallel&&LAST.parallel){c.parallel=LAST.parallel;c.guess.parallel=1;pre=true} if(LAST.cond){c.cond=LAST.cond; if(LAST.cond==='graded'&&!c.grader&&LAST.grader) c.grader=LAST.grader;} }
  renderNMForm(c,true); renderNMHints(c);
  $('nmPre').textContent=pre?'Year, set and parallel are copied from your last card and marked “check this”. Tap the badge when they are right, or just change them.':'';
  $('nmTeamLast').innerHTML=(LAST.team&&!c.team)?'<div class="sug"><button type="button" data-lt="1">Same team as last: '+esc(LAST.team)+'</button></div>':'';
  $('nmPrev').disabled=N.i<=0; $('nmNext').textContent=N.i>=N.ids.length-1?'Save and finish':'Next ›';
  updateRd();
  if(!first) $('nmBody').scrollTop=0;
}
function renderNMForm(c,first){ var y=$('nmBody').scrollTop, ae=document.activeElement, ak=ae&&ae.dataset&&ae.dataset.k&&$('nmForm').contains(ae)?ae.dataset.k:null, av=ak?ae.value:null; buildForm($('nmForm'),c,['sport','player','team','year','brand','number','serial','parallel','flags','cond'],function(){}); if(ak&&!first){ var ni=$('nmForm').querySelector('[data-k="'+ak+'"]'); if(ni){ ni.value=av; try{ var sp=ae.selectionStart,se=ae.selectionEnd; ni.focus(); ni.setSelectionRange(sp,se); }catch(x){} } } try{ renderNMHelp(c); }catch(e){ log('help render: '+e.message); } if(!first) $('nmBody').scrollTop=y; }
function drawNMPhoto(c){
  var blob=N.side==='front'?(c.front||c.back):(c.back||c.front);
  $('nmImg').src=urlOf(blob); $('nmFl').textContent=(N.side==='front'?'Front':'Back')+((c.back&&c.front)?' · tap to flip':'');
}
$('nmImg').addEventListener('click',function(){ var c=byId(N.ids[N.i]); if(!c||!c.back||!c.front) return; N.side=N.side==='front'?'back':'front'; drawNMPhoto(c); });
$('nmTeamLast').addEventListener('click',function(e){ if(!e.target.closest('[data-lt]')) return; var c=byId(N.ids[N.i]); setField(c,'team',LAST.team); var i=$('nmForm').querySelector('[data-k="team"]'); if(i) i.value=LAST.team; $('nmTeamLast').innerHTML=''; });
function nmStep(d,saved){
  var c=byId(N.ids[N.i]);
  if(c&&saved){ if(c.player) N.named++; try{ if(window.CardGuess) CardGuess.remember(c); }catch(e){} c.edited=true; c.upd=Date.now(); saveCard(c); }
  flush(); var j=N.i+d; if(j<0) return; if(j>=N.ids.length){ finishNM(); return; } N.i=j; renderNM();
}
$('nmNext').addEventListener('click',function(){ nmStep(1,true); });
$('nmPrev').addEventListener('click',function(){ nmStep(-1,false); });
$('nmSkip').addEventListener('click',function(){
  var c=byId(N.ids[N.i]); if(c&&!c.player){ if(!c.named&&c.edited===false&&!c.ocrTs){ c.year='';c.brand='';c.parallel='';c.guess={}; } }
  nmStep(1,false);
});
function nmStopRead(){ if(N.rd) N.rd.stop=true; }
$('nmBack').addEventListener('click',function(){ nmStopRead(); flush(); B.goHome(); });
function finishNM(){
  nmStopRead(); flush(); var left=B.cards.filter(needsName).length, chk=B.cards.filter(function(c){return guessCount(c)>0}).length;
  MC().toast(N.named?('Saved '+N.named+' name'+(N.named===1?'':'s')+'. Nice work.'):'Done for now.',3000);
  B.openBinder('all');
  if(left) setTimeout(function(){ MC().toast(left+' card'+(left===1?'':'s')+' still need a name. You can do it any time.',3200); },3200);
}
/* ---------- v0.10: "read closer" + the help blocks on the Name screen ----------
   After the first read, the reader looks closer at the card (serial stamp, sideways names, set logos, enlarged bottom edge).
   What it is sure of is filled in and marked "check this". Everything else becomes big tap targets next to the field. Nothing leaves this device. */
function HP(){ if(!N.help) N.help={}; return N.help; }
function v10ok(){ return !!(window.CardRead&&window.CardGuess&&window.CardSerial&&window.CardText&&window.CardOCR); }
function readSrc(c,side){ var cl=cleanOf(c,side); return cl&&cl.blob?cl.blob:(c[side]||null); }
function hpPaint(id){ var st=HP()[id]; if(!st||!st.busy||N.ids[N.i]!==id) return; var e=$('hpStep'); if(e) e.textContent=st.step||''; var bar=$('hpBar'); if(bar) bar.style.width=Math.round(100*Math.min(.98,st.frac||0))+'%'; var t=$('hpEl'); if(t) t.textContent=Math.round((Date.now()-st.t0)/1000)+' s'; var l=$('hpLong'); if(l) l.hidden=!(Date.now()-st.t0>20000); }
/* v0.10.4: the Moose Reader runs in a Web Worker (through AppReader). The quick first read is already on screen; this adds the closer look in the background.
   Skip stops it at once. If the reader does not load or runs past the time limit, the built-in reader takes over. */
async function readCloser(c,words){
  var rd=N.rd, id=c.id, st=HP()[id]={busy:true,step:'Starting…',frac:.02,t0:Date.now()}; var cur=function(){ return N.ids[N.i]===id; };
  var gone=function(){ return rd.stop||(N.ids[N.i]!==id&&N.i>N.ids.indexOf(id)); };
  if(cur()) renderNMHelp(c);
  var tick=setInterval(function(){ hpPaint(id); },1000);
  try{
    var r=await AppReader.closer(c,{src:readSrc(c,'front'),backSrc:readSrc(c,'back'),words:words||[],shouldStop:function(){ return gone()||st.skip; },step:function(m){ st.step=m; hpPaint(id); },progress:function(p){ if(p.fallback){ st.fb=1; st.frac=.05; } else if(p.frac!=null) st.frac=Math.max(st.frac,p.frac); hpPaint(id); }});
    if(st.skip){ st.busy=false; st.skipped=true; log('closer '+id+': skipped'); }
    else if(gone()||r.aborted){ HP()[id]={aborted:true}; return false; }
    else if(!r.res){ st.busy=false; st.err=(r.failed&&r.failed.message)||'no reader'; log('closer fail '+id+': '+st.err); }
    else {
      var res=r.res; st.res=res; st.busy=false; st.engine=r.engine; st.fell=r.fellBack||''; st.timedOut=!!r.timedOut; st.partial=!!r.partial; st.ms=Date.now()-st.t0;
      applyCloser(c,res); c.ocr10=Date.now(); saveCard(c); (rd.times=rd.times||{})[id]=st.ms;
      log('closer '+id+': '+st.ms+' ms ['+r.engine+(st.fell?', fell back: '+st.fell:'')+(st.partial?', partial':'')+'], serial '+(res.serial&&res.serial.fill||'-')+', brand '+(res.brand.fill||'-')+', name '+(res.nameFill||'-'));
    }
  }catch(e){ st.busy=false; st.err=String(e&&e.message||e); log('closer fail '+id+': '+st.err); }
  finally{ clearInterval(tick); }
  if(cur()){ renderNMForm(c); updateRd(); }
  return true;
}
/* fill only empty fields, and only what two separate reads agree on. Marked "check this". */
function applyCloser(c,res){
  c.guess=c.guess||{}; var any=0; function fill(k,v){ if(v===''||v==null) return; if(c[k]===''||c[k]==null){ c[k]=(k==='year'?+v:v); c.guess[k]=1; any++; } }
  if(res.serial&&res.serial.fill) fill('serial',res.serial.fill);
  if(res.brand.fill) fill('brand',res.brand.fill);
  if(res.nameFill){ var nf=window.CardAuto?CardAuto.okName(res.nameFill):res.nameFill; if(nf) fill('player',nf); }
  if(res.backYear&&res.backYear.n>=2) fill('year',res.backYear.year);
  try{ if(window.CardAuto) any+=CardAuto.run(c,{low:c.ocrLow||{},names:res.names||[]}).n; }catch(e){ log('auto: '+e.message); }
  if(any){ c.ocrN=(c.ocrN||0)+any; c.ocrTs=c.ocrTs||Date.now(); c.upd=Date.now(); }
}
function hpChip(cls,attr,val,txt){ return '<button type="button" class="hpc '+cls+'" '+attr+'="'+esc(val)+'">'+esc(txt)+'</button>'; }
function setByName(c){ var S=window.CardGuess&&CardGuess.SETS||[]; for(var i=0;i<S.length;i++){ if(c.brand&&(c.brand===S[i][1]||c.brand.indexOf(S[i][1])===0)) return S[i]; } return null; }
function stripCss(c,pos,zoom){ return 'background-image:url('+urlOf(c.front||c.back)+');background-size:'+(zoom||100)+'% auto;background-position:'+pos; }
/* build the help blocks and slide each one in after its field */
function renderNMHelp(c){
  var form=$('nmForm'), top=$('nmHelp'), bot=$('nmHelpB'); if(!form||!top||!bot||!c) return; var st=HP()[c.id]||{}, res=st.res, g=c.guess||{};
  var needSer=(!c.serial||g.serial)&&!c.noSerial, needBrand=!c.brand||g.brand, needName=!c.player||g.player;
  /* top: status, draw-a-box, from your cards, links, back photo */
  var h='';
  if(st.busy) h+='<div class="hpBusy rdB"><span class="hpSpin"></span><div class="rdT"><b>'+(st.fb?'Using the built-in reader…':'Looking closer at this card…')+'</b><small id="hpStep">'+esc(st.step||'')+'</small><div class="rdBar" role="progressbar" aria-label="Reading progress"><i id="hpBar" style="width:'+Math.round(100*Math.min(.98,st.frac||0))+'%"></i></div><small class="rdKeep">You can keep going now: tap a chip, type the name, or draw a box. <span id="hpEl"></span></small><small id="hpLong" hidden>This is taking a while on this phone. I will stop and use the built-in reader soon.</small></div><button type="button" class="hpc rdSkip" data-hp="skipc">Skip</button></div>';
  else if(st.skipped) h+='<div class="pvnote">Skipped. Tap “Look closer” any time, or use the tools below.</div>';
  else if(st.err) h+='<div class="pvnote">The closer look did not finish on this device. You can still use the tools below.</div>';
  if(st.res&&st.res.fellBack&&!st.busy) h+='<div class="pvnote">'+(st.res.fellBack==='timeout'?'The close reader was too slow on this phone, so I used the built-in reader.':'The close reader would not start, so I used the built-in reader.')+' The tools below still work.</div>';
  else if(st.res&&st.res.partial&&!st.busy) h+='<div class="pvnote">I ran out of time, so this is a partial look. The tools below still work.</div>';
  if(!st.busy&&!res&&!c.ocr10&&v10ok()&&(c.ocrTs||c.ocrFail||c.edited)) h+='<div class="hpRow"><button type="button" class="hpb" data-hp="closer">🔎 Look closer at this card</button></div>';
  h+='<div class="hpRow"><button type="button" class="hpb gold" data-hp="box">✏️ Draw a box on the photo to read it</button></div>';
  var fc=res&&res.fromCatalog||[]; if(fc.length&&(needName||needBrand)){
    h+='<div class="hpBlk"><div class="hpT">From your cards <small>you saved these before</small></div><div class="hpRow">'+fc.map(function(e,i){ return hpChip('wide','data-cat',i,e.player+' · '+[e.year,e.brand].filter(Boolean).join(' ')+(e.team?' · '+e.team.replace(/^.*\s/,''):'')+(e.den?' · /'+e.den:'')); }).join('')+'</div></div>'; }
  top.innerHTML=h; h='';
  if(!c.back&&!c.backAsked&&(res||c.ocr10)&&(needBrand||needSer)){
    h+='<div class="hpBlk soft"><div class="hpT">Back of the card handy? <small>It usually names the set and year. Optional.</small></div><div class="hpRow"><button type="button" class="hpb" data-hp="back">📷 Add the back photo</button><button type="button" class="hpb ghost" data-hp="noback">Not now</button></div></div>'; }
  var set=setByName(c), links=window.CardGuess?CardGuess.links({year:c.year,brand:c.brand,player:c.player,team:c.team,den:window.CardGuess?CardGuess.denOf(c.serial):'',set:set}):[];
  if(links.length&&(c.player||c.brand)) h+='<details class="hpBlk hpLinks"><summary>🔍 Search the web for this card</summary><div class="hpRow col">'+links.map(function(l){ return '<a class="hpa" target="_blank" rel="noopener noreferrer" href="'+esc(l.url)+'">'+esc(l.label)+' ↗</a>'; }).join('')+'<small>These open in your browser and send nothing from this app. Come back and tap the details you find.</small></div></details>';
  bot.innerHTML=h;
  /* blocks that sit under their field */
  function after(key,html){ var old=form.querySelector('.hpAt[data-at="'+key+'"]'); if(old) old.remove(); if(!html) return; var inp=form.querySelector('[data-k="'+key+'"]'); var fld=inp&&inp.closest('.fld'); if(!fld) return; var d=document.createElement('div'); d.className='hpAt'; d.dataset.at=key; d.innerHTML=html; fld.appendChild(d); }
  /* name */
  var nm='';
  if(needName&&res&&res.names.length){ var seen={}; var chips=res.names.filter(function(n){ var t=n.name+n.jr; if(seen[t]||t===c.player) return false; seen[t]=1; return n.n>=2&&(n.name.split(' ')[1]||'').length>=4; }).slice(0,2);
    if(chips.length) nm='<div class="hpT">Is it one of these? <small>tap if right</small></div><div class="hpRow">'+chips.map(function(n){ return hpChip('','data-nm',n.name+n.jr,n.name+n.jr); }).join('')+'</div>'; }
  after('player',nm);
  /* brand */
  var bh='';
  if(needBrand){
    var readNames=[]; (res&&res.brand.ranked||[]).slice(0,4).forEach(function(r){ readNames.push(r.set[1]); });
    var chips2=CardGuess.brandChips(c,readNames,LAST.brand).slice(0,10);
    bh+='<div class="hpT">Set <small>tap one, or type it above</small></div>';
    if(res&&res.strips) bh+='<img class="hpCrop" alt="Zoom on the bottom of the card" src="'+res.strips.bottom+'"><img class="hpCrop" alt="Zoom on the top of the card" src="'+res.strips.top+'">';
    bh+='<div class="hpRow">'+chips2.map(function(x){ return hpChip(x.why==='read'?'read':'','data-br',x.n,(x.why==='read'?'👀 ':'')+x.n); }).join('')+'</div>';
    var gs=(res&&res.guesses||[]).slice(0,3); if(gs.length){ bh+='<div class="hpT">Looks like <small>check this</small></div>'+gs.map(function(x,i){ return '<div class="hpG"><span>'+esc(x.label)+'</span><button type="button" class="hpc" data-gu="'+i+'">Use</button></div>'; }).join(''); }
  }
  if(st.yearFor&&st.yearFor.years&&st.yearFor.years.length&&(!c.year||g.year)) bh+='<div class="hpT">Which year? <small>the © line on the back says</small></div><div class="hpRow">'+st.yearFor.years.map(function(y){ return hpChip('','data-yr',y,y); }).join('')+'</div>';
  after('brand',bh);
  /* serial */
  var sh='';
  if(c.noSerial) sh='<div class="hpRow"><small>Marked “not numbered”.</small><button type="button" class="hpc ghost" data-hp="numbered">Undo</button></div>';
  else if(needSer){
    var sg=(c.serial&&g.serial)?[]:((res&&res.serial&&res.serial.suggest)||[]).filter(function(x){ return x.n>=2&&x.text!==c.serial; }).slice(0,3);
    sh+='<div class="hpT">Serial number <small>the “07/10” stamp, if there is one</small></div>';
    var crop=res&&res.crop; if(crop) sh+='<img class="hpCrop" alt="Zoom on the serial area" src="'+crop+'">';
    else sh+='<div class="pvnote">Look at the bottom edge of the card in the photo, or draw a box around the stamp.</div>';
    if(c.serial&&g.serial) sh+='<div class="hpRow"><small>I read <b>'+esc(c.serial)+'</b>. Does the zoom agree?</small></div>';
    sh+='<div class="hpRow">'+(c.serial&&g.serial?hpChip('ok','data-sok','1','✓ Yes, '+c.serial):'')+sg.map(function(x){ return hpChip('big','data-ss',x.text,x.text); }).join('')+'<button type="button" class="hpc big key" data-hp="kp">⌨ Type it</button><button type="button" class="hpc big" data-hp="nn">Not numbered</button></div>';
  }
  after('serial',sh);
}
/* clicks on the help blocks (they live inside #nmR) */
$('nmR').addEventListener('click',function(e){
  var b=e.target.closest('[data-hp],[data-nm],[data-br],[data-gu],[data-yr],[data-ss],[data-sok],[data-cat]'); if(!b||!$('nmR').contains(b)) return; var c=byId(N.ids[N.i]); if(!c) return; var st=HP()[c.id]||{}, res=st.res, d=b.dataset;
  function setF(k,v){ setField(c,k,v); }
  if(d.hp==='box'){ openBox(c); return; }
  if(d.hp==='kp'){ openKeypad(c); return; }
  if(d.hp==='nn'){ c.noSerial=true; if(c.guess&&c.guess.serial&&c.serial){ c.serial=''; delete c.guess.serial; } saveCard(c); renderNMForm(c); return; }
  if(d.hp==='numbered'){ c.noSerial=false; saveCard(c); renderNMForm(c); return; }
  if(d.hp==='noback'){ c.backAsked=1; saveCard(c); renderNMHelp(c); return; }
  if(d.hp==='back'){ $('nmBackFile').click(); return; }
  if(d.hp==='skipc'){ var sk=HP()[c.id]; if(sk&&sk.busy){ sk.skip=true; if(window.AppReader) AppReader.cancel(); } return; }
  if(d.hp==='closer'){ if(!v10ok()){ MC().toast('The reader files are missing.'); return; } if(window.CardOCR) CardOCR.init(function(){}).then(function(){ readCloser(c,[]); }); return; }
  if(d.nm){ setF('player',d.nm); renderNMForm(c); return; }
  if(d.br){ setF('brand',d.br); st.yearFor=null; var S=setByName(c); if(S&&S[4]&&S[4].length&&!c.year){ st.yearFor={years:S[4]}; HP()[c.id]=st; } renderNMForm(c); return; }
  if(d.gu!==undefined){ var gq=res&&res.guesses[+d.gu]; if(!gq) return; setF('brand',gq.brand); if(gq.years&&gq.years.length&&(!c.year||(c.guess&&c.guess.year))) st.yearFor=gq; if(gq.sub==='Autographs'&&!c.auto){ c.auto=true; c.guess=c.guess||{}; c.guess.flags=1; } renderNMForm(c); return; }
  if(d.yr){ setF('year',d.yr); st.yearFor=null; renderNMForm(c); return; }
  if(d.ss){ setF('serial',d.ss); renderNMForm(c); return; }
  if(d.sok){ if(c.guess) delete c.guess.serial; c.edited=true; saveCard(c); renderNMForm(c); return; }
  if(d.cat!==undefined){ var en=res&&res.fromCatalog[+d.cat]; if(!en) return; if(en.player&&(!c.player||(c.guess&&c.guess.player))) setF('player',en.player); if(en.brand&&(!c.brand||(c.guess&&c.guess.brand))) setF('brand',en.brand); if(en.year&&(!c.year||(c.guess&&c.guess.year))) setF('year',en.year); if(en.team&&!c.team) setF('team',en.team); renderNMForm(c); return; }
});
/* back photo, added from the Name screen */
$('nmBackFile').addEventListener('change',async function(){
  var f=this.files&&this.files[0]; this.value=''; var c=byId(N.ids[N.i]); if(!f||!c) return;
  c.back=f; c.bsize=f.size; c.backAsked=1; c.upd=Date.now(); delete HP()[c.id]; c.ocr10=0; saveCard(c); drawNMPhoto(c); MC().toast('Back photo added. Looking at it now.',2200);
  if(!v10ok()) return; try{ await CardOCR.init(function(){}); }catch(e){ return; } N.rd=N.rd||{stop:false}; if(N.rd.stop) N.rd.stop=false; var snap=JSON.stringify([c.brand,c.year,c.serial,c.player]); try{ await readCloser(c,[]); }catch(e){} var now=JSON.stringify([c.brand,c.year,c.serial,c.player]); MC().toast(now!==snap?'The back told me something. Please check it.':'I looked at the back. Nothing new to fill in, so type or tap what you see.',3600);
});
/* ----- big number keypad for a serial like 07/10 ----- */
var KP={c:null,num:'',den:'',f:'num'};
var DENS=['1','5','10','25','49','50','75','99','150','199','250','499'];
function openKeypad(c,pre){
  KP.c=c; var m=String(pre||'').match(/(\d+)\s*\/\s*(\d+)/)||String(c.serial||'').match(/^(\d+)\s*\/\s*(\d+)$/); KP.num=m?m[1]:''; KP.den=m?m[2]:''; KP.f=KP.num||!KP.den?(KP.num?'den':'num'):'num'; if(!m) KP.f='num';
  var st=HP()[c.id]||{}, res=st.res, crop=(res&&res.crop)||'';
  $('kpCrop').innerHTML=crop?'<img alt="Zoom on the serial area" src="'+crop+'">':'';
  var sg=((res&&res.serial&&res.serial.suggest)||[]).filter(function(x){return x.n>=2;}).slice(0,3); $('kpSug').innerHTML=sg.length?('<small>I read:</small> '+sg.map(function(x){return hpChip('big','data-kps',x.text,x.text);}).join('')):'';
  $('kpDens').innerHTML=DENS.map(function(d){ return hpChip('','data-kd',d,'/'+d); }).join('')+hpChip('','data-kd','1/1','1 of 1');
  kpDraw(); $('kpOv').hidden=false; document.body.classList.add('ovOpen');
}
function kpDraw(){ var n=$('kpNum'),d=$('kpDen'); n.textContent=KP.num||'__'; d.textContent=KP.den||'__'; n.className=(KP.f==='num'?'on ':'')+(KP.num?'':'ph'); d.className=(KP.f==='den'?'on ':'')+(KP.den?'':'ph');
  var ok=!!KP.den, ok2=$('kpOk'); ok2.disabled=!ok; ok2.textContent=ok?('Use '+(KP.num?KP.num:'')+'/'+KP.den+(KP.num?'':' (number unknown)')):'Type the print run first, like 10'; }
function kpKey(k){ var f=KP.f==='num'?'num':'den'; if(k==='b'){ KP[f]=KP[f].slice(0,-1); } else if(k==='c'){ KP.num=''; KP.den=''; KP.f='num'; } else if(k==='/'){ KP.f='den'; } else if(KP[f].length<4){ KP[f]+=k; } kpDraw(); }
$('kpOv').addEventListener('click',function(e){
  var t=e.target.closest('button'); if(!t) { if(e.target===$('kpOv')) closeKeypad(); return; }
  if(t.id==='kpNum'){ KP.f='num'; kpDraw(); return; } if(t.id==='kpDen'){ KP.f='den'; kpDraw(); return; }
  if(t.dataset.k){ kpKey(t.dataset.k); return; }
  if(t.dataset.kd){ var v=t.dataset.kd; if(v==='1/1'){ KP.num='1'; KP.den='1'; } else { KP.den=v; KP.f='num'; } kpDraw(); return; }
  if(t.dataset.kps){ var m=t.dataset.kps.match(/(\d+)\/(\d+)/); if(m){ KP.num=m[1]; KP.den=m[2]; kpDraw(); } return; }
  if(t.id==='kpOk'){ if(!KP.den) return; var c=KP.c, v2=(KP.num?KP.num:'')+'/'+KP.den; c.noSerial=false; setField(c,'serial',v2); closeKeypad(); if(N.ids[N.i]===c.id) renderNMForm(c); if(KP.after) KP.after(v2); return; }
  if(t.id==='kpNo'){ var c2=KP.c; c2.noSerial=true; if(c2.serial&&c2.guess&&c2.guess.serial){ c2.serial=''; delete c2.guess.serial; } saveCard(c2); closeKeypad(); if(N.ids[N.i]===c2.id) renderNMForm(c2); return; }
  if(t.id==='kpCancel'){ closeKeypad(); return; }
});
function closeKeypad(){ $('kpOv').hidden=true; KP.after=null; if($('bxOv').hidden) document.body.classList.remove('ovOpen'); }
/* ----- draw a box on the photo ----- */
var BX={c:null,side:'front',kind:'name',box:null,busy:false,tok:0};
function openBox(c){ BX.c=c; BX.side=(N.side==='back'&&c.back)?'back':'front'; BX.box=null; BX.kind=BX.kind||'name'; $('bxImg').src=urlOf(BX.side==='back'?c.back:(c.front||c.back)); $('bxRect').style.display='none'; $('bxRes').innerHTML='<div class="pvnote">Drag a box around the printed name, serial number or set name. I will read just that part, bigger and several ways.</div>';
  $('bxFlip').style.display=(c.front&&c.back)?'':'none'; bxKindUI(); $('bxOv').hidden=false; document.body.classList.add('ovOpen'); }
function bxKindUI(){ [].forEach.call($('bxKind').children,function(b){ b.classList.toggle('on',b.dataset.kind===BX.kind); }); }
function closeBox(){ if(!BX.c) return; BX.tok++; $('bxOv').hidden=true; if($('kpOv').hidden) document.body.classList.remove('ovOpen'); if(BX.from==='ls'){ BX.from=null; var lc=byId(BX.c.id)||BX.c; try{ if(window.CardAuto) CardAuto.run(lc,{},{noRead:true}); }catch(e){} saveCard(lc); renderLS(); showOcr(lc,LS_O||{players:[],years:[],teams:[],serials:[],numbers:[],brands:[],flags:[],graders:[],grades:[],certs:[],got:[]}); return; } renderNMForm(BX.c); }
(function(){
  var st=$('bxStage'), rect=$('bxRect'), p0=null;
  function pos(e){ var r=$('bxImg').getBoundingClientRect(); return {x:Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)),y:Math.min(1,Math.max(0,(e.clientY-r.top)/r.height)),r:r}; }
  function draw(a,b){ var r=$('bxImg').getBoundingClientRect(), s=st.getBoundingClientRect(); var x0=Math.min(a.x,b.x),x1=Math.max(a.x,b.x),y0=Math.min(a.y,b.y),y1=Math.max(a.y,b.y); rect.style.display='block'; rect.style.left=(r.left-s.left+x0*r.width)+'px'; rect.style.top=(r.top-s.top+y0*r.height)+'px'; rect.style.width=((x1-x0)*r.width)+'px'; rect.style.height=((y1-y0)*r.height)+'px'; return [x0,y0,x1,y1]; }
  st.addEventListener('pointerdown',function(e){ if(e.target.closest('button')) return; p0=pos(e); try{ st.setPointerCapture(e.pointerId); }catch(x){} BX.tok++; e.preventDefault(); });
  st.addEventListener('pointermove',function(e){ if(!p0) return; BX.box=draw(p0,pos(e)); });
  function end(e){ if(!p0) return; var b=BX.box; p0=null; if(!b||(b[2]-b[0])<.03||(b[3]-b[1])<.02){ BX.box=null; rect.style.display='none'; $('bxRes').innerHTML='<div class="pvnote">That box is too small. Drag a bit larger, around the whole word or number.</div>'; return; } bxRead(); }
  st.addEventListener('pointerup',end); st.addEventListener('pointercancel',end);
})();
/* v0.10.4: a drawn box goes to the Moose Reader (its own worker, so it never waits behind a full read); the built-in box reader is the fallback */
function bxSerialOK(v){ var m=/^(\d{1,4})\s*\/\s*(\d{1,4})$/.exec(String(v).trim()); if(!m) return false; try{ return window.CardSerial&&CardSerial.plausible?CardSerial.plausible(+m[1],+m[2]):(+m[1]<=+m[2]&&+m[2]>=2); }catch(e){ return true; } }
function bxReaderChips(rr,kind,c){
  var out=[], seen={}; function add(v){ v=String(v||'').trim(); var k=v.toLowerCase(); if(!v||seen[k]) return; seen[k]=1; out.push(v); }
  ((rr&&rr.candidates)||[]).slice().sort(function(a,b){ return (b.confidence||0)-(a.confidence||0); }).forEach(function(x){
    var v=String(x.value==null?'':x.value).trim(); if(!v) return;
    if(kind==='serial'){ if(bxSerialOK(v)) add(v.replace(/\s+/g,'')); }
    else if(kind==='name'){ if(v.replace(/[^A-Za-z]/g,'').length>=4) add(v); }
    else { var bn=window.AppReader&&AppReader._brandName?AppReader._brandName(v):{name:v}; if(v.replace(/[^A-Za-z]/g,'').length>=3) add(bn.name); } });
  return out.slice(0,4);
}
async function bxRead(){
  var c=BX.c, box=BX.box, kind=BX.kind, tok=++BX.tok; if(!box||!c) return; var res=$('bxRes'); res.innerHTML='<div class="hpBusy"><span class="hpSpin"></span><div><b>Reading just this box…</b><small>a few seconds. You can drag a new box any time.</small></div></div>';
  var blob=BX.side==='back'?c.back:(c.front||c.back), crop='', im=null, h='', t0=Date.now();
  try{
    try{ if(window.CardOCR){ await CardOCR.init(function(){}); im=await CardOCR.loadImg(blob); crop=CardRead.cropToURL(im,box,.01,640); if(tok===BX.tok) res.innerHTML='<img class="hpCrop" alt="What I looked at" src="'+crop+'"><div class="hpBusy"><span class="hpSpin"></span><div><b>Reading just this box…</b><small>a few seconds</small></div></div>'; } }catch(e){}
    var rr=null; if(window.AppReader){ try{ rr=await AppReader.readRegion(blob,box,{kind:kind==='serial'?'serial':(kind==='name'?'name':'text'),shouldStop:function(){ return tok!==BX.tok; }}); }catch(e){ rr=null; } }
    if(tok!==BX.tok) return;
    var chips=(rr&&rr.engine==='moose-reader')?bxReaderChips(rr,kind,c):[]; window.__bxLast={engine:rr&&rr.engine,chips:chips,ms:Date.now()-t0};
    if(chips.length){
      h=(crop?'<img class="hpCrop" alt="What I looked at" src="'+crop+'">':'')+'<div class="hpT">I think it says <small>check this against the picture</small></div><div class="hpRow">'+chips.map(function(k){ return hpChip('big','data-bs',k,k); }).join('')+'</div>';
      if(kind==='serial') h+='<div class="hpRow"><button type="button" class="hpc big key" data-bx="kp">⌨ Type it</button><button type="button" class="hpc big" data-bx="nn">Not numbered</button></div>';
      else h+='<div class="hpT">Or type it</div><div class="hpRow"><input type="text" id="bxTxt" autocomplete="off" autocapitalize="words" placeholder="'+(kind==='name'?'Player name':'Set name')+'" value="'+esc(chips[0]||'')+'"><button type="button" class="hpc big ok" data-bx="use">Use this</button></div>';
      res.innerHTML=h; return;
    }
    /* nothing from the new reader (or it could not run): the built-in box reader */
    if(!v10ok()) throw new Error('The reader files are missing');
    if(!im){ await CardOCR.init(function(){}); im=await CardOCR.loadImg(blob); crop=CardRead.cropToURL(im,box,.01,640); }
    var reads=await CardText.readBox(im,box,kind==='serial'?'serial':'text',{});
    if(tok!==BX.tok) return; h='<img class="hpCrop" alt="What I looked at" src="'+crop+'">';
    if(kind==='serial'){
      var votes=[]; reads.forEach(function(r){ r.lines.concat([r.lines.join('')]).forEach(function(ln){ String(ln).split(/\s+/).forEach(function(tk){ CardSerial._parseSerial(tk).forEach(function(x){ if(CardSerial.plausible(x.num,x.den)) votes.push(x.num+'/'+x.den); }); }); }); });
      var cnt={}; votes.forEach(function(v){ cnt[v]=(cnt[v]||0)+1; }); var ks=Object.keys(cnt).sort(function(a,b){ return cnt[b]-cnt[a]; }).slice(0,4);
      h+=ks.length?'<div class="hpT">I think it says <small>check this against the picture</small></div><div class="hpRow">'+ks.map(function(k){ return hpChip('big','data-bs',k,k); }).join('')+'</div>':'<div class="pvnote">I could not read a number in that box. Type what you see.</div>';
      h+='<div class="hpRow"><button type="button" class="hpc big key" data-bx="kp">⌨ Type it</button><button type="button" class="hpc big" data-bx="nn">Not numbered</button></div>';
    } else {
      var lines=[]; reads.forEach(function(r,i){ r.lines.forEach(function(ln){ var t=String(ln).replace(/[^A-Za-z\u00C0-\u017F.'\- ]+/g,' ').replace(/\s+/g,' ').trim(); if(t.replace(/[^A-Za-z]/g,'').length>=3) lines.push({t:t,c:r.conf,src:'box'+i}); }); });
      var cnt2={},conf={}; lines.forEach(function(l){ var k=l.t.toUpperCase(); cnt2[k]=(cnt2[k]||0)+1; conf[k]=Math.max(conf[k]||0,l.c); });
      var best=Object.keys(cnt2).sort(function(a,b){ return (cnt2[b]*2+conf[b]/50)-(cnt2[a]*2+conf[a]/50); }).slice(0,4);
      var show=function(s){ return s.split(' ').map(function(w){ return w.charAt(0)+w.slice(1).toLowerCase(); }).join(' '); };
      var chips=[]; if(kind==='name'){ CardGuess.names(lines).slice(0,2).forEach(function(n){ chips.push(n.name+n.jr); }); } else { var tk=CardGuess.tokens(lines); CardGuess.rankSets(tk,c.sport).slice(0,3).forEach(function(r){ chips.push(r.set[1]); }); }
      best.forEach(function(b){ if(chips.length<3&&chips.map(function(x){return x.toUpperCase();}).indexOf(b)<0) chips.push(show(b)); });
      h+=chips.length?'<div class="hpT">I think it says <small>check this against the picture</small></div><div class="hpRow">'+chips.map(function(k){ return hpChip('big','data-bs',k,k); }).join('')+'</div>':'<div class="pvnote">I could not read letters in that box. Try a slightly bigger box, or type it.</div>';
      h+='<div class="hpT">Or type it</div><div class="hpRow"><input type="text" id="bxTxt" autocomplete="off" autocapitalize="words" placeholder="'+(kind==='name'?'Player name':'Set name')+'" value="'+esc(chips[0]||'')+'"><button type="button" class="hpc big ok" data-bx="use">Use this</button></div>';
    }
    res.innerHTML=h;
  }catch(err){ res.innerHTML='<div class="pvnote">I could not read that box ('+esc(err.message||err)+'). Type it instead.</div><div class="hpRow"><input type="text" id="bxTxt" placeholder="Type it here"><button type="button" class="hpc big ok" data-bx="use">Use this</button></div>'; }
}
$('bxOv').addEventListener('click',function(e){
  var t=e.target.closest('button'); if(!t) return; var c=BX.c;
  if(t.id==='bxClose'){ closeBox(); return; }
  if(t.id==='bxFlip'){ BX.side=BX.side==='front'?'back':'front'; $('bxImg').src=urlOf(BX.side==='back'?c.back:c.front); BX.box=null; $('bxRect').style.display='none'; return; }
  if(t.dataset.kind){ BX.kind=t.dataset.kind; bxKindUI(); if(BX.box) bxRead(); return; }
  var kind=BX.kind, put=function(v){ if(kind==='serial'){ c.noSerial=false; setField(c,'serial',v); } else if(kind==='name') setField(c,'player',v); else { setField(c,'brand',v); } MC().toast('Added. Please check it.',1800); closeBox(); };
  if(t.dataset.bs){ if(kind==='serial'||true){ var inp=$('bxTxt'); if(inp&&kind!=='serial'){ inp.value=t.dataset.bs; return; } put(t.dataset.bs); } return; }
  if(t.dataset.bx==='use'){ var v=($('bxTxt')&&$('bxTxt').value||'').trim(); if(!v){ MC().toast('Type or tap something first.'); return; } put(v); return; }
  if(t.dataset.bx==='kp'){ $('bxOv').hidden=true; openKeypad(c); KP.after=null; return; }
  if(t.dataset.bx==='nn'){ c.noSerial=true; saveCard(c); closeBox(); return; }
});

/* Reader for the listing sheet (v0.10.3): the same full reader the Name screen uses, through AppReader (reader-adapter.js).
   Whatever it finds is filled in as "check this" (strong, single answers) or offered as chips (weaker ones). */
var LS_AB=null;
function candList(f,k,min){ return ((f[k]&&f[k].candidates)||[]).filter(function(x){ return x.confidence>=(min||0); }).sort(function(a,b){ return b.confidence-a.confidence; }).map(function(x){ return x.value; }); }
function readLow(r){
  if(r.legacy&&r.legacy.low&&r.legacy.parsed) return r.legacy.low;
  var f=r.fields, low={}, mk=function(k){ return ((f[k]&&f[k].candidates)||[]).map(function(x){ return {v:x.value,c:Math.round(x.confidence*100)}; }); };
  ['team','year','brand','number','serial'].forEach(function(k){ var a=mk(k); if(a.length) low[k]=a; });
  var pl=mk('player'); pl.forEach(function(x){ var tgt=/\s/.test(String(x.v).trim())?'player':'surname'; (low[tgt]=low[tgt]||[]).push(x); }); return low;
}
function applyFields(c,r){
  c.guess=c.guess||{}; var f=r.fields, n=0, got=[]; c.noAuto=c.noAuto||{};
  function take(k,v){ if(v===''||v==null) return; if((c[k]===''||c[k]==null)&&!c.noAuto[k]){ c[k]=(k==='year'?+v:v); c.guess[k]=1; n++; got.push(k); } }
  ['player','team','year','brand','number','serial'].forEach(function(k){ var x=f[k]; if(!x||x.value===''||x.value==null||(x.confidence||0)<(r.engine==='moose-reader'?.5:.6)) return; var v=x.value; if(k==='player'&&window.CardAuto) v=CardAuto.okName(v); take(k,v); });
  ['auto','rookie'].forEach(function(k){ if(f[k]&&f[k].value&&(f[k].confidence||0)>=.6&&!c[k]){ c[k]=true; c.guess.flags=1; n++; got.push(k); } });
  var low=readLow(r); c.ocrLow=low;
  try{ if(window.CardAuto){ var ra=CardAuto.run(c,{low:low,names:(r.legacy&&r.legacy.names)||[]}); n+=ra.n; ra.fields.forEach(function(k){ if(got.indexOf(k)<0) got.push(k); }); } }catch(e){ log('auto: '+e.message); }
  c.ocrTs=Date.now(); c.ocrN=(c.ocrN||0)+n; if(n){ c.upd=Date.now(); } saveCard(c); return got;
}
var LS_BUSY=null;
function lsKeep(fn){ var nm0=$('lsNm')?$('lsNm').value:null, ae=document.activeElement, key=null, sp=null, se=null; if(ae&&$('lsBody')&&$('lsBody').contains(ae)){ key=ae.id?('#'+ae.id):(ae.dataset&&ae.dataset.k?('[data-k="'+ae.dataset.k+'"]'):null); try{ sp=ae.selectionStart; se=ae.selectionEnd; }catch(e){} } fn(); var nm1=$('lsNm'); if(nm1&&nm0&&!nm1.value){ nm1.value=nm0; nm1.dispatchEvent(new Event('input',{bubbles:true})); } if(key){ var n=$('lsBody').querySelector(key); if(n){ try{ n.focus(); if(sp!=null) n.setSelectionRange(sp,se); }catch(e){} } } }
function lsPaint(){ var b=LS_BUSY; if(!b) return; var e=$('rdStep'); if(e) e.textContent=b.step||''; var bar=$('rdBar'); if(bar) bar.style.width=Math.round(100*Math.min(.98,b.frac||0))+'%'; var t=$('rdEl'); if(t) t.textContent=Math.round((Date.now()-b.t0)/1000)+' s'; var l=$('rdLong'); if(l) l.hidden=!(Date.now()-b.t0>20000); }
function fieldsO(f,o,got){
  o=o||{players:[],years:[],teams:[],serials:[],numbers:[],brands:[],flags:[],graders:[],grades:[],certs:[],got:[]};
  function add(a,b,n){ b.forEach(function(v){ if(a.indexOf(v)<0) a.push(v); }); a.length=Math.min(a.length,n); }
  add(o.players,candList(f,'player',.15).filter(function(v){ return /^[A-Za-z][A-Za-z .'\-]{3,}$/.test(String(v)); }),5);
  add(o.years,candList(f,'year',.2),4); add(o.teams,candList(f,'team',.2),4); add(o.serials,candList(f,'serial',.15),4); add(o.numbers,candList(f,'number',.2),4); add(o.brands,candList(f,'brand',.15),4);
  ['rookie','auto','relic'].forEach(function(k){ if(f[k]&&f[k].value&&o.flags.indexOf(k)<0) o.flags.push(k); });
  (got||[]).forEach(function(k){ if(o.got.indexOf(k)<0) o.got.push(k); }); return o;
}
/* v0.10.4: the quick first read shows at once; the Moose Reader (in a Web Worker) adds the closer look; Skip stops it; the built-in reader is the fallback */
async function readFull(c,outId){
  if(!window.AppReader) throw new Error('the reader files are missing');
  if(LS_AB){ try{ LS_AB.abort(); }catch(e){} } LS_AB=window.AbortController?new AbortController():null; var ab=LS_AB, sig=ab&&ab.signal;
  var busy=LS_BUSY={c:c.id,t0:Date.now(),step:'Starting…',frac:.02,skip:false}, o=null, partialDone=false;
  var src=readSrc(c,'front')||readSrc(c,'back'), bsrc=(c.front&&c.back)?readSrc(c,'back'):null, sport=c.sport||'Baseball';
  var tick=setInterval(lsPaint,1000);
  var stop=function(){ return busy.skip||(sig&&sig.aborted); };
  if(window.CardOCR&&!CardOCR.state.ready) busy.step='Getting the reader ready (about 7 MB, once)…';
  lsKeep(function(){ showOcr(c,LS_O||fieldsO({},null,[])); });
  /* 1) the quick first read, shown straight away */
  var quickP=AppReader.quick(src,{sport:sport,shouldStop:stop}).then(function(q){
    if(stop()||!q||q.empty) return; var got=applyFields(c,q); o=fieldsO(q.fields,null,got); LS_O=o; partialDone=!!got.length; busy.q=q;
    lsKeep(function(){ renderLS(); showOcr(byId(L.id)||c,LS_O); }); log('ls first pass: '+(got.join(',')||'nothing filled')); }).catch(function(e){ log('ls quick fail: '+(e&&e.message||e)); });
  /* 2) the closer look, in the worker */
  var r=await AppReader.read(src,{backImage:bsrc,sport:sport,signal:sig,shouldStop:stop,onProgress:function(p){ if(p.fallback){ busy.fb=1; busy.frac=.05; } if(p.text) busy.step=p.text; if(p.frac!=null) busy.frac=Math.max(busy.frac,p.frac); lsPaint(); }});
  await quickP; clearInterval(tick);
  var ms=Date.now()-busy.t0; LS_BUSY=null;
  if(busy.skip){ log('ls read skipped after '+ms+' ms'); var oo=o||fieldsO({},null,[]); oo.note='Skipped. '+(partialDone?'The quick read stays. ':'')+'Tap “Try reading the card for me” to run it again.'; return oo; }
  if(r.aborted||(sig&&sig.aborted)) return null;
  var got=applyFields(c,r); o=fieldsO(r.fields,o,got); o.engine=r.engine; o.ms=ms; o.fell=r.fellBack||''; o.partial=!!r.partial;
  if(o.fell) o.note=(o.fell==='timeout'?'The close reader was too slow on this phone, so I used the built-in reader.':(o.fell==='empty'?'The close reader found nothing, so I also tried the built-in reader.':'The close reader would not start, so I used the built-in reader.'))+' The tools here still work.';
  else if(o.partial) o.note='I ran out of time, so this is a partial look. The tools here still work.';
  window.__lsLast={engine:r.engine,ms:ms,fell:o.fell,partial:o.partial}; log('ls read '+ms+' ms ['+r.engine+(o.fell?', fell back: '+o.fell:'')+'] filled '+(got.join(',')||'nothing'));
  return o;
}
var FLD_NAME={player:'player',team:'team',year:'year',brand:'set',number:'card number',serial:'serial number',sport:'sport',auto:'autograph',rookie:'rookie'};

/* ---------- Clean up all photos (binder view) ---------- */
function cleanTodo(list){ var t=[]; list.forEach(function(c){ ['front','back'].forEach(function(sd){ if(c[sd]&&!cleanOf(c,sd)) t.push({c:c,s:sd}); }); }); return t; }
var CL={run:false,stop:false};
$('bvClean').addEventListener('click',function(){
  var todo=cleanTodo(viewCards()); if(!todo.length||CL.run) return;
  MC().askDlg('Clean up '+todo.length+' photo'+(todo.length===1?'':'s')+'?','This straightens each photo and evens out the light, on this phone. The card itself is never changed, and your originals are always kept. It takes a second or two per photo. You can stop any time, and undo when it is done.',[{label:'Start',cls:'gold',fn:function(){ setTimeout(cleanAll,60); }},{label:'Not now',cls:'ghost'}]);
});
async function cleanAll(){
  var todo=cleanTodo(viewCards()); if(!todo.length) return;
  CL.run=true; CL.stop=false; var ok=0, fb=0, fail=0, made=[], ov=$('cln'); ov.classList.add('on'); $('clnX').disabled=false; $('clnX').textContent='Stop';
  for(var i=0;i<todo.length;i++){
    if(CL.stop) break; var t=todo[i];
    $('clnS').textContent='Photo '+(i+1)+' of '+todo.length; $('clnP').firstChild.style.width=Math.round(100*i/todo.length)+'%'; await sleep(25);
    try{ var r=await cleanSide(t.c,t.s); if(r){ made.push(t); ok++; if(!r.quadFound) fb++; } }catch(e){ fail++; log('cleanall fail: '+(e&&e.message||e)); }
  }
  ov.classList.remove('on'); CL.run=false; renderBV();
  var msg=(ok?('Cleaned '+ok+' photo'+(ok===1?'':'s')+'. ' ):'No photos were cleaned. ')+(fb?(fb+' could not be straightened (I could not find the card edges), so only the light was tidied. '):'')+(fail?(fail+' did not work and were left as they were. '):'')+'Your originals are all still there.';
  MC().askDlg(CL.stop?'Stopped':(ok?'All done':'Nothing changed'),msg,[{label:'Keep them',cls:'gold'}].concat(ok?[{label:'Undo all of these',cls:'ghost',fn:function(){ undoMade(made); }}]:[]));
}
async function undoMade(made){ for(var i=0;i<made.length;i++){ var t=made[i]; if(t.c.clean) delete t.c.clean[t.s]; await refreshCThumb(t.c); t.c.upd=Date.now(); await put('cards',t.c); } renderBV(); MC().toast('Undone. Your originals are as they were.'); }
$('clnX').addEventListener('click',function(){ CL.stop=true; $('clnX').disabled=true; $('clnX').textContent='Stopping…'; });

/* ---------- Listing sheet ---------- */
var L={id:null};
B.openListing=function(id){ var c=byId(id); if(!c) return; flush(); L.id=id; ensureDrafts(c); MC().show('ls'); renderLS(); $('lsBody').scrollTop=0; };
function lsPhoto(c){ var cl=cleanOf(c,'front')||cleanOf(c,'back'); return cl&&c.cthumb?c.cthumb:(c.thumb||c.front||c.back); }
function guessCount(c){ return Listing.guessed(c).length; }
function lsChk(c){
  var n=guessCount(c), el=$('lsChk'); if(!el) return;
  el.innerHTML=n?('<span class="chk-n">'+n+' thing'+(n===1?'':'s')+' marked “check this”</span> <button type="button" class="chip" id="lsAllOk">They all look right</button>'):'<span class="ok-n">Nothing waiting to be checked ✓</span>';
}
function renderLS(){
  var c=byId(L.id); if(!c){ MC().show('cd'); return; } var y=$('lsBody').scrollTop; ensureDrafts(c);
  $('lsIntro').textContent='A draft for you to review and edit. Nothing is sent anywhere, and no price is suggested. Anything marked “check this” was guessed. Tap the badge once you have checked it.';
  $('lsTop').innerHTML='<div class="lscard"><img src="'+urlOf(lsPhoto(c))+'" alt=""><div><b>'+esc(cardTitle(c))+'</b><span id="lsChk"></span>'+(hasClean(c)?'<small>Using your cleaned photos. Your originals are kept.</small>':'<small>Tip: “Clean up photo” on the card makes straighter photos for a listing.</small>')+'</div></div>'+
    '<button class="ghost-btn dbtn2" id="lsRead"'+(LS_BUSY?' disabled':'')+'>✨ Try reading the card for me<small>Optional. Reads the photo on this phone and suggests names, year, set, serial number and more. Anything you tap is marked “check this”.</small></button><div id="lsOcr"></div>';
  buildForm($('lsForm'),c,['sport','player','team','year','brand','number','serial','parallel','flags','cond','condNotes','flaws','flawText'],function(k){ lsSaved(); lsChk(c); });
  $('lsTextH').style.display='block';
  buildForm($('lsText'),c,['title','desc','price'],function(){ lsSaved(); });
  $('lsAct').innerHTML='<button class="gold-btn" id="lsCopy">Copy listing text</button><div class="pvnote">Copies the title and description so you can paste them into eBay or anywhere else. Photos are not copied. Save them from the card, or use the photo zip on the Backup tab.</div>'+
    '<button class="ghost-btn dbtn" id="lsCsv">Download this card’s listing (CSV)<small>Draft for review, not an official eBay file. No eBay connection.</small></button>'+
    '<button class="ghost-btn" id="lsDone" style="width:100%">‹ Back to the card</button>';
  lsChk(c); $('lsBody').scrollTop=y;
}
function lsSaved(){ var el=$('lsSaved'); if(el) el.textContent='Saved ✓'; }
$('lsBack').addEventListener('click',function(){ lsLeave(); });
function lsLeave(){ if(LS_BUSY){ LS_BUSY.skip=true; try{ AppReader.cancel(); }catch(e){} } flush(); MC().show('cd'); renderCD(); }
$('lsTop').addEventListener('click',async function(e){
  var c=byId(L.id); if(!c) return;
  if(e.target.closest('#lsAllOk')){ c.guess={}; c.edited=true; saveCard(c); renderLS(); return; }
  var oc=e.target.closest('[data-oc]'); if(oc){ var k=oc.dataset.oc, v=oc.dataset.v;
    if(k.indexOf('flag:')===0){ c[k.slice(5)]=true; c.guess=c.guess||{}; c.guess.flags=1; c.edited=true; saveCard(c); }
    else setGuess(c,k,v==='' ?'':(k==='year'?+v:v));
    if(k==='grader'||k==='grade'||k==='cert'){ c.cond='graded'; saveCard(c); }
    renderLS(); showOcr(c,LS_O); return; }
  if(e.target.closest('#lsRead')){ var btn=$('lsRead'); if(btn.disabled||LS_BUSY) return; btn.disabled=true;
    try{ var o=await readFull(c,'lsOcr'); if(o){ LS_O=o; lsKeep(function(){ renderLS(); showOcr(byId(L.id)||c,LS_O); }); log('ls ocr ok '+o.got.join(',')); } }
    catch(er){ LS_BUSY=null; log('ls ocr fail: '+(er&&er.message||er)); LS_O={players:[],years:[],teams:[],serials:[],numbers:[],brands:[],flags:[],graders:[],grades:[],certs:[],got:[],failed:true}; renderLS(); showOcr(byId(L.id)||c,LS_O); }
    var b2=$('lsRead'); if(b2) b2.disabled=false; return; }
  var ls=e.target.closest('[data-ls]'); if(ls){ lsHelp(c,ls); return; }
});
$('lsTop').addEventListener('input',function(e){ if(e.target.id!=='lsNm') return; var sg=$('lsNmSug'); if(!sg||!window.AppReader) return; var q=e.target.value; var L2=AppReader.suggestNames(q,6);
  sg.innerHTML=L2.length?L2.map(function(x){ return '<button type="button" class="hpc big" data-ls="pick" data-v="'+esc(x.name)+'">'+esc(x.name)+'</button>'; }).join('')+'<div class="why">'+esc(L2[0].why)+'</div>':(q.trim().length>=3?'<div class="why">No match in the list. You can still use what you typed.</div>':''); });
function lsAfterName(c){ try{ if(window.CardAuto) CardAuto.run(c,{},{noRead:true}); }catch(e){} saveCard(c); renderLS(); showOcr(byId(L.id)||c,LS_O||{players:[],years:[],teams:[],serials:[],numbers:[],brands:[],flags:[],graders:[],grades:[],certs:[],got:[]}); }
function lsHelp(c,el){
  var act=el.dataset.ls, inp=$('lsNm'), typed=((inp&&inp.value)||'').trim();
  if(act==='skip'){ if(LS_BUSY){ LS_BUSY.skip=true; if(window.AppReader) AppReader.cancel(); } return; }
  if(act==='box'){ BX.from='ls'; BX.kind='name'; N.side='front'; openBox(c); return; }
  if(act==='pick'){ var v=el.dataset.v; setField(c,'player',v); if(c.guess) delete c.guess.player; c.edited=true; lsAfterName(c); return; }
  if(act==='use'||act==='wd'){ if(typed.length<2){ MC().toast('Type the name first.'); return; }
    if(typed!==c.player){ setField(c,'player',typed); if(c.guess) delete c.guess.player; c.edited=true; }
    if(act==='use'){ lsAfterName(c); return; }
    if(navigator.onLine===false){ lsAfterName(c); MC().toast('The lookup needs an internet connection. The name was saved.',3200); return; }
    lsAfterName(c); setTimeout(function(){ var w=document.querySelector('#lsForm [data-wd]'); if(w) w.click(); else MC().toast('Name saved. Team chips are shown below the player box.',2600); },200); }
}
var LS_O=null;
function showOcr(c,o){
  var out=$('lsOcr'); if(!out||!o) return; var h='', any=false, bz=LS_BUSY&&LS_BUSY.c===c.id?LS_BUSY:null, pin=$('lsNm'), pv=pin?pin.value:null, pf=pin&&document.activeElement===pin, psp=pf?pin.selectionStart:null;
  function grp(lbl,key,arr,cur){ arr=arr.filter(function(x){return String(x)!==String(cur)}); if(!arr.length) return; any=true; h+='<div>'+lbl+'<div class="sg">'+arr.map(function(x){return '<button type="button" data-oc="'+key+'" data-v="'+esc(x)+'" class="chip">'+esc(x)+'</button>'}).join('')+'</div></div>'; }
  grp('Player might be:','player',o.players,c.player); grp('Year might be:','year',o.years,c.year); grp('Team might be:','team',o.teams,c.team); grp('Set might be:','brand',o.brands,c.brand);
  grp('Card number might be:','number',o.numbers,c.number); grp('Serial / print run might be:','serial',o.serials,c.serial);
  var fl=o.flags.filter(function(f){return !c[f]}); if(fl.length){ any=true; h+='<div>Features might be:<div class="sg">'+fl.map(function(f){return '<button type="button" data-oc="flag:'+f+'" data-v="1" class="chip">'+({rookie:'Rookie',auto:'Autograph',relic:'Patch / relic'})[f]+'</button>'}).join('')+'</div></div>'; }
  grp('Grader might be:','grader',o.graders,c.grader); grp('Grade might be:','grade',o.grades,c.grade); grp('Cert number might be:','cert',o.certs,c.cert);
  var got=(o.got||[]).filter(function(k,ix,a){ return a.indexOf(k)===ix&&FLD_NAME[k]; }), msg='';
  if(got.length) msg='<div class="lsRes"><b>✨ I filled in '+got.map(function(k){ return FLD_NAME[k]; }).join(', ')+' from the photo.</b> They say “check this” until you confirm them. Fix or clear anything that is wrong.</div>';
  if(any) msg+='<div class="lsRes">'+(got.length?'<b>Other things I might have seen.</b> ':'<b>Suggestions only. Please check them.</b> ')+'Tap one to use it. It will be marked “check this” until you confirm it.</div>'+h;
  if(!got.length&&!any&&c.player&&!bz) msg='<div class="lsRes"><b>Thanks, the name is in.</b> I could not read the other details from the photo, so please check them below.</div>';
  else if(!got.length&&!any&&!bz) msg='<div class="lsRes lsMiss"><b>I couldn’t read this one automatically.</b> Draw a box over the name, or type it and I’ll help.</div>';
  if(o.note) msg+='<div class="lsRes">'+esc(o.note)+'</div>';
  var need=!c.player||!/\s/.test(String(c.player).trim());
  if(need){ var cur=c.player||''; msg+='<div class="lsHelp"><button type="button" class="hpb gold" data-ls="box">✏️ Draw a box on the photo to read it</button>'+
    '<div class="fld"><label for="lsNm">Or type the player’s name</label><input id="lsNm" type="text" autocomplete="off" autocapitalize="words" placeholder="First and last name" value="'+esc(cur)+'"></div><div id="lsNmSug" class="hpRow"></div>'+
    '<div class="hpRow"><button type="button" class="hpb" data-ls="use">Use this name</button><button type="button" class="hpb" data-ls="wd">🌐 Look up this name online</button></div>'+
    '<small>The lookup is optional and only sends the name text to wikidata.org. No photos, nothing else.</small></div>'; }
  if(!need) msg+='<div class="lsHelp"><button type="button" class="hpb" data-ls="box">✏️ Draw a box to read a name, serial or set</button></div>';
  var bh=bz?'<div class="hpBusy rdB"><span class="hpSpin"></span><div class="rdT"><b>'+(bz.fb?'Using the built-in reader…':'Looking closer at this card…')+'</b><small id="rdStep">'+esc(bz.step||'')+'</small><div class="rdBar" role="progressbar" aria-label="Reading progress"><i id="rdBar" style="width:'+Math.round(100*Math.min(.98,bz.frac||0))+'%"></i></div><small class="rdKeep">'+(any||got.length?'What I have so far is below. ':'')+'You can keep going now: type the name or draw a box. <span id="rdEl"></span></small><small id="rdLong" hidden>This is taking a while on this phone. I will stop and use the built-in reader soon.</small></div><button type="button" class="hpc rdSkip" data-ls="skip">Skip</button></div>':'';
  out.innerHTML=bh+msg+'<small>Auto-read is a helper, not a guarantee. It is often wrong on fancy fonts and shiny cards.</small>'; var ip=$('lsNm'); if(ip&&pv!=null&&pv!==ip.value&&(pf||pv.length>(ip.value||'').length)){ ip.value=pv; } if(ip&&pf){ try{ ip.focus(); ip.setSelectionRange(psp,psp); }catch(e){} } if(need&&ip&&ip.value) ip.dispatchEvent(new Event('input',{bubbles:true}));
}
$('lsAct').addEventListener('click',function(e){
  var c=byId(L.id); if(!c) return;
  if(e.target.closest('#lsCopy')){
    ensureDrafts(c); var txt=Listing.copyText(c,{cleaned:hasClean(c)}), n=guessCount(c);
    var done=function(ok){ MC().toast(ok?('Copied ✓ Paste it into your listing.'+(n?' '+n+' field'+(n===1?' still says':'s still say')+' “check this”.':'')):'Could not copy automatically. Press and hold in the description box to copy it by hand.',ok?3600:4200,!ok); };
    try{ navigator.clipboard.writeText(txt).then(function(){done(true)},function(){ done(legacyCopy(txt)); }); }catch(x){ done(legacyCopy(txt)); }
  }
  else if(e.target.closest('#lsCsv')) exportListingCSV([c]);
  else if(e.target.closest('#lsDone')) lsLeave();
});
function legacyCopy(t){ try{ var ta=document.createElement('textarea'); ta.value=t; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); var ok=document.execCommand('copy'); ta.remove(); return ok; }catch(e){ return false; } }

/* ---------- Backup tab: protect, export / restore, storage ---------- */
async function renderBackup(){
  var usage='';
  try{ if(navigator.storage&&navigator.storage.estimate){ var e=await navigator.storage.estimate(); usage=' \u00b7 using about '+((e.usage||0)/1048576).toFixed(0)+' MB'; } }catch(e){}
  if(B.persist==='unknown'||B.persist==='unsupported') B.persist=await persistStatus();
  var n=B.cards.length;
  var h=protectHTML('data-d',true);
  h+='<div class="kv">'+n+' card'+(n===1?'':'s')+' \u00b7 '+B.binders.length+' custom binder'+(B.binders.length===1?'':'s')+usage+(B.db?'':'<br><b>This browser can\u2019t keep a binder after you close the page.</b>')+'</div>';
  if(B.persist==='off') h+='<button class="ghost-btn dbtn" data-d="persist">Ask the browser to keep my binder safe<small>Optional. Some browsers say no. A backup still covers you.</small></button>';
  h+='<div class="lab">Restore</div>';
  h+='<button class="ghost-btn dbtn" data-d="import">Restore from backup<small>Pick a backup file. I show what\u2019s inside first. Nothing you have is overwritten.</small></button>';
  if(B.lastRestore&&B.lastRestore.ids.length) h+='<button class="ghost-btn dbtn" data-d="undo">Undo last restore<small>Removes the '+B.lastRestore.ids.length+' card'+(B.lastRestore.ids.length===1?'':'s')+' that restore added</small></button>';
  h+='<input type="file" id="impFile" accept=".json,application/json" style="display:none">';
  h+='<div class="lab">Other exports (these are not backups)</div>';
  h+='<button class="ghost-btn dbtn" data-d="csv">Export a spreadsheet (CSV)<small>No photos. Opens in Excel or Sheets. Everything about each card.</small></button>';
  h+='<button class="ghost-btn dbtn" data-d="lcsv">Export listing sheets (CSV)<small>Draft for review, not an official eBay file. No eBay connection.</small></button>';
  h+='<button class="ghost-btn dbtn" data-d="zip">Export photos (zip)<small>Original and cleaned photos, plus your own, named by card</small></button>';
  h+='<div class="lab">Help</div><button class="ghost-btn dbtn" data-d="info">Info / debug panel<small>For screenshots when something feels off</small></button>';
  h+='<div class="pvnote">'+PHNOTE+'</div><div class="legal">Collectors Desk v0.10.4 \u00b7 \u00a9 Mr. Moose Enterprises, LLC. Your photos and details stay on this device.</div>';
  $('paneD').innerHTML=h;
  $('impFile').onchange=function(e){ var f=e.target.files&&e.target.files[0]; e.target.value=''; if(f) importFile(f); };
  refreshTabDot();
}
function refreshTabDot(){ var db=$('tabs').querySelector('[data-t="d"]'); if(db){ var p=prot(); db.classList.toggle('alert',p.lvl==='red'&&p.n>0); } }
$('paneD').addEventListener('click',function(e){
  var b=e.target.closest('[data-d]'); if(!b) return; var a=b.dataset.d;
  if(a==='savebk') exportJSON(); else if(a==='csv') exportCSV(); else if(a==='lcsv') exportListingCSV(B.cards.slice().sort(cmpDate)); else if(a==='zip') exportZip();
  else if(a==='import') $('impFile').click();
  else if(a==='undo') undoRestore();
  else if(a==='persist') askPersist(true);
  else if(a==='info') MC().openInfo();
});
function stamp(){ var d=new Date(); function p(n){return ('0'+n).slice(-2)} return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate()); }
function mbs(b){ return b<1048576?Math.max(1,Math.round(b/1024))+' KB':(b/1048576).toFixed(1)+' MB'; }
/* bk = {start:ms, n:cards} when this file is a backup: only counted as backed up once the share finishes or the download is tapped */
function deliver(blob,name,bk){
  var f=null; try{ f=new File([blob],name,{type:blob.type}); }catch(e){}
  var u=URL.createObjectURL(blob); setTimeout(function(){URL.revokeObjectURL(u)},900000);
  var cs=false; try{ cs=!!(f&&navigator.canShare&&navigator.canShare({files:[f]})); }catch(e){}
  function done(how){ if(!bk) return; lsSet('mc-lastexport',bk.start); var s=nudgeState(); s.newN=0; lsSet('mc-nudge',s); MC().toast(how==='share'?'Backup saved \u2713 '+bk.n+' card'+(bk.n===1?'':'s')+' protected.':'Backup downloaded \u2713 Keep the file somewhere safe.',3800); MC().closeDlg(); afterBackupChange(); }
  var btns=[];
  if(cs) btns.push({label:bk?'Save backup\u2026':'Share / save\u2026',cls:'gold',keep:true,fn:function(){ navigator.share({files:[f],title:name}).then(function(){ done('share'); }).catch(function(er){ if(bk) MC().toast('Not saved. Your backup isn\u2019t counted until you save it.',3600,true); }); return true; }});
  btns.push({label:(cs?'Or download ':'Download ')+name+' ('+mbs(blob.size)+')',cls:cs?'ghost':'gold',href:u,download:name,fn:function(){ setTimeout(function(){ done('dl'); },400); return true; }});
  btns.push({label:bk?'Not now':'Close',cls:'ghost'});
  MC().askDlg(bk?'Your backup is ready':'Your file is ready',bk?('File: '+name+'. '+WHATS_IN+' It counts as backed up once you save it to Files, Drive or email.'):'Keep it somewhere safe, like your Files app, Drive or email to yourself.',btns);
}
function afterBackupChange(){ if(SH&&SH.on&&SH.refresh) SH.refresh(); if(B.tab==='h') renderHomeTab(); else if(B.tab==='d') renderBackup(); else if(B.tab==='b') renderBinders(); refreshTabDot(); if(window.MC&&MC().refreshRevNudge) MC().refreshRevNudge(); }
B.afterBackupChange=afterBackupChange;
function b2d(b){ return b?new Promise(function(res){ var fr=new FileReader(); fr.onload=function(){res(fr.result)}; fr.onerror=function(){res(null)}; fr.readAsDataURL(b); }):Promise.resolve(null); }
async function exportJSON(){
  if(B.exporting) return;
  if(!B.cards.length&&!B.binders.length){ MC().toast('Nothing to back up yet. Scan a card first, then come back here.',3200); return; }
  B.exporting=true; var start=Date.now(), cnt=B.cards.length;
  MC().toast('Packing your backup\u2026',2500);
  try{
  flush();
  var parts=['{"app":"moose-cards-binder","appName":"Collectors Desk","version":"0.10.4","exported":'+JSON.stringify(new Date(start).toISOString())+',"binders":'+JSON.stringify(B.binders)+',"gone":'+JSON.stringify(Object.keys(B.gone))+',"cards":['];
  for(var i=0;i<B.cards.length;i++){
    var c=B.cards[i], o={}; Object.keys(c).forEach(function(k){ if(['front','back','thumb','photos','clean','cthumb'].indexOf(k)<0) o[k]=c[k]; });
    o.front=await b2d(c.front); o.back=await b2d(c.back); o.photos=[]; o.clean={};
    for(var sd=0;sd<2;sd++){ var sn=sd?'back':'front', cl=cleanOf(c,sn); if(cl) o.clean[sn]={data:await b2d(cl.blob),notes:cl.notes,found:cl.found,msg:cl.msg,ts:cl.ts,mode:cl.mode}; }
    for(var j=0;j<(c.photos||[]).length;j++) o.photos.push({id:c.photos[j].id,data:await b2d(c.photos[j].blob)});
    parts.push((i?',':'')+JSON.stringify(o)); if(i%5===4) await sleep(0);
  }
  parts.push(']}');
  deliver(new Blob(parts,{type:'application/json'}),'collectors-desk-backup-'+localDate(start)+'.json',{start:start,n:cnt});
  }finally{ B.exporting=false; }
}
function localDate(t){ var d=new Date(t); function p(n){return ('0'+n).slice(-2)} return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }
function csvEsc(v){ v=v==null?'':String(v); return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }
function titleOf(c){ return [c.year,c.brand,c.player,c.parallel,c.number?'#'+c.number:'',c.cond==='graded'&&c.grader?(c.grader+' '+c.grade):''].filter(function(x){return x!==''&&x!=null}).join(' '); }
function binderNames(c){ return B.binders.filter(function(b){return b.ids.indexOf(c.id)>=0}).map(function(b){return b.name}).join('; '); }
function pad3(n){ return ('000'+n).slice(-3); }
function fileBases(){ var m={}; B.cards.slice().sort(cmpDate).forEach(function(c,i){ m[c.id]='card-'+pad3(i+1)+(c.player?'-'+slug(c.player):''); }); return m; }
function photoNames(c,base){
  var o=[],cl=[],bo='',bc='',fo='',fc='';
  if(c.front) fo=base+'-front-original.jpg'; if(c.back) bo=base+'-back-original.jpg';
  if(cleanOf(c,'front')) fc=base+'-front-cleaned.jpg'; if(cleanOf(c,'back')) bc=base+'-back-cleaned.jpg';
  return {fo:fo,fc:fc,bo:bo,bc:bc,orig:[fo,bo].filter(Boolean).join('; '),cleaned:[fc,bc].filter(Boolean).join('; ')};
}
function exportCSV(){
  if(!B.cards.length){ MC().toast('Nothing to export yet. Scan a card first, then come back here.',3200); return; }
  var H=['Title','Player/Athlete','Team','Year Manufactured','Set','Card Number','Serial / Print Run','Parallel/Variety','Graded','Professional Grader','Grade','Certification Number','Sport','Status','Cost Paid','Sold Price','Profit','Label','Tags','Notes','Placeholder Value (not a price)','Binders','Front Photo (original)','Front Photo (cleaned)','Back Photo (original)','Back Photo (cleaned)','Date Added'];
  var rows=[H.join(',')], bases=fileBases();
  B.cards.slice().sort(cmpDate).forEach(function(c){
    var pf=(c.sold!==''&&c.status==='sold')?(c.sold-(c.cost===''?0:c.cost)):'', pn=photoNames(c,bases[c.id]);
    rows.push([titleOf(c),c.player,c.team,c.year,c.brand,c.number,c.serial,c.parallel,c.cond==='graded'?'Yes':'No',c.cond==='graded'?c.grader:'',c.cond==='graded'?c.grade:'',c.cond==='graded'?c.cert:'',c.sport,c.status,c.cost,c.status==='sold'?c.sold:'',pf,c.label,(c.tags||[]).join('; '),c.notes,c.pv,binderNames(c),pn.fo,pn.fc,pn.bo,pn.bc,localDate(c.ts)].map(csvEsc).join(','));
  });
  deliver(new Blob(['\ufeff'+rows.join('\r\n')],{type:'text/csv'}),'moose-cards-binder-'+stamp()+'.csv',false);
}
function exportListingCSV(list){
  if(!list.length){ MC().toast('Nothing to export yet. Scan a card first, then come back here.',3200); return; }
  flush(); var bases=fileBases(), rows=[Listing.HEADERS.map(csvEsc).join(',')];
  list.forEach(function(c){ var pn=photoNames(c,bases[c.id]); rows.push(Listing.row(c,{orig:pn.orig,cleaned:pn.cleaned}).map(csvEsc).join(',')); });
  deliver(new Blob(['\ufeff'+rows.join('\r\n')],{type:'text/csv'}),'collectors-desk-listing-DRAFT-'+(list.length===1?'1-card-':'')+stamp()+'.csv',false);
}
function slug(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30); }
async function exportZip(){
  if(!B.cards.length){ MC().toast('Nothing to export yet. Scan a card first, then come back here.',3200); return; }
  MC().toast('Packing photos…',2500);
  var files=[], list=B.cards.slice().sort(cmpDate), bases=fileBases(), csv=['card,player,year,team,front_original,front_cleaned,back_original,back_cleaned,my_photos'], anyC=false;
  list.forEach(function(c,i){
    var base=bases[c.id], pn=photoNames(c,base), mine=[];
    if(c.front) files.push({name:pn.fo,blob:c.front}); if(c.back) files.push({name:pn.bo,blob:c.back});
    if(pn.fc){ files.push({name:pn.fc,blob:cleanOf(c,'front').blob}); anyC=true; } if(pn.bc){ files.push({name:pn.bc,blob:cleanOf(c,'back').blob}); anyC=true; }
    (c.photos||[]).forEach(function(p,j){ var n=base+'-mine-'+(j+1)+'.jpg'; files.push({name:n,blob:p.blob}); mine.push(n); });
    csv.push([i+1,c.player,c.year,c.team,pn.fo,pn.fc,pn.bo,pn.bc,mine.join(' ')].map(csvEsc).join(','));
  });
  files.push({name:'cards.csv',blob:new Blob([csv.join('\n')],{type:'text/csv'})});
  files.push({name:'README.txt',blob:new Blob(['Collectors Desk photo export (Mr. Moose Enterprises, LLC)\r\n\r\n-original.jpg  = the photo exactly as you took it.\r\n-cleaned.jpg   = straightened and lighting evened out on your phone. The card itself is unchanged (no scratch, crease or wear touching-up).\r\n-mine-N.jpg    = extra photos you added yourself.\r\n'+(anyC?'':'\r\n(No cleaned photos yet. Use "Clean up photo" on a card.)\r\n')],{type:'text/plain'})});
  var z=await MC().makeZip(files);
  deliver(z,'collectors-desk-photos-'+stamp()+'.zip',false);
}
async function d2b(d){ if(!d) return null; var r=await fetch(d); return await r.blob(); }
async function importFile(file){
  var j; try{ j=JSON.parse(await file.text()); }catch(e){ MC().toast('That file is not a Collectors Desk backup.',3500,true); return; }
  if(!j||j.app!=='moose-cards-binder'||!Array.isArray(j.cards)){ MC().toast('That file is not a Collectors Desk backup.',3500,true); return; }
  var have={}; B.cards.forEach(function(c){have[c.id]=1});
  var inTrash=0; j.cards.forEach(function(c){ if(c&&c.id&&B.trash[c.id]){ have[c.id]=1; inTrash++; } });   // cards in Recently deleted stay there unless you restore them from there
  var trNote=inTrash?(' '+plural(inTrash,'card')+' in this backup '+(inTrash===1?'is':'are')+' in Recently deleted, so I left '+(inTrash===1?'it':'them')+' there.'):'';
  var backGone=j.cards.filter(function(c){ return c&&c.id&&!have[c.id]&&B.gone[c.id]; }).length;
  if(backGone) trNote+=' '+plural(backGone,'card')+' in it '+(backGone===1?'was':'were')+' deleted for good earlier and will come back, because the backup has '+(backGone===1?'it':'them')+'. You can delete '+(backGone===1?'it':'them')+' again.';
  var fresh=j.cards.filter(function(c){return c&&c.id&&!have[c.id]}).length, nb=(j.binders||[]).filter(function(b){return !binderById(b.id)}).length;
  var when1=j.exported?(' Saved '+new Date(j.exported).toLocaleDateString([], {month:'short',day:'numeric',year:'numeric'})+'.'):'';
  if(!fresh){ MC().askDlg('Nothing new in this backup',j.cards.length+' card'+(j.cards.length===1?'':'s')+' found, 0 new. Everything in it is already on this device, so nothing was changed.'+trNote+when1,[{label:'OK',cls:'gold'}]); return; }
  MC().askDlg('Restore from this backup?',j.cards.length+' card'+(j.cards.length===1?'':'s')+' found, '+fresh+' new.'+when1+' New cards are added. Cards you already have are left exactly as they are'+(nb?'. '+nb+' new binder'+(nb===1?'':'s')+' too':'')+'. You can undo it right after.'+trNote,[
    {label:'Add '+fresh+' new card'+(fresh===1?'':'s'),cls:'gold',fn:async function(){
      MC().toast('Restoring\u2026',2500); var ids=[], wasGone={}, newB=[], memb=[];
      for(var i=0;i<j.cards.length;i++){
        var o=j.cards[i]; if(!o||!o.id||have[o.id]) continue;
        var c=newCard(o.id); Object.keys(o).forEach(function(k){ if(['front','back','photos','thumb','clean','cthumb'].indexOf(k)<0) c[k]=o[k]; });
        normCard(c); c.clean={}; c.front=await d2b(o.front); c.back=await d2b(o.back); c.fsize=c.front?c.front.size:0; c.bsize=c.back?c.back.size:0;
        c.photos=[]; for(var p=0;p<(o.photos||[]).length;p++){ var bl=await d2b(o.photos[p].data); if(bl) c.photos.push({id:o.photos[p].id,blob:bl,thumb:await thumb(bl,200)}); }
        if(c.front||c.back) c.thumb=await thumb(c.front||c.back);
        for(var sd=0;sd<2;sd++){ var sn=sd?'back':'front', oc=o.clean&&o.clean[sn]; if(oc&&c[sn]){ var cb=await d2b(oc.data); if(cb) c.clean[sn]={blob:cb,notes:oc.notes||[],found:!!oc.found,msg:oc.msg||'',ts:oc.ts||Date.now(),mode:oc.mode||'raw',src:c[sn].size}; } }
        await refreshCThumb(c);
        if(B.gone[c.id]){ wasGone[c.id]=1; delete B.gone[c.id]; del('gone',c.id); }
        B.cards.push(c); await put('cards',c); ids.push(c.id); have[c.id]=1; if(i%4===3) await sleep(0);
      }
      (j.binders||[]).forEach(function(ob){ var b=binderById(ob.id); if(!b){ b={id:ob.id,name:ob.name,type:ob.type||'collection',ts:ob.ts||Date.now(),ids:[]}; B.binders.push(b); newB.push(b.id); }
        (ob.ids||[]).forEach(function(id){ if(have[id]&&!B.trash[id]&&b.ids.indexOf(id)<0){ b.ids.push(id); if(newB.indexOf(b.id)<0&&ids.indexOf(id)>=0) memb.push([b.id,id]); } }); saveBinder(b); });
      B.lastRestore={ids:ids,wasGone:wasGone,newB:newB,memb:memb};
      askPersist(); afterBackupChange();
      MC().askDlg('Restored \u2713',ids.length+' card'+(ids.length===1?'':'s')+' added to your binder. Nothing you already had was changed.',[{label:'Done',cls:'gold'},{label:'Undo, remove those '+ids.length,cls:'ghost',fn:function(){ undoRestore(); }}]);
    }},{label:'Cancel',cls:'ghost'}]);
}
async function undoRestore(){
  var r=B.lastRestore; if(!r||!r.ids.length){ MC().toast('Nothing to undo.'); return; }
  MC().toast('Undoing\u2026',2000);
  for(var i=0;i<r.ids.length;i++){ var c=byId(r.ids[i]); if(c){ await removeCard(c,false); if(r.wasGone[c.id]){ B.gone[c.id]=1; await put('gone',{id:c.id}); } } }
  r.memb.forEach(function(m){ var b=binderById(m[0]); if(b){ var k=b.ids.indexOf(m[1]); if(k>=0){ b.ids.splice(k,1); saveBinder(b); } } });
  for(var q=0;q<r.newB.length;q++){ var nb=binderById(r.newB[q]); if(nb){ B.binders=B.binders.filter(function(x){return x!==nb}); await del('binders',nb.id); } }
  var n=r.ids.length; B.lastRestore=null; afterBackupChange(); MC().toast('Undone. Removed the '+n+' restored card'+(n===1?'':'s')+'.',3200);
}

/* ---------- v0.10.2: bottom sheet, delete confirm, Recently deleted, duplicates ---------- */
var SH={on:false,fn:null,refresh:null};
function sheetOpen(html,fn){ var bx=$('shBox'), y=bx.scrollTop; bx.innerHTML=html; $('sh').hidden=false; SH.on=true; SH.fn=fn||null; document.body.classList.add('ovOpen'); bx.scrollTop=y; }
function sheetClose(){ $('sh').hidden=true; SH.on=false; SH.fn=null; SH.refresh=null; SH.ctl=null; document.body.classList.remove('ovOpen'); }
$('shBox').addEventListener('click',function(e){ var b=e.target.closest('[data-sh]'); if(!b||b.disabled) return; if(SH.fn) SH.fn(b.dataset.sh,b,e); });
$('sh').addEventListener('click',function(e){ if(e.target===$('sh')){ if(SH.ctl) SH.ctl.cancel=true; sheetClose(); } });
function refreshAfter(){
  if($('bv').classList.contains('on')) renderBV();
  else if($('dp').classList.contains('on')) renderDP();
  else if($('rd').classList.contains('on')) renderRD();
  else if($('home').classList.contains('on')) setTab(B.tab);
}
function dayLabel(t){ var d=new Date(t), now=new Date(), dd=Math.round((new Date(now.getFullYear(),now.getMonth(),now.getDate())-new Date(d.getFullYear(),d.getMonth(),d.getDate()))/864e5); if(dd===0) return 'Today'; if(dd===1) return 'Yesterday'; return d.toLocaleDateString([], {month:'short',day:'numeric',year:d.getFullYear()===now.getFullYear()?undefined:'numeric'}); }
/* the delete confirm: exact count, plain words, back up first (one tap, right here) or just delete */
function confirmDelete(ids,opt){
  opt=opt||{}; ids=ids.filter(function(id){return byId(id)}); if(!ids.length){ MC().toast('Nothing selected.'); return; }
  var n=ids.length;
  function draw(){
    var t=lastBackup(), notIn=0; ids.forEach(function(id){ var c=byId(id); if(c&&Math.max(c.ts||0,c.upd||0)>t) notIn++; });
    var box=!t?'<div class="bk bad"><b>No backup yet.</b> If you might want '+(n===1?'this card':'these photos')+' later, save a backup first. It takes one tap.</div>'
      :notIn===0?'<div class="bk ok"><b>✓ Backed up.</b> '+(n===1?'This card is':'All '+n+' are')+' in your latest backup ('+esc(when(t))+').</div>'
      :'<div class="bk bad"><b>'+(n===1?'This card is':notIn+' of the '+n+' are')+' not in a backup yet.</b> Latest backup: '+esc(when(t))+'. Save one first if you might want '+(n===1?'it':'them')+' later.</div>';
    sheetOpen('<h2>Delete '+plural(n,'card')+'?</h2><p class="shp">'+(opt.lead||'')+(n===1?'It moves':'They move')+' to <b>Recently deleted</b>. You can bring '+(n===1?'it':'them')+' back with one tap for 30 days. After that, '+(n===1?'its photos are':'their photos are')+' removed from this device for good.</p>'+box+
      '<div class="shb"><button class="gold-btn" data-sh="bk">'+(t&&!notIn?'Save a new backup':'Save backup first')+'</button><button class="del-btn" data-sh="go">Delete '+plural(n,'card')+'</button><button class="ghost-btn" data-sh="no">Cancel, keep '+(n===1?'it':'them')+'</button></div><p class="shn">You can delete without a backup. Undo stays on screen for 45 seconds afterwards.</p>',function(a){
        if(a==='bk') exportJSON(); else if(a==='no') sheetClose(); else if(a==='go'){ sheetClose(); performDelete(ids,opt); } });
  }
  SH.refresh=draw; draw();
}
function mergeBinders(keepId,others){ B.binders.forEach(function(b){ if(b.ids.indexOf(keepId)<0&&others.some(function(o){return b.ids.indexOf(o)>=0})){ b.ids.push(keepId); saveBinder(b); } }); }
function performDelete(ids,opt){
  var t0=performance.now(); (opt.merge||[]).forEach(function(m){ mergeBinders(m.keep,m.others); });
  var done=trashCards(ids), n=done.length; if(!n) return;
  B.sel={}; if(!B.view.pick) B.selMode=false;
  if(opt.fromCD){ D.list=D.list.filter(function(x){return done.indexOf(x)<0}); if(!D.list.length) closeCD(); else { D.i=Math.min(D.i,D.list.length-1); D.id=D.list[D.i]; D.side='front'; D.orig=false; renderCD(); $('cdBody').scrollTop=0; } }
  else refreshAfter();
  undoBar('<b>'+(n===1?'Card deleted.':n+' cards deleted.')+'</b><small>Tap Undo, or find '+(n===1?'it':'them')+' in Recently deleted for 30 days.</small>',function(){
    var r=restoreTrash(done); if(opt.fromCD&&r===1) afterRestore(done[0],opt.at); else refreshAfter(); MC().toast((r===1?'Card is':r+' cards are')+' back ✓',3000); });
  B.lastDeleteMs=Math.round(performance.now()-t0); log('deleted '+n+' cards in '+B.lastDeleteMs+' ms');
}
/* select by scan or date */
function selectByScan(){
  var list=viewCards(), days={}, scans={};
  list.forEach(function(c){ var dk=localDate(c.ts), sk=c.sid||'none'; (days[dk]=days[dk]||{ts:c.ts,ids:[]}).ids.push(c.id); (scans[sk]=scans[sk]||{ts:c.ts,snum:c.snum,ids:[]}).ids.push(c.id); });
  var D1=Object.keys(days).map(function(k){return {k:'d:'+k,label:dayLabel(days[k].ts),ids:days[k].ids,ts:days[k].ts}}).sort(function(a,b){return b.ts-a.ts});
  var S1=Object.keys(scans).map(function(k){var g=scans[k]; return {k:'s:'+k,label:(g.snum?'Scan '+g.snum:'Other cards')+' · '+dayLabel(g.ts)+', '+new Date(g.ts).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}),ids:g.ids,ts:g.ts}}).sort(function(a,b){return b.ts-a.ts});
  var map={}; D1.concat(S1).forEach(function(g){map[g.k]=g});
  function row(g){ var on=g.ids.filter(function(id){return B.sel[id]}).length; return '<button class="shr'+(on===g.ids.length?' on':'')+'" data-sh="'+esc(g.k)+'"><span class="shc">'+(on===g.ids.length?'✓':(on?'–':''))+'</span><span class="shl">'+esc(g.label)+'<small>'+plural(g.ids.length,'card')+(on&&on<g.ids.length?' · '+on+' selected':'')+'</small></span></button>'; }
  function draw(){
    sheetOpen('<h2>Select by scan or date</h2><p class="shp">Tap one to select all of its cards. Tap again to take them off. You can mix them.</p>'+(D1.length>1?'<div class="shs">By day</div>'+D1.map(row).join(''):'')+'<div class="shs">By scan</div>'+S1.map(row).join('')+'<div class="shb"><button class="gold-btn" data-sh="done">Done · '+selIds().length+' selected</button></div>',function(a){
      if(a==='done'){ sheetClose(); renderBV(); return; }
      var g=map[a]; if(!g) return; var allOn=g.ids.every(function(id){return B.sel[id]}); g.ids.forEach(function(id){ B.sel[id]=!allOn; }); draw(); });
  }
  draw();
}
/* duplicate finding: the scanner's picture code (simSAD, DUP_AUTO / DUP_FLAG) run over saved thumbnails, a quick 16x24 fingerprint first */
B.sig={};
async function sigOf(c){
  var blob=c.thumb||c.front||c.back; if(!blob) return null;
  var e=B.sig[c.id]; if(e&&e.key===blob.size) return e;
  var g=await MC().grayOfBlob(blob); if(!g) return null;
  var gn=g.gray.length, gm=0, gq=0, gi; for(gi=0;gi<gn;gi++) gm+=g.gray[gi]; gm/=gn; for(gi=0;gi<gn;gi++){ var gd=g.gray[gi]-gm; gq+=gd*gd; }
  var gsd=Math.sqrt(gq/gn)||1; g.flat=gsd<10;                 // evens out brightness and contrast between two scans of the same card
  var gz=new Uint8Array(gn); for(gi=0;gi<gn;gi++) gz[gi]=Math.max(0,Math.min(255,128+(g.gray[gi]-gm)*(45/gsd))); g.gray=gz;
  var cols=16, rows=24, f=new Float32Array(cols*rows), cn=new Float32Array(cols*rows), x, y, k, m=0;
  for(y=0;y<g.AH;y++){ var r=Math.min(rows-1,Math.floor(y*rows/g.AH)); for(x=0;x<128;x++){ k=r*cols+(x>>3); f[k]+=g.gray[y*128+x]; cn[k]++; } }
  for(k=0;k<f.length;k++){ f[k]/=Math.max(1,cn[k]); m+=f[k]; } m/=f.length; for(k=0;k<f.length;k++) f[k]-=m;
  g.s=f; g.key=blob.size; B.sig[c.id]=g; return g;
}
function realVal(c,k){ return (c[k]!==''&&c[k]!=null&&!(c.guess&&c.guess[k]))?String(c[k]).toLowerCase().trim():''; }
function dupConflict(a,b){ var pa=realVal(a,'player'), pb=realVal(b,'player'); if(pa&&pb&&pa!==pb) return true; var sa=String(a.serial||'').trim(), sb=String(b.serial||'').trim(); if(sa&&sb&&sa!==sb) return true; return false; }
var FP_TH=16;
async function findDupGroups(list,onp,ctl){
  var items=[], i, j;
  for(i=0;i<list.length;i++){ if(ctl&&ctl.cancel) return null; var s=await sigOf(list[i]); if(s) items.push({c:list[i],s:s}); if(onp&&i%4===3) onp(i+1,list.length); if(i%6===5) await sleep(0); }
  var n=items.length, p1=[], p2=[]; for(i=0;i<n;i++){ p1[i]=i; p2[i]=i; }
  function fd(p,x){ while(p[x]!==x){ p[x]=p[p[x]]; x=p[x]; } return x; }
  function un(p,a,b){ a=fd(p,a); b=fd(p,b); if(a!==b) p[a]=b; }
  var weak=[], sim=MC().simSAD, AUTO=Math.round(MC().DUP_AUTO*1.4), FLAG=MC().DUP_FLAG;   // 'very likely' = clearly under the scanner's flag line (13 of 18)
  for(i=0;i<n;i++){
    if(ctl&&ctl.cancel) return null;
    var a=items[i];
    for(j=i+1;j<n;j++){ var b=items[j]; if(Math.abs(a.s.AH-b.s.AH)>3||a.s.flat||b.s.flat) continue;
      var d=0, k, fa=a.s.s, fb=b.s.s; for(k=0;k<fa.length;k++) d+=Math.abs(fa[k]-fb[k]); d/=fa.length; if(d>FP_TH) continue;
      if(dupConflict(a.c,b.c)) continue;
      var v=sim(a.s.gray,b.s.gray,a.s.AH,b.s.AH);
      if(v<AUTO){ un(p1,i,j); un(p2,i,j); } else if(v<FLAG) weak.push([i,j]); }
    if(onp&&i%10===9){ onp(list.length,list.length,i+1,n); await sleep(0); }
  }
  weak.forEach(function(w){ un(p2,w[0],w[1]); });
  var comp={}; for(i=0;i<n;i++){ var r2=fd(p2,i); (comp[r2]=comp[r2]||[]).push(i); }
  var out=[];
  Object.keys(comp).forEach(function(k){ var m=comp[k]; if(m.length<2) return; var roots={}; m.forEach(function(x){ roots[fd(p1,x)]=1; });
    var level=Object.keys(roots).length===1?'sure':'maybe';
    var cs=m.map(function(x){return items[x].c}).sort(function(a,b){return b.ts-a.ts||(b.idx-a.idx)});
    out.push({ids:cs.map(function(c){return c.id}),level:level}); });
  out.forEach(pickKeep);
  out.sort(function(a,b){ return (a.level===b.level?0:a.level==='sure'?-1:1)||(b.ids.length-a.ids.length); });
  return out;
}
function completeness(c){ var n=0; ['player','team','year','brand','number','serial'].forEach(function(k){ if(c[k]!==''&&c[k]!=null) n+=(c.guess&&c.guess[k])?.5:1; }); if(c.back) n+=1; if(hasClean(c)) n+=.5; if(c.edited||c.named) n+=1; if(c.notes) n+=.5; if(c.cost!=='') n+=.5; n+=B.binders.filter(function(b){return b.ids.indexOf(c.id)>=0}).length*.5; return n; }
function pickKeep(g){
  var ms=g.ids.map(function(id){ var c=byId(id), s=B.sig[id]||{}; return {id:id,c:c,comp:completeness(c),sharp:s.sharp||0,glare:s.glare||0}; });
  var maxS=Math.max.apply(null,ms.map(function(m){return m.sharp}))||1;
  ms.forEach(function(m){ m.score=m.comp*2+(m.sharp/maxS)*3-m.glare*8; });
  var best=ms.slice().sort(function(a,b){ return (b.score-a.score)||(b.c.ts-a.c.ts); })[0];
  g.keep=best.id; g.m={}; ms.forEach(function(m){ g.m[m.id]=m; });
  g.why={};
  ms.forEach(function(m){
    var o=ms.filter(function(x){return x!==m}), r=[];
    if(o.every(function(x){return m.comp>x.comp})) r.push('most details filled in');
    if(o.every(function(x){return m.sharp>x.sharp*1.08})) r.push('sharpest photo');
    if(o.every(function(x){return m.glare+.004<x.glare})) r.push('least glare');
    if(!r.length) r.push(o.every(function(x){return m.c.ts>=x.c.ts})?'newest scan':'good photo');
    var w=[]; if(o.some(function(x){return x.comp>m.comp})) w.push('fewer details'); if(o.some(function(x){return x.sharp>m.sharp*1.08})) w.push('softer photo'); if(o.some(function(x){return x.glare+.004<m.glare})) w.push('more glare');
    g.why[m.id]={good:r.slice(0,2).join(' · '),bad:w.slice(0,2).join(' · ')||'older copy'};
  });
}
function progressSheet(title,note,ctl){
  SH.ctl=ctl; sheetOpen('<h2>'+esc(title)+'</h2><p class="shp" id="shNote">'+esc(note)+'</p><div class="shbar"><i id="shFill"></i></div><div class="shb"><button class="ghost-btn" data-sh="x">Stop</button></div>',function(){ ctl.cancel=true; sheetClose(); });
}
function progCb(){ return function(i,n){ var f=$('shFill'); if(f) f.style.width=Math.round(100*i/Math.max(1,n))+'%'; var t=$('shNote'); if(t) t.textContent='Checked '+i+' of '+n+' photos on this device…'; }; }
async function selectOlderDups(){
  var list=viewCards(); if(list.length<2){ MC().toast('You need at least two cards to compare.'); return; }
  var ctl={cancel:false}; progressSheet('Looking for repeats…','Comparing your photos on this device. Nothing is sent anywhere.',ctl);
  var gs=await findDupGroups(list,progCb(),ctl); if(!gs){ return; } sheetClose();
  var n=0; gs.forEach(function(g){ if(g.level!=='sure') return; var best=g.ids.slice().sort(function(a,b){ return (completeness(byId(b))-completeness(byId(a)))||(byId(b).ts-byId(a).ts); })[0]; g.ids.forEach(function(id){ if(id!==best){ B.sel[id]=true; n++; } }); });   // keep the newest scan, unless an older one has more details filled in
  renderBV();
  MC().toast(n?'Selected '+plural(n,'older repeat')+' (older scans of the same card). I kept the newest, or the one with more details. Check them, then tap Delete.':'No repeats found. Nothing was selected.',4500);
}
/* Find duplicates screen */
B.dp={groups:[],busy:false,shown:20,from:'home'};
var DUPOK=lsGet('mc-dupok',{});
function gkey(g){ return g.ids.slice().sort().join('+'); }
B.openDups=async function(from){
  flush(); B.dp.from=from||($('bv').classList.contains('on')?'bv':'home'); B.dp.shown=20; B.dp.groups=[]; B.dp.busy=true; B.dp.prog=[0,1];
  MC().show('dp'); renderDP();
  var ctl=B.dp.ctl={cancel:false};
  var gs=await findDupGroups(B.cards.slice(),function(i,n,j,m){ B.dp.prog=[i,n]; var f=$('dpFill'); if(f&&j==null) f.style.width=Math.round(100*i/Math.max(1,n))+'%'; },ctl);
  if(!gs) return;
  B.dp.groups=gs; B.dp.busy=false; renderDP();
};
function dpLeave(){ if(B.dp.ctl) B.dp.ctl.cancel=true; B.dp.busy=false; if(B.dp.from==='bv') B.openBinder('all'); else B.goHome(); }
$('dpBack').addEventListener('click',dpLeave);
function liveGroups(){ var out=[]; B.dp.groups.forEach(function(g){ var ids=g.ids.filter(function(id){return byId(id)}); if(ids.length<2) return; out.push({g:g,ids:ids}); }); return out; }
function renderDP(){
  var sub=$('dpSub'), top=$('dpTop'), list=$('dpList');
  if(B.dp.busy){ sub.textContent='Comparing your photos on this device. Nothing is sent anywhere.'; top.innerHTML='<div class="shbar"><i id="dpFill" style="width:'+Math.round(100*B.dp.prog[0]/Math.max(1,B.dp.prog[1]))+'%"></i></div><div class="kv">This takes a few seconds for a few hundred cards. You can leave and come back.</div>'; list.innerHTML=''; return; }
  var all=liveGroups(), hidden=all.filter(function(x){return DUPOK[gkey(x.g)]}), L=all.filter(function(x){return !DUPOK[gkey(x.g)]});
  var sure=L.filter(function(x){return x.g.level==='sure'}), maybe=L.length-sure.length;
  var extra=0; sure.forEach(function(x){ extra+=x.ids.length-1; });
  var extraAll=0; L.forEach(function(x){ extraAll+=x.ids.length-1; });
  sub.textContent=L.length?(plural(L.length,'group')+' of likely repeats · '+plural(extraAll,'card')+' could go.'):'';
  var h='';
  if(!L.length) h+='<div class="big-empty">✓ No repeats found.<br>Every card in your collection looks different from the others.</div>';
  else{
    if(sure.length) h+='<button class="gold-btn dpAll" data-d="all">Clean up all '+extra+' duplicate'+(extra===1?'':'s')+'</button><div class="kv">Keeps the photo marked <b>KEEP</b> in each of the '+plural(sure.length,'very likely group')+' and moves the other '+extra+' to Recently deleted. You confirm first and can undo.'+(maybe?' The '+maybe+' “might be” group'+(maybe===1?'':'s')+' below are not included. Check '+(maybe===1?'it':'them')+' yourself.':'')+'</div>';
    else h+='<div class="kv">I am not sure enough about any of these to clean them up all at once. Check each group yourself.</div>';
  }
  if(hidden.length) h+='<button class="linkb" data-d="unhide">Show '+plural(hidden.length,'group')+' you said are different</button>';
  top.innerHTML=h;
  var hh='';
  L.slice(0,B.dp.shown).forEach(function(x,gi){
    var g=x.g, keep=x.ids.indexOf(g.keep)>=0?g.keep:x.ids[0], others=x.ids.filter(function(id){return id!==keep});
    hh+='<div class="dg" data-gi="'+B.dp.groups.indexOf(g)+'"><div class="dgh"><b>Group '+(gi+1)+'</b><span class="lv '+g.level+'">'+(g.level==='sure'?'Very likely the same card':'Might be the same card · you decide')+'</span></div><div class="dgr">';
    x.ids.slice().sort(function(p,q){ return (q===keep)-(p===keep); }).forEach(function(id){ var c=byId(id), k=id===keep, w=g.why[id]||{good:'',bad:''};
      hh+='<button class="dt '+(k?'keep':'del')+'" data-c="'+id+'" aria-label="'+(k?'Keeping this one':'Tap to keep this one instead')+'"><img src="'+urlOf(c.thumb||c.front||c.back)+'" alt="" loading="lazy" decoding="async"><span class="kb">'+(k?'✓ KEEP':'Will delete')+'</span><span class="cap"><b>'+esc(cardTitle(c))+'</b><i>'+esc(k?(w.good||'best of the group'):w.bad)+'</i></span></button>'; });
    hh+='</div><div class="dgn">The gold <b>KEEP</b> is the one I would keep. <u>Tap any other photo to keep that one instead.</u></div><div class="dga"><button class="del-btn" data-d="del">Delete the other '+others.length+'</button><button class="ghost-btn" data-d="skip">They are different · keep all</button></div></div>';
  });
  if(L.length>B.dp.shown) hh+='<button class="ghost-btn" data-d="more" style="width:100%">Show more groups ('+(L.length-B.dp.shown)+' left)</button>';
  list.innerHTML=hh;
}
$('dpBody').addEventListener('click',function(e){
  var t=e.target.closest('.dt'), b=e.target.closest('[data-d]');
  if(t){ var gEl=t.closest('.dg'), g=B.dp.groups[+gEl.dataset.gi]; if(g){ g.keep=t.dataset.c; var y=$('dpBody').scrollTop; renderDP(); $('dpBody').scrollTop=y; } return; }
  if(!b) return; var a=b.dataset.d, L=liveGroups().filter(function(x){return !DUPOK[gkey(x.g)]});
  if(a==='more'){ B.dp.shown+=30; var y2=$('dpBody').scrollTop; renderDP(); $('dpBody').scrollTop=y2; }
  else if(a==='unhide'){ DUPOK={}; lsSet('mc-dupok',DUPOK); renderDP(); }
  else if(a==='all'){ var ids=[], merge=[]; L.forEach(function(x){ if(x.g.level!=='sure') return; var keep=x.ids.indexOf(x.g.keep)>=0?x.g.keep:x.ids[0], oth=x.ids.filter(function(id){return id!==keep}); ids=ids.concat(oth); merge.push({keep:keep,others:oth}); });
    confirmDelete(ids,{lead:'I keep the photo marked KEEP in each of the '+plural(merge.length,'group')+'. ',merge:merge}); }
  else{ var gEl2=b.closest('.dg'), g2=B.dp.groups[+gEl2.dataset.gi]; if(!g2) return; var x2=liveGroups().filter(function(x){return x.g===g2})[0]; if(!x2) return;
    var keep2=x2.ids.indexOf(g2.keep)>=0?g2.keep:x2.ids[0], oth2=x2.ids.filter(function(id){return id!==keep2});
    if(a==='del') confirmDelete(oth2,{lead:'I keep the photo marked KEEP. ',merge:[{keep:keep2,others:oth2}]});
    else if(a==='skip'){ DUPOK[gkey(g2)]=1; lsSet('mc-dupok',DUPOK); renderDP(); MC().toast('OK, keeping all of them. I will not show that group again.',3200); } }
});
/* Recently deleted screen */
B.rdSel={};
B.openTrash=function(from){ hideUndo(); flush(); purgeExpired(); B.rdSel={}; B.rdFrom=from||'home'; MC().show('rd'); renderRD(); $('rdBody').scrollTop=0; };
function rdIds(){ return Object.keys(B.rdSel).filter(function(k){return B.rdSel[k]&&B.trash[k]}); }
function renderRD(){
  var L=trashList(), n=L.length, bytes=0, i; L.forEach(function(t){ bytes+=cardBytes(t.c); });
  $('rdSub').innerHTML=n?(plural(n,'card')+' · about '+mbs(bytes)+' on this device. Each is kept 30 days, then its photos are removed for good. <b>Backups do not include these.</b>'):'';
  var sel=rdIds(), ns=sel.length;
  $('rdTools').innerHTML=n?'<button class="chip" data-r="all">Select all '+n+'</button>'+(ns?'<button class="chip" data-r="none">Clear</button>':''):'';
  var h='';
  L.forEach(function(t){ var c=t.c, on=!!B.rdSel[c.id], dl=daysLeft(t);
    h+='<div class="bt sel'+(on?' on':'')+'" data-id="'+c.id+'" role="button" tabindex="0"><img src="'+urlOf(c.thumb||c.front||c.back)+'" alt="" loading="lazy" decoding="async"><span class="ck">'+(on?'✓':'')+'</span><span class="cap"><b>'+esc(cardTitle(c))+'</b><i>'+dl+' day'+(dl===1?'':'s')+' left · deleted '+esc(dayLabel(t.ts))+'</i></span><button class="rs" data-rs="'+c.id+'">↩ Restore</button></div>'; });
  if(!n) h='<div class="big-empty" style="grid-column:1/-1">Nothing here.<br>Cards you delete wait here for 30 days, so you can change your mind.</div>';
  $('rdGrid').className='sel'; $('rdGrid').innerHTML=h;
  var bar=$('rdBar');
  document.body.classList.toggle('barOn',n>0);
  if(!n){ bar.className=''; $('rdBody').style.paddingBottom='24px'; return; }
  bar.className='on'; $('rdBody').style.paddingBottom='140px';
  bar.innerHTML=ns?('<div class="msg"><b>'+ns+' selected</b></div><div class="r"><button class="ghost-btn" data-r="none">Cancel</button><button class="del-btn" data-r="purge">Delete '+ns+' for good</button><button class="gold-btn" data-r="restore">Restore '+ns+'</button></div>'):('<div class="msg">Tap a card to select it, or restore one with its ↩ button.</div><div class="r"><button class="ghost-btn" data-r="empty">Empty now…</button><button class="gold-btn" data-r="restoreall">Restore all '+n+'</button></div>');
}
function rdDone(n,what){ MC().toast(n===1?'1 card '+what+' ✓':n+' cards '+what+' ✓',3000); }
$('rdGrid').addEventListener('click',function(e){
  var rs=e.target.closest('[data-rs]'); if(rs){ var r=restoreTrash([rs.dataset.rs]); delete B.rdSel[rs.dataset.rs]; renderRD(); rdDone(r,'restored'); return; }
  var t=e.target.closest('.bt'); if(!t) return; B.rdSel[t.dataset.id]=!B.rdSel[t.dataset.id]; renderRD();
});
$('rdTools').addEventListener('click',function(e){ var b=e.target.closest('[data-r]'); if(!b) return; if(b.dataset.r==='all') trashList().forEach(function(t){ B.rdSel[t.c.id]=true; }); else B.rdSel={}; renderRD(); });
function purgeDlg(ids,all){
  var n=ids.length;
  MC().askDlg((all?'Empty Recently deleted?':'Delete '+plural(n,'card')+' for good?'),'This cannot be undone. '+(n===1?'The card and its photos are':plural(n,'card')+' and their photos are')+' removed from this device and the space is freed.',[{label:'Delete '+plural(n,'card')+' for good',cls:'ghost',fn:function(){ var r=purgeTrash(ids); B.rdSel={}; renderRD(); MC().toast('Deleted for good. About '+mbs(r.freed)+' freed.',3600); }},{label:'Keep them',cls:'gold'}]);
}
$('rdBar').addEventListener('click',function(e){
  var b=e.target.closest('[data-r]'); if(!b) return; var a=b.dataset.r, ids=rdIds();
  if(a==='none'){ B.rdSel={}; renderRD(); }
  else if(a==='restore'){ var r=restoreTrash(ids); B.rdSel={}; renderRD(); rdDone(r,'restored'); }
  else if(a==='restoreall'){ var r2=restoreTrash(Object.keys(B.trash)); B.rdSel={}; renderRD(); rdDone(r2,'restored'); }
  else if(a==='purge') purgeDlg(ids,false);
  else if(a==='empty') purgeDlg(Object.keys(B.trash),true);
});
$('rdBack').addEventListener('click',function(){ B.goHome(); setTab('b'); });

/* ---------- start-up / wiring ---------- */
B.PHNOTE=PHNOTE; B.debugInfo=function(){ return 'binder: '+B.cards.length+' cards, '+B.binders.length+' binders, named '+(B.cards.length-unnamedCount())+', db '+(B.db?'ok':'none')+', sort '+lsGet('mc-sort','date'); };
$('bvSort').innerHTML=SORTS.map(function(s){return '<option value="'+s[0]+'">'+s[1]+'</option>'}).join('');
window.Binder=B; window.__B=B;
})();
