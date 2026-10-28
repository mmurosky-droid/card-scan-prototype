/* Moose Cards Guided Scan v0.8 - Binder (all data stays on this phone, in IndexedDB) */
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
var B={db:null,ready:false,cards:[],binders:[],gone:{},view:{id:'all',pick:null},sel:{},selMode:false,q:Promise.resolve(),tab:'b',saveT:{}};
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
function saveCard(c){ clearTimeout(B.saveT[c.id]); B.saveT[c.id]=setTimeout(function(){ delete B.saveT[c.id]; put('cards',c); },350); }
function flush(){ Object.keys(B.saveT).forEach(function(id){ clearTimeout(B.saveT[id]); delete B.saveT[id]; var c=byId(id); if(c) put('cards',c); }); }
function saveBinder(b){ return put('binders',b); }
function byId(id){ for(var i=0;i<B.cards.length;i++) if(B.cards[i].id===id) return B.cards[i]; return null; }
function binderById(id){ for(var i=0;i<B.binders.length;i++) if(B.binders[i].id===id) return B.binders[i]; return null; }
function newCard(id){ return {id:id,ts:Date.now(),upd:0,sid:'',snum:0,idx:0,fu:'',bu:'',player:'',team:'',year:'',brand:'',number:'',parallel:'',cond:'raw',grader:'',grade:'',status:'owned',cost:'',sold:'',notes:'',label:'',tags:[],pv:'',front:null,back:null,thumb:null,fsize:0,bsize:0,photos:[],edited:false,named:false,sport:LAST.sport||'Baseball',serial:'',rookie:false,auto:false,relic:false,cert:'',condNotes:'',flaws:[],flawText:'',price:'',ls:{title:'',titleEdited:false,desc:'',descEdited:false},guess:{},clean:{},cthumb:null}; }
function normCard(c){ if(!c.tags)c.tags=[]; if(!c.photos)c.photos=[]; if(!c.sport)c.sport='Baseball'; ['serial','cert','condNotes','flawText','price'].forEach(function(k){ if(c[k]==null)c[k]=''; }); ['rookie','auto','relic'].forEach(function(k){ if(c[k]==null)c[k]=false; }); if(!c.flaws)c.flaws=[]; if(!c.ls)c.ls={title:'',titleEdited:false,desc:'',descEdited:false}; if(!c.guess)c.guess={}; if(!c.clean)c.clean={}; if(c.cthumb===undefined)c.cthumb=null; return c; }
B.init=async function(){
  B.db=await openDB();
  var cs=await getAll('cards'), bs=await getAll('binders'), gs=await getAll('gone');
  B.cards=cs; B.binders=bs.sort(function(a,b){return a.ts-b.ts}); gs.forEach(function(g){B.gone[g.id]=1});
  B.cards.forEach(normCard);
  B.ready=true; log('binder ready: '+B.cards.length+' cards, '+B.binders.length+' binders, db '+(B.db?'ok':'MISSING'));
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
    if(isNew||upd) await put('cards',c);
  }
  // photos removed in the scan review (and never named or edited) leave the binder too
  var gone=B.cards.filter(function(c){return c.sid===s.id&&!seen[c.id]&&!c.edited&&!c.named});
  for(i=0;i<gone.length;i++) await removeCard(gone[i],false);
  if(added){ log('binder: +'+added+' cards from section '+s.num); askPersist(); }
  return added;
}
B.setLabelByUid=function(uid,label){ var c=byId(uid); if(c){ c.label=label||''; saveCard(c); } };
async function removeCard(c,tomb){
  B.cards=B.cards.filter(function(x){return x!==c});
  for(var i=0;i<B.binders.length;i++){ var b=B.binders[i], k=b.ids.indexOf(c.id); if(k>=0){ b.ids.splice(k,1); await saveBinder(b); } }
  await del('cards',c.id);
  if(tomb!==false){ B.gone[c.id]=1; await put('gone',{id:c.id}); }
}

/* ---------- storage permission + backup reminders ---------- */
function askPersist(){
  try{ if(navigator.storage&&navigator.storage.persist&&!lsGet('mc-persist-asked',false)){ lsSet('mc-persist-asked',true); navigator.storage.persist().then(function(ok){ log('storage.persist -> '+ok); if($('paneD')) renderBackup(); },function(){}); } }catch(e){}
}
function persistStatus(){
  return new Promise(function(res){
    try{ if(!(navigator.storage&&navigator.storage.persisted)) return res('unsupported'); navigator.storage.persisted().then(function(p){res(p?'on':'off')},function(){res('unsupported')}); }catch(e){res('unsupported')}
  });
}
function backupDue(){ if(!B.cards.length) return false; var t=lsGet('mc-lastexport',0); return !t||(Date.now()-t>14*864e5); }

