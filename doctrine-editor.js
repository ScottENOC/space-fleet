import {DOCTRINES,registerDoctrine,removeDoctrine,applyDoctrine} from './doctrine-system.js';
import {FORMATIONS,FLEET_DOCTRINES,registerFleetDoctrine,applyFleetDoctrine,setFormation,getFleetState} from './formation-system.js';

const SHIP_KEY='spaceFleet.shipDoctrines.v1';
const FLEET_KEY='spaceFleet.fleetDoctrines.v1';
const POWER=['shieldMaintain','shieldRecharge','engines','weapons','storageRecharge'];
const TARGET=['weapons','engine','reactor','bridge','shield','radiator','armor','hull'];
const DEFENCE=['missile','fighter'];
const names={shieldMaintain:'Shield maintenance',shieldRecharge:'Shield recharge',engines:'Engines',weapons:'Weapons',storageRecharge:'Battery recharge',weaponsT:'Weapons',engine:'Engines',reactor:'Reactor',bridge:'Bridge',shield:'Shield',radiator:'Radiator',armor:'Armour',hull:'Hull',missile:'Incoming missiles',fighter:'Enemy fighters'};
const label=x=>names[x]||x;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function loadSaved(){
  try{for(const d of JSON.parse(localStorage.getItem(SHIP_KEY)||'[]'))registerDoctrine(d)}catch{}
  try{for(const d of JSON.parse(localStorage.getItem(FLEET_KEY)||'[]'))registerFleetDoctrine(d)}catch{}
}
function saveAll(){
  const ships=Object.values(DOCTRINES).filter(d=>!['balanced','codeRed'].includes(d.id));
  const fleets=Object.values(FLEET_DOCTRINES).filter(d=>!['fleetBalanced','fleetCodeRed','broadsideLine','rammingAttack'].includes(d.id));
  localStorage.setItem(SHIP_KEY,JSON.stringify(ships));localStorage.setItem(FLEET_KEY,JSON.stringify(fleets));
}
const idFromName=(prefix,name)=>prefix+'_'+String(name||'custom').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,32)+'_'+Date.now().toString(36).slice(-4);

function optionList(values,current){return values.map(v=>`<option value="${v}" ${v===current?'selected':''}>${esc(label(v))}</option>`).join('')}
function rankEditor(cls,title,values,current){return `<fieldset><legend>${title}</legend>${current.map((v,i)=>`<label>${i+1}<select class="${cls}" data-rank="${i}">${optionList(values,v)}</select></label>`).join('')}</fieldset>`}

function installPane(){
  if(document.querySelector('#doctrine'))return;
  const nav=document.querySelector('.tabs');const battleTab=[...nav.querySelectorAll('.tab')].find(t=>t.dataset.tab==='battle');
  const btn=document.createElement('button');btn.className='tab';btn.dataset.tab='doctrine';btn.textContent='Doctrine';battleTab?.after(btn);
  const pane=document.createElement('section');pane.id='doctrine';pane.className='tabpane doctrinePane';
  pane.innerHTML=`<div class="doctrineEditor">
    <header class="editorHead"><div><h2>Doctrine editor</h2><p>Prepare detailed orders before combat. Opening this during a live battle does not pause it.</p></div></header>
    <div class="editorGrid">
      <section class="editorCard"><h2>Ship doctrine</h2>
        <label>Load preset<select id="editShipLoad"></select></label><label>Name<input id="editShipName" value="Custom ship doctrine"></label>
        <div id="powerRanks"></div><div id="targetRanks"></div><div id="defenceRanks"></div>
        <label>Reserve for point defence (MW)<input id="editReserve" type="number" min="0" step="1" value="6"></label>
        <label>Minimum battery for offensive lasers (%)<input id="editLaserMin" type="number" min="0" max="100" step="5" value="0"></label>
        <label>Ramming policy<select id="editRam"><option value="avoid">Avoid</option><option value="discretion" selected>Captain's discretion</option><option value="ram">Seek ramming opportunities</option></select></label>
        <div class="editorActions"><button id="newShipDoctrine">New</button><button id="saveShipDoctrine">Save ship doctrine</button><button id="deleteShipDoctrine">Delete custom</button></div>
      </section>
      <section class="editorCard"><h2>Fleet doctrine</h2>
        <label>Load preset<select id="editFleetLoad"></select></label><label>Name<input id="editFleetName" value="Custom fleet doctrine"></label>
        <label>Formation<select id="editFormation"></select></label><label>Default ship doctrine<select id="editFleetShipDoctrine"></select></label>
        <p>Fleet doctrine sets fleet geometry and the captain doctrine issued fleet-wide. Individual ships can still receive overrides during battle.</p>
        <div class="editorActions"><button id="newFleetDoctrine">New</button><button id="saveFleetDoctrine">Save fleet doctrine</button><button id="deleteFleetDoctrine">Delete custom</button></div>
        <h2>Formation meanings</h2><p><b>Loose:</b> wide screen; smaller/faster escorts farther outside.<br><b>Tight:</b> compact mutual support.<br><b>Broadside:</b> lateral line around the flagship.<br><b>Ramming wedge:</b> ram-equipped ships forward.<br>Critically damaged ships automatically fall behind the flagship in every formation.</p>
      </section>
    </div></div>`;
  document.querySelector('#battle')?.after(pane);
  btn.onclick=()=>showDoctrine();
}
function showDoctrine(){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab==='doctrine'));
  document.querySelectorAll('.tabpane').forEach(p=>p.classList.toggle('active',p.id==='doctrine'));
}

