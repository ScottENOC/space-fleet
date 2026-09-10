const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const mobile=()=>matchMedia('(max-width:760px)').matches;

function lastName(name=''){const bits=String(name).trim().split(/\s+/);return bits[bits.length-1]||name}
function roleAbbrev(title=''){return({Captain:'Cpt','Chief Engineer':'Eng','Chief Gunner':'Gun','Tactical Officer':'Tac','Damage Control Officer':'DC','Executive Officer':'XO',Helmsman:'Helm',CAG:'CAG'})[title]||title.split(/\s+/).map(x=>x[0]).join('').slice(0,4)}
function compactTraffic(){
 const b=window.__fleetBattle;
 for(const card of $$('#crewInbox .crewReport')){
  const meta=card.querySelector('.reportMeta'),ship=meta?.querySelector('b'),detail=meta?.querySelector('span'),severity=meta?.querySelector('em');
  if(!meta||!ship||!detail)continue;
  const raw=detail.dataset.raw||detail.textContent||'';detail.dataset.raw=raw;
  const [title='',officer='']=raw.split(' · ');
  const compact=`${ship.dataset.raw||ship.textContent} — ${roleAbbrev(title)} ${lastName(officer)}`;
  if(!ship.dataset.raw)ship.dataset.raw=ship.textContent;
  ship.textContent=compact;
  if(severity&&severity.textContent!=='CRITICAL')severity.textContent='';
 }
}
function closeBattleSheets(except=null){for(const id of ['hudTraffic','hudFleetStrip','hudEnemyStrip']){const el=$('#'+id);if(el&&el!==except)el.classList.remove('mobileOpen')}}
function installBattleControls(){
 const hud=$('.battleHud');if(!hud||$('#mobileCommsButton'))return;
 const right=$('#hudTopRight');
 const comms=document.createElement('button');comms.id='mobileCommsButton';comms.textContent='Comms';
 right?.append(comms);
 const contacts=document.createElement('button');contacts.id='mobileContactsButton';contacts.textContent='Contacts';hud.append(contacts);
 const fleet=document.createElement('button');fleet.id='mobileFleetButton';fleet.textContent='Fleet';hud.append(fleet);
 const traffic=$('#hudTraffic'),strip=$('#hudFleetStrip'),enemy=$('#hudEnemyStrip'),ship=$('#hudShipInfo');
 comms.onclick=()=>{if(!mobile())return;const open=!traffic?.classList.contains('mobileOpen');closeBattleSheets(open?traffic:null);traffic?.classList.toggle('mobileOpen',open)};
 contacts.onclick=()=>{if(!mobile())return;const open=!enemy?.classList.contains('mobileOpen');closeBattleSheets(open?enemy:null);enemy?.classList.toggle('mobileOpen',open)};
 fleet.onclick=()=>{if(!mobile())return;const open=!strip?.classList.contains('mobileOpen');closeBattleSheets(open?strip:null);strip?.classList.toggle('mobileOpen',open)};
 ship?.addEventListener('click',e=>{if(!mobile()||e.target.closest('button,select,input'))return;ship.classList.toggle('mobileExpanded')});
 document.addEventListener('pointerdown',e=>{if(!mobile())return;const inside=e.target.closest('#hudTraffic,#hudFleetStrip,#hudEnemyStrip,#mobileCommsButton,#mobileFleetButton,#mobileContactsButton');if(!inside)closeBattleSheets()},true);
}
function updateBattleControls(){
 if(!mobile())return;
 const b=window.__fleetBattle;if(!b)return;
 const all=(b.crewInbox||[]).filter(r=>b.ships?.find(s=>s.uid===r.shipUid)?.team==='P'),open=all.filter(r=>r.request&&r.status==='open').length;
 const comms=$('#mobileCommsButton');if(comms){comms.textContent=open?`Comms ${open}`:'Comms';comms.classList.toggle('hasOpen',open>0)}
 const contacts=$('#mobileContactsButton'),enemies=(b.ships||[]).filter(s=>s.team==='E'&&!s.dead).length;if(contacts)contacts.textContent=`Contacts ${enemies}`;
 const fleet=$('#mobileFleetButton'),ours=(b.ships||[]).filter(s=>s.team==='P'&&!s.dead).length;if(fleet)fleet.textContent=`Fleet ${ours}`;
 compactTraffic();
}
function moduleCategory(id=''){if(/^missile_|^gun_|^laser_/.test(id))return'Weapons';if(/^engine_|^thruster_|^reactor_/.test(id))return'Power';if(/^fighter|^hangar|^launch/.test(id))return'Craft';return'Structure'}
function filterPalette(category='All'){$$('#palette .module').forEach(btn=>{btn.style.display=category==='All'||moduleCategory(btn.dataset.module)===category?'':'none'});$$('.mobilePaletteFilters button').forEach(b=>b.classList.toggle('active',b.dataset.category===category))}
function installShipyardSheet(){
 const palette=$('.palette');if(!palette||$('#mobileComponentsButton'))return;
 const head=document.createElement('div');head.className='mobilePaletteHead';head.innerHTML='<b>Components</b><button type="button" id="mobilePaletteClose">Done</button>';palette.prepend(head);
 const filters=document.createElement('div');filters.className='mobilePaletteFilters';filters.innerHTML=['All','Weapons','Power','Craft','Structure'].map(x=>`<button type="button" data-category="${x}"${x==='All'?' class="active"':''}>${x}</button>`).join('');head.after(filters);
 filters.querySelectorAll('button').forEach(b=>b.onclick=()=>filterPalette(b.dataset.category));
 const open=document.createElement('button');open.id='mobileComponentsButton';open.type='button';open.textContent='Components';document.body.append(open);
 open.onclick=()=>{if(mobile())palette.classList.add('mobileOpen')};$('#mobilePaletteClose').onclick=()=>palette.classList.remove('mobileOpen');
 palette.addEventListener('click',e=>{if(mobile()&&e.target.closest('.module'))setTimeout(()=>palette.classList.remove('mobileOpen'),0)});
}
function syncShipyardButton(){const btn=$('#mobileComponentsButton');if(!btn)return;btn.style.display=mobile()&&$('#shipyard')?.classList.contains('active')?'block':'none'}
function installStandaloneHints(){
 if(!document.querySelector('link[rel="manifest"]')){const l=document.createElement('link');l.rel='manifest';l.href='manifest.webmanifest?v=61';document.head.append(l)}
 const metas=[['mobile-web-app-capable','yes'],['apple-mobile-web-app-capable','yes'],['apple-mobile-web-app-status-bar-style','black-translucent'],['theme-color','#03070d']];
 for(const [name,content] of metas)if(!document.querySelector(`meta[name="${name}"]`)){const m=document.createElement('meta');m.name=name;m.content=content;document.head.append(m)}
}

installStandaloneHints();installBattleControls();installShipyardSheet();
addEventListener('resize',()=>{closeBattleSheets();syncShipyardButton()});
setInterval(()=>{installBattleControls();installShipyardSheet();updateBattleControls();syncShipyardButton()},180);