/* ---------- Home tabs ---------- */
function setTab(t){
  B.tab=t; ['b','s','d'].forEach(function(k){ $('pane'+k.toUpperCase()).classList.toggle('on',k===t); });
  [].forEach.call($('tabs').children,function(b){ b.classList.toggle('on',b.dataset.t===t); });
  if(t==='b') renderHome(); if(t==='d') renderBackup(); if(t==='s'&&window.MC&&MC().renderScans) MC().renderScans();
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
function unnamedCount(){ return B.cards.filter(function(c){return !c.player}).length; }
function renderHome(){
  var h='', n=B.cards.length, un=unnamedCount();
  if(!B.db) h+='<div class="warnb">Heads up: this browser can\'t keep your Binder after you close the page. Export a backup before you leave.</div>';
  else if(backupDue()) h+='<div class="warnb">You have '+n+' card'+(n===1?'':'s')+' and no recent backup. Clearing your browser data deletes your Binder.<br><button class="ghost-btn" data-act="gobackup" style="width:auto;margin:6px 0 0">Back up now</button></div>';
  h+='<button class="gold-btn" data-act="scan">Scan cards</button>';
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
  if(!n) h+='<div class="big-empty">Your Binder is empty. Tap <b>Scan cards</b>. After each scan your cards land here, and you can name them one by one.</div>';
  else h+='<div class="pvnote">'+PHNOTE+' Everything is stored on this phone only.</div>';
  $('paneB').innerHTML=h;
}
B.renderHome=function(){ if(B.tab==='b') renderHome(); };
$('paneB').addEventListener('click',function(e){
  var b=e.target.closest('[data-act]'); if(!b) return; var a=b.dataset.act;
  if(a==='scan') MC().startScan();
  else if(a==='open') B.openBinder(b.dataset.id);
  else if(a==='name') B.openName({});
  else if(a==='newb') newBinderDlg();
  else if(a==='gobackup') setTab('d');
});
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
  $('bvSel').textContent=B.selMode&&!pick?'Done':'Select'; $('bvSel').style.display=pick?'none':'inline-flex';
  var todo=cleanTodo(all), cb=$('bvClean'); cb.style.display=(!B.selMode&&!pick&&todo.length)?'block':'none'; cb.textContent='✨ Clean up photos ('+todo.length+')';
  renderBar();
}
function selIds(){ return Object.keys(B.sel).filter(function(k){return B.sel[k]}); }
function renderBar(){
  var bar=$('bvBar'), n=selIds().length, v=B.view, bd=v.id==='all'?null:binderById(v.id), pick=v.pick?binderById(v.pick):null;
  if(!B.selMode){ bar.className=''; $('bvBody').style.paddingBottom='24px'; return; }
  bar.className='on'; $('bvBody').style.paddingBottom='170px';
  var h='<div class="msg">'+(n?n+' selected':'Tap cards to select them')+'</div>';
  if(pick){
    h+='<div class="r"><button class="ghost-btn" data-b="selall">Select all</button><button class="gold-btn" data-b="doadd"'+(n?'':' disabled')+'>Add '+(n||'')+' to binder</button></div><div class="r"><button class="ghost-btn" data-b="cancelpick">Cancel</button></div>';
  }else{
    h+='<div class="r"><button class="ghost-btn" data-b="selall">Select all</button><button class="gold-btn" data-b="addto"'+(n?'':' disabled')+'>Add to…</button><button class="gold-btn" data-b="moveto"'+(n?'':' disabled')+'>Move to…</button></div>';
    h+='<div class="r">'+(bd?'<button class="ghost-btn" data-b="rmfrom"'+(n?'':' disabled')+'>Take out of this binder</button>':'')+'<button class="ghost-btn" data-b="delc"'+(n?'':' disabled')+'>Delete cards</button></div>';
  }
  bar.innerHTML=h;
}
$('bvGrid').addEventListener('click',function(e){
  var t=e.target.closest('.bt'); if(!t) return; var id=t.dataset.id;
  if(B.selMode){ B.sel[id]=!B.sel[id]; t.classList.toggle('on',!!B.sel[id]); t.querySelector('.ck').textContent=B.sel[id]?'✓':''; renderBar(); return; }
  B.openCard(id,curList.map(function(c){return c.id}));
});
$('bvSel').addEventListener('click',function(){ B.selMode=!B.selMode; B.sel={}; renderBV(); });
$('bvSort').addEventListener('change',function(){ lsSet('mc-sort',$('bvSort').value); renderBV(); });
$('bvSearch').addEventListener('input',function(){ renderBV(); });
$('bvBack').addEventListener('click',function(){ B.goHome(); });
B.goHome=function(){ flush(); B.selMode=false; MC().show('home'); setTab('b'); };
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
  else if(a==='delc'){ MC().askDlg('Delete '+ids.length+' card'+(ids.length===1?'':'s')+'?','This removes them and their photos from this phone. Right after, you get a few seconds to tap Undo.',[{label:'Delete',cls:'ghost',fn:function(){ var snap=snapshot(ids); deleteCards(ids).then(function(){ B.sel={}; renderBV(); undoBar(ids.length+' card'+(ids.length===1?'':'s')+' deleted.',function(){ restoreSnap(snap).then(function(){ afterRestore(null); MC().toast('Cards are back ✓'); }); }); }); }},{label:'Keep them',cls:'gold'}]); }
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
function gbadge(c,k){ return (c.guess&&c.guess[k])?' <button type="button" class="chk" data-ck="'+k+'">check this</button>':''; }
function lab(c,k,text,forId,bk){ return '<label'+(forId?' for="'+forId+'"':'')+'>'+text+gbadge(c,bk||k)+'</label>'; }
function ensureDrafts(c){ if(!c.ls) c.ls={title:'',titleEdited:false,desc:'',descEdited:false}; if(!c.ls.titleEdited) c.ls.title=Listing.draftTitle(c); if(!c.ls.descEdited) c.ls.desc=Listing.draftDesc(c,{cleaned:hasClean(c)}); }
function buildForm(host,c,keys,onch){
  var h='';
  keys.forEach(function(k){
    var d=FDEF[k];
    if(d){ var v=k==='tags'?(c.tags||[]).join(', '):(c[k]===''||c[k]==null?'':c[k]);
      h+='<div class="fld">'+lab(c,k,d[0],'f_'+k)+'<input id="f_'+k+'" data-k="'+k+'" type="text" inputmode="'+(d[1]==='text'?'text':d[1])+'" placeholder="'+esc(d[2])+'" value="'+esc(v)+'" autocomplete="off" autocapitalize="'+(k==='tags'||k==='serial'?'none':'words')+'" enterkeyhint="next">'+(d[3]?'<div class="sug" data-sug="'+k+'"></div>':'')+'</div>'; }
    else if(k==='sport') h+='<div class="fld"><label>Sport</label><div class="segb" data-seg="sport">'+SPORTS.map(function(x){return '<button data-v="'+x+'" class="'+(c.sport===x?'on':'')+'">'+x+'</button>'}).join('')+'</div></div>';
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
  function dropBadge(k){ var bd=host.querySelector('[data-ck="'+(GK[k]||k)+'"]'); if(bd) bd.remove(); }
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
  host.oninput=function(e){ var el=e.target; if(!el.dataset||!el.dataset.k) return; var k=el.dataset.k; setField(c,k,el.value); dropBadge(k); if(k==='cost'||k==='sold') derived(); sugRender(k,el); drafts(k); if(onch) onch(k); };
  host.onchange=function(e){ var el=e.target; if(el.tagName==='SELECT'&&el.dataset.k){ setField(c,el.dataset.k,el.value); dropBadge(el.dataset.k); drafts(el.dataset.k); if(onch) onch(el.dataset.k); } };
  host.onfocusin=function(e){ var el=e.target; if(el.dataset&&el.dataset.k&&FDEF[el.dataset.k]&&FDEF[el.dataset.k][3]) sugRender(el.dataset.k,el); };
  host.onfocusout=function(e){ var el=e.target; if(el.dataset&&el.dataset.k){ var k=el.dataset.k; setTimeout(function(){ var bx=host.querySelector('[data-sug="'+k+'"]'); if(bx&&document.activeElement!==el) bx.innerHTML=''; },300); } };
  host.onclick=function(e){
    var ck=e.target.closest('[data-ck]'); if(ck){ e.preventDefault(); delete c.guess[ck.dataset.ck]; c.edited=true; c.upd=Date.now(); saveCard(c); ck.remove(); if(onch) onch('guess'); return; }
    var sb=e.target.closest('[data-sv]'); if(sb){ var box=sb.parentNode, k=box.dataset.sug, inp=host.querySelector('[data-k="'+k+'"]'); inp.value=sb.dataset.sv; setField(c,k,sb.dataset.sv); dropBadge(k); box.innerHTML=''; drafts(k); if(onch) onch(k); return; }
    var fg=e.target.closest('[data-flag]'); if(fg){ var f=fg.dataset.flag; c[f]=!c[f]; fg.classList.toggle('on',!!c[f]); if(c.guess) delete c.guess.flags; dropBadge('flags'); c.edited=true; c.upd=Date.now(); saveCard(c); drafts(f); if(onch) onch(f); return; }
    var fw=e.target.closest('[data-flaw]'); if(fw){ var w=fw.dataset.flaw, ix=c.flaws.indexOf(w); if(ix>=0) c.flaws.splice(ix,1); else c.flaws.push(w); fw.classList.toggle('on',ix<0); c.edited=true; c.upd=Date.now(); saveCard(c); drafts('flaws'); if(onch) onch('flaws'); return; }
    var rd=e.target.closest('[data-redraft]'); if(rd){ var what=rd.dataset.redraft;
      var doIt=function(){ c.ls[what+'Edited']=false; ensureDrafts(c); var el2=G(what==='title'?'f_title':'f_desc'); if(el2) el2.value=c.ls[what]; c.edited=true; saveCard(c); drafts('x'); MC().toast('Re-drafted from your fields.'); if(onch) onch(what); };
      if(c.ls[what+'Edited']) MC().askDlg('Replace what you wrote?','This swaps your edited '+(what==='title'?'title':'description')+' for a fresh draft built from the fields above.',[{label:'Re-draft it',cls:'gold',fn:doIt},{label:'Keep mine',cls:'ghost'}]); else doIt(); return; }
    var b=e.target.closest('.segb button'); if(!b) return; var sg=b.parentNode.dataset.seg;
    [].forEach.call(b.parentNode.children,function(x){x.classList.toggle('on',x===b)});
    setField(c,sg,b.dataset.v); dropBadge(sg); derived(); drafts(sg); if(onch) onch(sg);
  };
  derived(); drafts('init');
}
function setField(c,k,v){
  if(k==='title'||k==='desc'){ c.ls[k]=v; c.ls[k+'Edited']=String(v).trim()!==''; c.edited=true; c.upd=Date.now(); saveCard(c); return; }
  if(k==='year'){ v=String(v).replace(/\D/g,'').slice(0,4); v=v===''?'':parseInt(v,10); }
  else if(k==='cost'||k==='sold'||k==='pv'||k==='price') v=num(v);
  else if(k==='tags') v=String(v).split(',').map(function(x){return x.trim()}).filter(function(x,i,a){return x&&a.indexOf(x)===i});
  c[k]=v; c.edited=true; c.upd=Date.now(); if(k==='player') c.named=!!String(v).trim();
  if(c.guess){ delete c.guess[GK[k]||k]; }
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
  MC().askDlg('Delete this card?','It is removed from every binder, with its photos, from this phone. Right after, you get a few seconds to tap Undo.',[{label:'Delete card',cls:'ghost',fn:function(){
    var snap=snapshot([c.id]), at=D.i;
    removeCard(c,true).then(function(){ D.list=D.list.filter(function(x){return x!==c.id});
      undoBar('Card deleted.',function(){ restoreSnap(snap).then(function(){ afterRestore(c.id,at); MC().toast('Card is back ✓'); }); });
      if(!D.list.length){ closeCD(); return; } D.i=Math.min(D.i,D.list.length-1); D.id=D.list[D.i]; D.side='front'; D.orig=false; renderCD(); $('cdBody').scrollTop=0; }); }},{label:'Keep it',cls:'gold'}]);
});
/* Undo for deletes: a small bar with an Undo button (the card, its photos and binder spots come back) */
var UB={t:null,fn:null};
function undoBar(msg,fn){ $('ubMsg').textContent=msg; UB.fn=fn; $('undoBar').classList.add('on'); clearTimeout(UB.t); UB.t=setTimeout(function(){ $('undoBar').classList.remove('on'); UB.fn=null; },10000); }
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

/* ---------- Name your cards ---------- */
var N={ids:[],i:0,side:'front',named:0,sid:null};
B.openName=function(opts){
  opts=opts||{}; flush();
  var list=B.cards.filter(function(c){return !c.player&&(!opts.sid||c.sid===opts.sid)});
  list.sort(function(a,b){return (a.snum-b.snum)||(a.idx-b.idx)||cmpDate(a,b)});
  if(!list.length){ MC().toast('Every card already has a name.'); B.goHome(); return; }
  N={ids:list.map(function(c){return c.id}),i:0,side:'front',named:0,sid:opts.sid||null};
  MC().show('nm'); renderNM(true);
};
function renderNM(first){
  var c=byId(N.ids[N.i]); if(!c){ finishNM(); return; }
  $('nmN').textContent='Card '+(N.i+1)+' of '+N.ids.length;
  $('nmProg').firstChild.style.width=Math.round(100*N.i/N.ids.length)+'%';
  N.side='front'; drawNMPhoto(c);
  // prefill from the last card you typed (year, set, parallel, raw/graded). Team is a one-tap suggestion.
  var pre=false;
  if(!c.edited){ c.guess=c.guess||{}; if(LAST.sport) c.sport=LAST.sport; if(c.year===''&&LAST.year){c.year=LAST.year;c.guess.year=1;pre=true} if(!c.brand&&LAST.brand){c.brand=LAST.brand;c.guess.brand=1;pre=true} if(!c.parallel&&LAST.parallel){c.parallel=LAST.parallel;c.guess.parallel=1;pre=true} if(LAST.cond){c.cond=LAST.cond; if(LAST.cond==='graded'&&!c.grader&&LAST.grader) c.grader=LAST.grader;} }
  renderNMForm(c,true);
  $('nmPre').textContent=pre?'Year, set and parallel are copied from your last card and marked “check this”. Tap the badge when they are right, or just change them.':'';
  $('nmTeamLast').innerHTML=(LAST.team&&!c.team)?'<div class="sug"><button type="button" data-lt="1">Same team as last: '+esc(LAST.team)+'</button></div>':'';
  $('nmOcrOut').innerHTML='';
  $('nmPrev').disabled=N.i<=0; $('nmNext').textContent=N.i>=N.ids.length-1?'Save and finish':'Next ›';
  if(!first) $('nmBody').scrollTop=0;
}
function renderNMForm(c,first){ var y=$('nmBody').scrollTop; buildForm($('nmForm'),c,['sport','player','team','year','brand','number','parallel','cond'],function(){}); if(!first) $('nmBody').scrollTop=y; }
function drawNMPhoto(c){
  var blob=N.side==='front'?(c.front||c.back):(c.back||c.front);
  $('nmImg').src=urlOf(blob); $('nmFl').textContent=(N.side==='front'?'Front':'Back')+((c.back&&c.front)?' · tap to flip':'');
}
$('nmImg').addEventListener('click',function(){ var c=byId(N.ids[N.i]); if(!c||!c.back||!c.front) return; N.side=N.side==='front'?'back':'front'; drawNMPhoto(c); });
$('nmTeamLast').addEventListener('click',function(e){ if(!e.target.closest('[data-lt]')) return; var c=byId(N.ids[N.i]); setField(c,'team',LAST.team); var i=$('nmForm').querySelector('[data-k="team"]'); if(i) i.value=LAST.team; $('nmTeamLast').innerHTML=''; });
function nmStep(d,saved){
  var c=byId(N.ids[N.i]);
  if(c&&saved){ if(c.player) { if(!c.named) {} N.named++; } c.edited=true; saveCard(c); }
  flush(); var j=N.i+d; if(j<0) return; if(j>=N.ids.length){ finishNM(); return; } N.i=j; renderNM();
}
$('nmNext').addEventListener('click',function(){ nmStep(1,true); });
$('nmPrev').addEventListener('click',function(){ nmStep(-1,false); });
$('nmSkip').addEventListener('click',function(){
  var c=byId(N.ids[N.i]); if(c&&!c.player){ /* skipping keeps any year/set copied in only if you typed a name; otherwise undo the copy */ if(!c.named&&c.edited===false){ c.year='';c.brand='';c.parallel='';c.guess={}; } }
  nmStep(1,false);
});
$('nmBack').addEventListener('click',function(){ flush(); B.goHome(); });
function finishNM(){
  flush(); var left=unnamedCount();
  MC().toast(N.named?('Saved '+N.named+' name'+(N.named===1?'':'s')+'. Nice work.'):'No names saved this time.',3000);
  B.openBinder('all');
  if(left) setTimeout(function(){ MC().toast(left+' card'+(left===1?'':'s')+' still need a name. You can do it any time.',3200); },3200);
}
/* optional on-device reading of names (tesseract.js from a CDN; photos never leave the phone) */
var TESS={state:'idle',w:null};
function loadTess(){
  return new Promise(function(res,rej){
    if(window.Tesseract) return res(window.Tesseract);
    var s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'; s.onload=function(){res(window.Tesseract)}; s.onerror=function(){rej(new Error('could not load the reader'))};
    document.head.appendChild(s); setTimeout(function(){ if(!window.Tesseract) rej(new Error('timed out loading the reader')); },25000);
  });
}
var STOP=/^(topps|panini|bowman|chrome|series|rookie|card|baseball|donruss|prizm|topps|fleer|upper|deck|heritage|stadium|club|update|photo|variation|refractor|auto|autograph|mlb|major|league|all-star|allstar|national|american|inc|licensed|products|player|the|and|of|new|york|los|angeles|san|francisco|diego|st|louis|tampa|bay|kansas|city|white|red|blue|sox|jays|psa|bgs|sgc|gem|mint|rc|first|official)$/i;
var BRANDS=['Topps Chrome','Bowman Chrome','Topps Heritage','Topps Update','Topps Series 1','Topps Series 2','Topps','Bowman','Donruss Optic','Donruss','Panini Prizm','Prizm','Optic','Mosaic','Select','Contenders','Score','Upper Deck','Fleer','Leaf','Stadium Club'];
function parseOCR(text,sport){
  var lines=text.split(/\n+/).map(function(l){return l.replace(/[^A-Za-z0-9.'\-\s\/©#]/g,' ').replace(/\s+/g,' ').trim()}).filter(Boolean), out={players:[],years:[],teams:[],serials:[],numbers:[],brands:[],flags:[],graders:[],grades:[],certs:[]}, yr=new Date().getFullYear()+1, tf=teamsFor(sport);
  lines.forEach(function(l){
    var m=l.match(/\b(19[4-9]\d|20[0-4]\d)\b/g); if(m) m.forEach(function(y){ y=+y; if(y>=1948&&y<=yr&&out.years.indexOf(y)<0) out.years.push(y); });
    var lo=l.toLowerCase(); Object.keys(NICK).forEach(function(n){ if(new RegExp('\\b'+n.replace(/[-]/g,'\\-')+'\\b').test(lo)){ NICK[n].forEach(function(t){ if(tf.indexOf(t)>=0&&out.teams.indexOf(t)<0) out.teams.push(t); }); } });
    var words=l.split(' ');
    if(words.length>=2&&words.length<=3&&words.every(function(w){return /^[A-Za-z][A-Za-z.'\-]{2,}$/.test(w)&&/[aeiouyAEIOUY]/.test(w)&&!STOP.test(w)})&&l.length>=6&&l.length<=26){
      var nm=words.map(function(w){return w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()}).join(' ');
      if(out.players.indexOf(nm)<0) out.players.push(nm);
    }
  });
  var all=lines.join('\n'), mm, re;
  re=/\b(\d{1,4})\s*\/\s*(\d{1,4})\b/g; while((mm=re.exec(all))){ var a1=+mm[1], b1=+mm[2]; if(b1>=2&&a1>=1&&a1<=b1&&a1<1900){ var sr=a1+'/'+b1; if(out.serials.indexOf(sr)<0) out.serials.push(sr); } }
  re=/(?:^|\s)(?:no\.?|#)\s*(\d{1,4}[A-Z]?)\b/gi; while((mm=re.exec(all))){ if(out.numbers.indexOf(mm[1].toUpperCase())<0) out.numbers.push(mm[1].toUpperCase()); }
  BRANDS.forEach(function(b){ if(new RegExp('\\b'+b+'\\b','i').test(all)&&!out.brands.some(function(x){return x.indexOf(b)>=0})) out.brands.push(b); });
  if(/\bRC\b|\brookie\b/i.test(all)) out.flags.push('rookie'); if(/\bauto(graph(ed)?)?\b/i.test(all)) out.flags.push('auto'); if(/\b(relic|patch|jersey|memorabilia)\b/i.test(all)) out.flags.push('relic');
  var g=all.match(/\b(PSA|BGS|SGC|CGC|BECKETT)\b/i); if(g){ var gg=g[1].toUpperCase(); out.graders.push(gg==='BECKETT'?'BGS':gg); }
  re=/\b(?:GEM\s*M(?:T|INT)|MINT|NM-?MT|NM|EX-?MT|EX|VG)\s*\+?\s*(10|\d(?:\.5)?)\b/gi; while((mm=re.exec(all))){ if(out.grades.indexOf(mm[1])<0) out.grades.push(mm[1]); }
  re=/\b\d{7,9}\b/g; while((mm=re.exec(all))){ if(out.certs.indexOf(mm[0])<0) out.certs.push(mm[0]); }
  ['players','years','teams'].forEach(function(k){ out[k]=out[k].slice(0,k==='teams'?2:3); }); ['serials','numbers','brands','grades','certs'].forEach(function(k){ out[k]=out[k].slice(0,2); });
  return out;
}
async function ocrCard(c,outId){
  var T=await loadTess();
  if(!TESS.w){ $(outId||'nmOcrOut').innerHTML='<small>Getting the on-device reader ready the first time (a few MB, then it stays in your browser)…</small>'; TESS.w=await T.createWorker('eng'); }
  var blob=c.front||c.back, im=await new Promise(function(r,j){ var i=new Image(); i.onload=function(){r(i)}; i.onerror=j; i.src=urlOf(blob); });
  var s=Math.min(1,1100/im.naturalWidth), cv=document.createElement('canvas'); cv.width=Math.round(im.naturalWidth*s); cv.height=Math.round(im.naturalHeight*s); cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);
  var r=await Promise.race([TESS.w.recognize(cv),new Promise(function(_,rej){setTimeout(function(){rej(new Error('took too long'))},60000)})]);
  var txt=r.data.text||'';
  if(r.data.lines&&r.data.lines.length) txt=r.data.lines.filter(function(l){return l.confidence>=70}).map(function(l){return l.text}).join('\n');
  return parseOCR(txt,c.sport);
}
$('nmOcr').addEventListener('click',async function(){
  var c=byId(N.ids[N.i]); if(!c) return; var out=$('nmOcrOut'), btn=$('nmOcr'); btn.disabled=true;
  out.innerHTML='<small>Reading this card on your phone… your photo is not uploaded.</small>';
  try{
    var o=await ocrCard(c), h='', any=false;
    function grp(lbl,key,arr){ if(!arr.length) return; any=true; h+='<div>'+lbl+'<div class="sg">'+arr.map(function(x){return '<button type="button" data-oc="'+key+'" data-v="'+esc(x)+'" class="chip">'+esc(x)+'</button>'}).join('')+'</div></div>'; }
    grp('Player might be:','player',o.players); grp('Year might be:','year',o.years); grp('Team might be:','team',o.teams);
    out.innerHTML=(any?'<b>Suggestions only. Please check them.</b> Tap one to use it.'+h:'I couldn\'t read a name or year on this one. That is normal for some cards. Please type it.')+'<br><small>Auto-read is a helper, not a guarantee. It is often wrong on fancy fonts and shiny cards.</small>';
    log('ocr ok: '+JSON.stringify(o));
  }catch(e){ out.innerHTML='Auto-read didn\'t work here ('+esc(e&&e.message||'unknown')+'). It needs an internet connection the first time. You can just type the names.'; log('ocr fail: '+(e&&e.message||e)); }
  btn.disabled=false;
});
$('nmOcrOut').addEventListener('click',function(e){
  var b=e.target.closest('[data-oc]'); if(!b) return; var c=byId(N.ids[N.i]), k=b.dataset.oc; setGuess(c,k,b.dataset.v);
  renderNMForm(c);
});

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
    '<button class="ghost-btn dbtn2" id="lsRead">✨ Try reading the card for me<small>Optional. Reads the photo on this phone and suggests names, year, set, serial number and more. Anything you tap is marked “check this”.</small></button><div id="lsOcr"></div>';
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
function lsLeave(){ flush(); MC().show('cd'); renderCD(); }
$('lsTop').addEventListener('click',async function(e){
  var c=byId(L.id); if(!c) return;
  if(e.target.closest('#lsAllOk')){ c.guess={}; c.edited=true; saveCard(c); renderLS(); return; }
  var oc=e.target.closest('[data-oc]'); if(oc){ var k=oc.dataset.oc, v=oc.dataset.v;
    if(k.indexOf('flag:')===0){ c[k.slice(5)]=true; c.guess=c.guess||{}; c.guess.flags=1; c.edited=true; saveCard(c); }
    else setGuess(c,k,v==='' ?'':(k==='year'?+v:v));
    if(k==='grader'||k==='grade'||k==='cert'){ c.cond='graded'; saveCard(c); }
    renderLS(); showOcr(c,LS_O); return; }
  if(e.target.closest('#lsRead')){ var btn=$('lsRead'); if(btn.disabled) return; btn.disabled=true; var out=$('lsOcr'); out.innerHTML='<small>Reading this card on your phone… your photo is not uploaded.</small>';
    try{ LS_O=await ocrCard(c,'lsOcr'); showOcr(c,LS_O); log('ls ocr ok'); }
    catch(er){ out.innerHTML='Auto-read did not work here ('+esc(er&&er.message||'unknown')+'). It needs an internet connection the first time. You can type everything yourself instead.'; log('ls ocr fail: '+(er&&er.message||er)); }
    btn.disabled=false; }
});
var LS_O=null;
function showOcr(c,o){
  var out=$('lsOcr'); if(!out||!o) return; var h='', any=false;
  function grp(lbl,key,arr,cur){ arr=arr.filter(function(x){return String(x)!==String(cur)}); if(!arr.length) return; any=true; h+='<div>'+lbl+'<div class="sg">'+arr.map(function(x){return '<button type="button" data-oc="'+key+'" data-v="'+esc(x)+'" class="chip">'+esc(x)+'</button>'}).join('')+'</div></div>'; }
  grp('Player might be:','player',o.players,c.player); grp('Year might be:','year',o.years,c.year); grp('Team might be:','team',o.teams,c.team); grp('Set might be:','brand',o.brands,c.brand);
  grp('Card number might be:','number',o.numbers,c.number); grp('Serial / print run might be:','serial',o.serials,c.serial);
  var fl=o.flags.filter(function(f){return !c[f]}); if(fl.length){ any=true; h+='<div>Features might be:<div class="sg">'+fl.map(function(f){return '<button type="button" data-oc="flag:'+f+'" data-v="1" class="chip">'+({rookie:'Rookie',auto:'Autograph',relic:'Patch / relic'})[f]+'</button>'}).join('')+'</div></div>'; }
  grp('Grader might be:','grader',o.graders,c.grader); grp('Grade might be:','grade',o.grades,c.grade); grp('Cert number might be:','cert',o.certs,c.cert);
  out.innerHTML=(any?'<b>Suggestions only. Please check them.</b> Tap one to use it. It will be marked “check this” until you confirm it.'+h:'I could not read anything useful on this one. That is normal for some cards. Please type the details.')+'<br><small>Auto-read is a helper, not a guarantee. It is often wrong on fancy fonts and shiny cards.</small>';
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

/* ---------- Backup tab: export / import / storage ---------- */
async function renderBackup(){
  var st=await persistStatus(), usage='';
  try{ if(navigator.storage&&navigator.storage.estimate){ var e=await navigator.storage.estimate(); usage=' · using about '+((e.usage||0)/1048576).toFixed(0)+' MB'; } }catch(e){}
  var le=lsGet('mc-lastexport',0), n=B.cards.length;
  var h='<div class="warnb"><b>Your Binder lives only on this phone.</b> If you clear your browser data or site data, it is deleted. Back it up now and then.</div>';
  h+='<div class="kv"><b>'+n+'</b> card'+(n===1?'':'s')+' · <b>'+B.binders.length+'</b> custom binder'+(B.binders.length===1?'':'s')+'<br>Last backup: <b>'+(le?new Date(le).toLocaleDateString():'never')+'</b></div>';
  h+='<button class="gold-btn dbtn" data-d="json">Export my Binder (JSON)<small>Full backup with photos. Use this to restore.</small></button>';
  h+='<button class="ghost-btn dbtn" data-d="csv">Export a spreadsheet (CSV)<small>No photos. Opens in Excel or Sheets. Everything about each card.</small></button>';
  h+='<button class="ghost-btn dbtn" data-d="lcsv">Export listing sheets (CSV)<small>Draft for review, not an official eBay file. No eBay connection.</small></button>';
  h+='<button class="ghost-btn dbtn" data-d="zip">Export photos (zip)<small>Original and cleaned photos, plus your own, named by card</small></button>';
  h+='<button class="ghost-btn dbtn" data-d="import">Import a backup (JSON)<small>Adds cards that are missing. Nothing is overwritten.</small></button>';
  h+='<input type="file" id="impFile" accept=".json,application/json" style="display:none">';
  h+='<div class="lab">Storage protection</div><div class="kv">Protected storage: <b>'+(st==='on'?'On ✓ (the browser will not clear it on its own)':st==='off'?'Off (the browser may clear it if the phone runs low on space)':'Not supported here')+'</b>'+usage+(B.db?'':'<br><b>This browser can\'t keep a Binder after you close the page.</b>')+'</div>';
  if(st==='off') h+='<button class="ghost-btn dbtn" data-d="persist">Ask the browser to protect my Binder</button>';
  h+='<div class="lab">Help</div><button class="ghost-btn dbtn" data-d="info">Info / debug panel<small>For screenshots when something feels off</small></button>';
  h+='<div class="pvnote">'+PHNOTE+'</div><div style="text-align:center;color:#6f664f;font-size:12px;margin:8px 0">Guided Scan v0.8 · Moose Cards</div>';
  $('paneD').innerHTML=h;
  $('impFile').onchange=function(e){ var f=e.target.files&&e.target.files[0]; e.target.value=''; if(f) importFile(f); };
}
$('paneD').addEventListener('click',function(e){
  var b=e.target.closest('[data-d]'); if(!b) return; var a=b.dataset.d;
  if(a==='json') exportJSON(); else if(a==='csv') exportCSV(); else if(a==='lcsv') exportListingCSV(B.cards.slice().sort(cmpDate)); else if(a==='zip') exportZip();
  else if(a==='import') $('impFile').click();
  else if(a==='persist'){ try{ navigator.storage.persist().then(function(ok){ MC().toast(ok?'Protected ✓':'The browser said not now. Keep making backups.',3200,!ok); renderBackup(); }); }catch(x){} }
  else if(a==='info') MC().openInfo();
});
function stamp(){ var d=new Date(); function p(n){return ('0'+n).slice(-2)} return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate()); }
function mbs(b){ return b<1048576?Math.max(1,Math.round(b/1024))+' KB':(b/1048576).toFixed(1)+' MB'; }
function deliver(blob,name,markBackup){
  var f=null; try{ f=new File([blob],name,{type:blob.type}); }catch(e){}
  var u=URL.createObjectURL(blob); setTimeout(function(){URL.revokeObjectURL(u)},900000);
  var cs=false; try{ cs=!!(f&&navigator.canShare&&navigator.canShare({files:[f]})); }catch(e){}
  var btns=[];
  if(cs) btns.push({label:'Share / save…',cls:'gold',keep:true,fn:function(){ navigator.share({files:[f],title:name}).then(function(){ if(markBackup) lsSet('mc-lastexport',Date.now()); MC().toast('Saved ✓'); renderBackup(); }).catch(function(){}); return true; }});
  btns.push({label:'Download '+name+' ('+mbs(blob.size)+')',cls:cs?'ghost':'gold',href:u,download:name,fn:function(){ if(markBackup) lsSet('mc-lastexport',Date.now()); setTimeout(renderBackup,500); return true; }});
  btns.push({label:'Close',cls:'ghost'});
  MC().askDlg('Your file is ready','Keep it somewhere safe, like your Files app, Drive or email to yourself.',btns);
}
function b2d(b){ return b?new Promise(function(res){ var fr=new FileReader(); fr.onload=function(){res(fr.result)}; fr.onerror=function(){res(null)}; fr.readAsDataURL(b); }):Promise.resolve(null); }
async function exportJSON(){
  if(!B.cards.length&&!B.binders.length){ MC().toast('Nothing to export yet. Scan a card first, then come back here.',3200); return; }
  MC().toast('Packing your Binder…',2500);
  flush();
  var parts=['{"app":"moose-cards-binder","version":"0.8","exported":'+JSON.stringify(new Date().toISOString())+',"binders":'+JSON.stringify(B.binders)+',"gone":'+JSON.stringify(Object.keys(B.gone))+',"cards":['];
  for(var i=0;i<B.cards.length;i++){
    var c=B.cards[i], o={}; Object.keys(c).forEach(function(k){ if(['front','back','thumb','photos','clean','cthumb'].indexOf(k)<0) o[k]=c[k]; });
    o.front=await b2d(c.front); o.back=await b2d(c.back); o.photos=[]; o.clean={};
    for(var sd=0;sd<2;sd++){ var sn=sd?'back':'front', cl=cleanOf(c,sn); if(cl) o.clean[sn]={data:await b2d(cl.blob),notes:cl.notes,found:cl.found,msg:cl.msg,ts:cl.ts,mode:cl.mode}; }
    for(var j=0;j<(c.photos||[]).length;j++) o.photos.push({id:c.photos[j].id,data:await b2d(c.photos[j].blob)});
    parts.push((i?',':'')+JSON.stringify(o)); if(i%5===4) await sleep(0);
  }
  parts.push(']}');
  deliver(new Blob(parts,{type:'application/json'}),'moose-cards-binder-'+stamp()+'.json',true);
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
  deliver(new Blob(['\ufeff'+rows.join('\r\n')],{type:'text/csv'}),'moose-cards-listing-DRAFT-'+(list.length===1?'1-card-':'')+stamp()+'.csv',false);
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
  files.push({name:'README.txt',blob:new Blob(['Moose Cards photo export\r\n\r\n-original.jpg  = the photo exactly as you took it.\r\n-cleaned.jpg   = straightened and lighting evened out on your phone. The card itself is unchanged (no scratch, crease or wear touching-up).\r\n-mine-N.jpg    = extra photos you added yourself.\r\n'+(anyC?'':'\r\n(No cleaned photos yet. Use "Clean up photo" on a card.)\r\n')],{type:'text/plain'})});
  var z=await MC().makeZip(files);
  deliver(z,'moose-cards-photos-'+stamp()+'.zip',false);
}
async function d2b(d){ if(!d) return null; var r=await fetch(d); return await r.blob(); }
async function importFile(file){
  var j; try{ j=JSON.parse(await file.text()); }catch(e){ MC().toast('That file is not a Binder backup.',3500,true); return; }
  if(!j||j.app!=='moose-cards-binder'||!Array.isArray(j.cards)){ MC().toast('That file is not a Binder backup.',3500,true); return; }
  var have={}; B.cards.forEach(function(c){have[c.id]=1});
  var fresh=j.cards.filter(function(c){return !have[c.id]}).length;
  MC().askDlg('Restore this backup?',j.cards.length+' cards and '+(j.binders||[]).length+' binders in the file. '+fresh+' card'+(fresh===1?' is':'s are')+' new to this phone and will be added. Cards you already have are left alone.',[
    {label:'Add them',cls:'gold',fn:async function(){
      MC().toast('Restoring…',2500); var added=0;
      for(var i=0;i<j.cards.length;i++){
        var o=j.cards[i]; if(!o||!o.id||have[o.id]) continue;
        var c=newCard(o.id); Object.keys(o).forEach(function(k){ if(['front','back','photos','thumb','clean','cthumb'].indexOf(k)<0) c[k]=o[k]; });
        normCard(c); c.clean={}; c.front=await d2b(o.front); c.back=await d2b(o.back); c.fsize=c.front?c.front.size:0; c.bsize=c.back?c.back.size:0;
        c.photos=[]; for(var p=0;p<(o.photos||[]).length;p++){ var bl=await d2b(o.photos[p].data); if(bl) c.photos.push({id:o.photos[p].id,blob:bl,thumb:await thumb(bl,200)}); }
        if(c.front||c.back) c.thumb=await thumb(c.front||c.back);
        for(var sd=0;sd<2;sd++){ var sn=sd?'back':'front', oc=o.clean&&o.clean[sn]; if(oc&&c[sn]){ var cb=await d2b(oc.data); if(cb) c.clean[sn]={blob:cb,notes:oc.notes||[],found:!!oc.found,msg:oc.msg||'',ts:oc.ts||Date.now(),mode:oc.mode||'raw',src:c[sn].size}; } }
        await refreshCThumb(c);
        delete B.gone[c.id]; del('gone',c.id);
        B.cards.push(c); await put('cards',c); added++; have[c.id]=1; if(i%4===3) await sleep(0);
      }
      (j.binders||[]).forEach(function(ob){ var b=binderById(ob.id); if(!b){ b={id:ob.id,name:ob.name,type:ob.type||'collection',ts:ob.ts||Date.now(),ids:[]}; B.binders.push(b); }
        (ob.ids||[]).forEach(function(id){ if(have[id]&&b.ids.indexOf(id)<0) b.ids.push(id); }); saveBinder(b); });
      MC().toast('Restored '+added+' card'+(added===1?'':'s')+'. ✓',3500); renderBackup(); askPersist();
    }},{label:'Cancel',cls:'ghost'}]);
}

/* ---------- start-up / wiring ---------- */
B.PHNOTE=PHNOTE; B.debugInfo=function(){ return 'binder: '+B.cards.length+' cards, '+B.binders.length+' binders, named '+(B.cards.length-unnamedCount())+', db '+(B.db?'ok':'none')+', sort '+lsGet('mc-sort','date'); };
$('bvSort').innerHTML=SORTS.map(function(s){return '<option value="'+s[0]+'">'+s[1]+'</option>'}).join('');
window.Binder=B; window.__B=B;
})();
