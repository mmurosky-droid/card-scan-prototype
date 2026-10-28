/* Collectors Desk v0.9 (Mr. Moose Enterprises, LLC) - Listing sheet logic (pure functions, no network, no prices).
   Drafts a title and description from the card's fields. Everything here is a DRAFT for the user to review. */
(function(){
'use strict';
var MAXT=80;
var FLAWS=[['corners','Corners'],['edges','Edges'],['surface','Surface'],['centering','Centering'],['other','Other']];
var FLAW_PHRASE={corners:'corner wear',edges:'edge wear',surface:'surface marks',centering:'off-center',other:'other flaw (see notes)'};
var MAKERS=['Topps','Bowman','Panini','Donruss','Upper Deck','Leaf','Fleer','Score','Skybox','Sage','Playoff','Pinnacle','Stadium Club'];
var NOTE='Draft for review, not an official eBay file. No eBay connection.';
function s(v){ return v==null?'':String(v).trim(); }
function maker(brand){ var b=s(brand).toLowerCase(), i; for(i=0;i<MAKERS.length;i++) if(b.indexOf(MAKERS[i].toLowerCase())>=0) return MAKERS[i]==='Bowman'||MAKERS[i]==='Stadium Club'?'Topps':MAKERS[i]; if(/prizm|optic|mosaic|select|chronicles|contenders|absolute|score/.test(b)) return 'Panini'; return ''; }
function features(c){ var f=[]; if(c.rookie) f.push('Rookie'); if(c.auto) f.push('Autograph'); if(c.relic) f.push('Patch/Relic'); return f; }
function flawList(c){ var f=(c.flaws||[]).map(function(k){return FLAW_PHRASE[k]}).filter(Boolean); return f; }
function gradedLabel(c){ return c.cond==='graded'?[s(c.grader),s(c.grade)].filter(Boolean).join(' '):''; }
/* title: most useful words first; if over 80 characters, drop the least important words first */
function draftTitle(c){
  var cert=null;
  var tk=[
    {t:s(c.year),p:2},{t:s(c.brand),p:2},{t:s(c.player),p:1},
    {t:s(c.parallel),p:4},{t:s(c.number)?'#'+s(c.number).replace(/^#/,''):'',p:3},{t:s(c.serial),p:5},
    {t:c.rookie?'RC':'',p:6},{t:c.auto?'Auto':'',p:6},{t:c.relic?'Patch':'',p:7},{t:gradedLabel(c),p:1}
  ].filter(function(x){return x.t});
  function join(){ return tk.map(function(x){return x.t}).join(' '); }
  while(join().length>MAXT&&tk.length>1){ var w=0,i; for(i=1;i<tk.length;i++) if(tk[i].p>=tk[w].p) w=i; tk.splice(w,1); }
  var out=join(); if(out.length>MAXT){ out=out.slice(0,MAXT); out=out.replace(/\s+\S*$/,'')||out; }
  return out;
}
function draftDesc(c,opts){
  opts=opts||{}; var L=[], t=draftTitle(c), f=features(c), fl=flawList(c);
  var core=[['Player',c.player],['Sport',c.sport],['Team',c.team],['Year',c.year],['Set',c.brand],['Card number',c.number?'#'+s(c.number).replace(/^#/,''):''],['Parallel / variation',c.parallel],['Serial / print run',c.serial]].filter(function(x){return s(x[1])});
  L.push(t||'Trading card');
  L.push('');
  core.forEach(function(x){ L.push(x[0]+': '+s(x[1])); });
  if(f.length) L.push('Features: '+f.join(', '));
  L.push('');
  if(c.cond==='graded'){ L.push('Graded: '+(gradedLabel(c)||'grade not entered')+(s(c.cert)?'. Certification number: '+s(c.cert):'')+'.'); if(s(c.condNotes)) L.push(s(c.condNotes)); }
  else { L.push('Raw card, not graded.'+(s(c.condNotes)?' '+s(c.condNotes):'')); }
  if(fl.length||s(c.flawText)){ L.push('Flaws I noticed: '+(fl.length?fl.join(', '):'')+(fl.length&&s(c.flawText)?'. ':'')+(s(c.flawText)?s(c.flawText):'')+(/[.!?]$/.test(s(c.flawText))||!s(c.flawText)?'':'.')); }
  else L.push('I have not noted any flaws. Please look closely at the photos.');
  L.push('');
  L.push('The photos show the actual card you will receive.');
  if(opts.cleaned) L.push('Photos were straightened and brightened for lighting only. The card itself has not been edited.');
  return L.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
function copyText(c,opts){ return (s(c.ls&&c.ls.title)||draftTitle(c))+'\n\n'+(s(c.ls&&c.ls.desc)||draftDesc(c,opts)); }
var HEADERS=['Title','Description','Player/Athlete','Sport','Team','Year Manufactured','Manufacturer','Set','Card Number','Parallel/Variety','Print Run / Serial','Graded','Professional Grader','Grade','Certification Number','Features','Condition notes','Your price (typed by you)','Photo files (original)','Photo files (cleaned)','Check these fields (not confirmed yet)','Draft note'];
function guessed(c){ return Object.keys(c.guess||{}).filter(function(k){return c.guess[k]}); }
var GNAME={player:'Player',team:'Team',year:'Year',brand:'Set',number:'Card number',parallel:'Parallel',serial:'Serial / print run',sport:'Sport',cert:'Cert number',grade:'Grade',grader:'Grader',slab:'Grader, grade or cert number',flags:'Features'};
function row(c,photos){
  var fl=flawList(c), cn=[]; if(c.cond==='graded'){ if(s(c.condNotes)) cn.push(s(c.condNotes)); } else cn.push('Raw'+(s(c.condNotes)?': '+s(c.condNotes):''));
  if(fl.length) cn.push('Flaws: '+fl.join(', ')); if(s(c.flawText)) cn.push(s(c.flawText));
  photos=photos||{};
  return [ (c.ls&&s(c.ls.title))||draftTitle(c), (c.ls&&s(c.ls.desc))||draftDesc(c,{cleaned:!!photos.cleaned}), c.player, c.sport, c.team, c.year, maker(c.brand), c.brand, c.number, c.parallel, c.serial,
    c.cond==='graded'?'Yes':'No', c.cond==='graded'?c.grader:'', c.cond==='graded'?c.grade:'', c.cond==='graded'?c.cert:'', features(c).join('; '), cn.join(' | '),
    c.price===''||c.price==null?'':c.price, photos.orig||'', photos.cleaned||'', guessed(c).map(function(k){return GNAME[k]||k}).join('; '), NOTE ];
}
window.Listing={MAXT:MAXT,FLAWS:FLAWS,NOTE:NOTE,HEADERS:HEADERS,draftTitle:draftTitle,draftDesc:draftDesc,copyText:copyText,row:row,maker:maker,features:features,guessed:guessed,gradedLabel:gradedLabel};
})();