let editingShipId='balanced',editingFleetId='fleetBalanced';
function refreshLists(){
  const shipSel=document.querySelector('#editShipLoad'),fleetSel=document.querySelector('#editFleetLoad'),fleetShip=document.querySelector('#editFleetShipDoctrine');
  if(shipSel)shipSel.innerHTML=Object.values(DOCTRINES).map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join('');
  if(fleetSel)fleetSel.innerHTML=Object.values(FLEET_DOCTRINES).map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join('');
  if(fleetShip)fleetShip.innerHTML=Object.values(DOCTRINES).map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join('');
  const f=document.querySelector('#editFormation');if(f)f.innerHTML=Object.values(FORMATIONS).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
  refreshBattleFleetControls();
}
function renderShip(d){
  editingShipId=d.id;document.querySelector('#editShipLoad').value=d.id;document.querySelector('#editShipName').value=d.name;
  document.querySelector('#powerRanks').innerHTML=rankEditor('powerRank','Power priority',POWER,d.powerPriority||POWER);
  document.querySelector('#targetRanks').innerHTML=rankEditor('targetRank','Offensive component priority',TARGET,d.targetPriority||TARGET);
  document.querySelector('#defenceRanks').innerHTML=rankEditor('defenceRank','Defensive target priority',DEFENCE,d.defencePriority||DEFENCE);
  document.querySelector('#editReserve').value=(d.reserveDefenceMW||0)/1e6;document.querySelector('#editLaserMin').value=Math.round((d.laserMinStorageFraction||0)*100);document.querySelector('#editRam').value=d.ramMode||'discretion';
}
function collectRanks(cls){return [...document.querySelectorAll('.'+cls)].sort((a,b)=>+a.dataset.rank-+b.dataset.rank).map(x=>x.value)}
function uniqueRanks(arr,defaults){const out=[];for(const x of arr)if(!out.includes(x))out.push(x);for(const x of defaults)if(!out.includes(x))out.push(x);return out.slice(0,defaults.length)}
function collectShip(){
  return{id:editingShipId,name:document.querySelector('#editShipName').value.trim()||'Custom ship doctrine',powerPriority:uniqueRanks(collectRanks('powerRank'),POWER),targetPriority:uniqueRanks(collectRanks('targetRank'),TARGET),defencePriority:uniqueRanks(collectRanks('defenceRank'),DEFENCE),reserveDefenceMW:Math.max(0,+document.querySelector('#editReserve').value||0)*1e6,laserMinStorageFraction:Math.max(0,Math.min(1,(+document.querySelector('#editLaserMin').value||0)/100)),ramMode:document.querySelector('#editRam').value};
}
function renderFleet(d){editingFleetId=d.id;document.querySelector('#editFleetLoad').value=d.id;document.querySelector('#editFleetName').value=d.name;document.querySelector('#editFormation').value=d.formation||'loose';document.querySelector('#editFleetShipDoctrine').value=d.shipDoctrine||'balanced';}
function collectFleet(){return{id:editingFleetId,name:document.querySelector('#editFleetName').value.trim()||'Custom fleet doctrine',formation:document.querySelector('#editFormation').value,shipDoctrine:document.querySelector('#editFleetShipDoctrine').value};}

