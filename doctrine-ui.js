import {Battle} from './sim.js';
import {DOCTRINES,applyDoctrine} from './doctrine-system.js';
import {getPowerState} from './power-system.js';

const baseStep=Battle.prototype.step;
Battle.prototype.step=function(dt){window.__fleetBattle=this;return baseStep.call(this,dt)};

function selectedPlayerShips(battle){
  const recipient=document.querySelector('#orderShips')?.value||'all';
  return battle.ships.filter(s=>s.team==='P'&&!s.dead&&(recipient==='all'||s.uid===recipient));
}
function applyPreset(id){
  const b=window.__fleetBattle;if(!b)return;
  const ships=selectedPlayerShips(b);
  const d=DOCTRINES[id]||DOCTRINES.balanced;
  for(const s of ships)applyDoctrine(s,id);
  b.log(`Player doctrine: ${ships.map(s=>s.name).join(', ')} -> ${d.name}.`);
}

function installControls(){
  const orders=document.querySelector('.orders');if(!orders||document.querySelector('#doctrinePreset'))return;
  const wrap=document.createElement('div');wrap.className='doctrineControls';
  wrap.innerHTML=`<h2>Captain doctrine</h2>
    <label>Preset<select id="doctrinePreset"><option value="balanced">Balanced action</option><option value="codeRed">Code Red</option></select></label>
    <div class="doctrineButtons"><button id="balancedNow">Balanced</button><button id="codeRedNow">CODE RED</button></div>
    <p><b>Code Red:</b> shield maintenance/recharge first, then engines, then weapons; reserve power for point defence; engage missiles before fighters; offensive lasers wait for >=95% battery charge.</p>`;
  orders.prepend(wrap);
  document.querySelector('#balancedNow').onclick=()=>applyPreset('balanced');
  document.querySelector('#codeRedNow').onclick=()=>applyPreset('codeRed');
  document.querySelector('#doctrinePreset').onchange=e=>applyPreset(e.target.value);
}

function fmtMW(w){return `${(w/1e6).toFixed(w>=100e6?0:1)} MW`}
function powerLine(s){
  const p=getPowerState(s),pct=p.maxMWh>0?Math.round(100*p.storedMWh/p.maxMWh):0;
  const deficit=p.unmetMW>1e3?` · <b>${fmtMW(p.unmetMW)} unmet</b>`:'';
  const storage=p.maxMWh>0?`${p.storedMWh.toFixed(3)}/${p.maxMWh.toFixed(3)} MWh (${pct}%)`:'no storage';
  const groups=p.groups||{};
  const label=k=>({shieldMaintain:'shield hold',shieldRecharge:'shield recharge',engines:'engines',weapons:'weapons',defence:'point defence',offence:'offence'}[k]||k);
  const active=Object.entries(groups).filter(([,g])=>g.requested>1e3).map(([k,g])=>`${label(k)} ${fmtMW(g.supplied)}`).join(' · ');
  return `<div class="powercard"><b>${s.name}</b> · ${s.doctrineId==='codeRed'?'CODE RED':'Balanced'}<br>
    generation ${fmtMW(p.generationMW)} · load ${fmtMW(p.demandMW)} · battery ${fmtMW(p.storageMW)}${deficit}<br>
    <small>stored ${storage}${active?` · ${active}`:''}</small></div>`;
}
function refreshTelemetry(){
  const b=window.__fleetBattle;if(!b)return;
  let host=document.querySelector('#powerReadout');
  if(!host){host=document.createElement('div');host.id='powerReadout';const stats=document.querySelector('#stats');stats?.before(host)}
  if(host)host.innerHTML='<h2>Power</h2>'+b.ships.filter(s=>!s.dead).map(powerLine).join('');
}

installControls();
setInterval(refreshTelemetry,200);