function bindEditor(){
  document.querySelector('#editShipLoad').onchange=e=>renderShip(DOCTRINES[e.target.value]||DOCTRINES.balanced);
  document.querySelector('#editFleetLoad').onchange=e=>renderFleet(FLEET_DOCTRINES[e.target.value]||FLEET_DOCTRINES.fleetBalanced);
  document.querySelector('#newShipDoctrine').onclick=()=>{editingShipId=idFromName('ship','custom');renderShip({...DOCTRINES.balanced,id:editingShipId,name:'Custom ship doctrine'})};
  document.querySelector('#saveShipDoctrine').onclick=()=>{let d=collectShip();if(['balanced','codeRed'].includes(d.id))d={...d,id:idFromName('ship',d.name)};registerDoctrine(d);editingShipId=d.id;saveAll();refreshLists();renderShip(DOCTRINES[d.id]);};
  document.querySelector('#deleteShipDoctrine').onclick=()=>{removeDoctrine(editingShipId);editingShipId='balanced';saveAll();refreshLists();renderShip(DOCTRINES.balanced)};
  document.querySelector('#newFleetDoctrine').onclick=()=>{editingFleetId=idFromName('fleet','custom');renderFleet({...FLEET_DOCTRINES.fleetBalanced,id:editingFleetId,name:'Custom fleet doctrine'})};
  document.querySelector('#saveFleetDoctrine').onclick=()=>{let d=collectFleet();if(['fleetBalanced','fleetCodeRed','broadsideLine','rammingAttack'].includes(d.id))d={...d,id:idFromName('fleet',d.name)};registerFleetDoctrine(d);editingFleetId=d.id;saveAll();refreshLists();renderFleet(FLEET_DOCTRINES[d.id]);};
  document.querySelector('#deleteFleetDoctrine').onclick=()=>{if(!['fleetBalanced','fleetCodeRed','broadsideLine','rammingAttack'].includes(editingFleetId))delete FLEET_DOCTRINES[editingFleetId];editingFleetId='fleetBalanced';saveAll();refreshLists();renderFleet(FLEET_DOCTRINES.fleetBalanced)};
}

function currentBattle(){return window.__fleetBattle}
function applyPlayerFleetDoctrine(id){const b=currentBattle();if(!b)return;const d=applyFleetDoctrine(b,'P',id,applyDoctrine);b.log(`Fleet doctrine: ${d.name}; formation ${FORMATIONS[d.formation]?.name||d.formation}.`);refreshBattleFleetControls();}
function installBattleFleetControls(){
  const orders=document.querySelector('.orders');if(!orders||document.querySelector('#fleetDoctrineQuick'))return;
  const box=document.createElement('div');box.className='fleetDoctrineQuick';box.innerHTML=`<h2>Fleet command</h2><label>Fleet doctrine<select id="fleetDoctrineQuick"></select></label><label>Formation<select id="formationQuick"></select></label><div class="formationButtons"><button data-formation="loose">Loose</button><button data-formation="tight">Tight</button><button data-formation="broadside">Broadside</button><button data-formation="ramming">Ramming wedge</button></div><p id="flagshipReadout">Flagship pending.</p>`;orders.prepend(box);
  box.querySelector('#fleetDoctrineQuick').onchange=e=>applyPlayerFleetDoctrine(e.target.value);
  box.querySelector('#formationQuick').onchange=e=>{const b=currentBattle();if(b){const f=setFormation(b,'P',e.target.value);b.log(`Player formation: ${f.name}.`);refreshBattleFleetControls();}};
  box.querySelectorAll('[data-formation]').forEach(btn=>btn.onclick=()=>{const b=currentBattle();if(b){const f=setFormation(b,'P',btn.dataset.formation);b.log(`Player formation: ${f.name}.`);refreshBattleFleetControls();}});
}
function refreshBattleFleetControls(){
  const fd=document.querySelector('#fleetDoctrineQuick'),fq=document.querySelector('#formationQuick');if(fd)fd.innerHTML=Object.values(FLEET_DOCTRINES).map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join('');if(fq)fq.innerHTML=Object.values(FORMATIONS).map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join('');
  const b=currentBattle();if(!b)return;const st=getFleetState(b,'P');if(st){if(fd)fd.value=st.fleetDoctrineId||'fleetBalanced';if(fq)fq.value=st.formation||'loose';const flag=b.ships.find(s=>s.uid===st.flagshipUid);const read=document.querySelector('#flagshipReadout');if(read)read.innerHTML=`Admiral: <b>${esc(flag?.name||'command transfer')}</b> · ${esc(FORMATIONS[st.formation]?.name||st.formation)}`;}
}

loadSaved();installPane();refreshLists();renderShip(DOCTRINES.balanced);renderFleet(FLEET_DOCTRINES.fleetBalanced);bindEditor();installBattleFleetControls();setInterval(refreshBattleFleetControls,300);
