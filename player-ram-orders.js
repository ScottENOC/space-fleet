import {Battle} from './sim.js';

const baseAI=Battle.prototype.ai;

function commandedEnemy(b,s){
  const enemies=b.ships.filter(o=>!o.dead&&o.team!==s.team);
  if(!enemies.length)return null;
  if(s.commandTargetId){
    const picked=enemies.find(o=>o.uid===s.commandTargetId);
    if(picked)return picked;
  }
  return enemies.sort((a,c)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(c.x-s.x,c.y-s.y))[0];
}

// Collision-system.js supplies captain's-discretion ramming. This wrapper adds
// explicit player orders without changing the underlying impact physics.
Battle.prototype.ai=function(s,e){
  baseAI.call(this,s,e);
  if(s.team!=='P')return;

  const policy=s.ramPolicy||'discretion';
  if(policy==='avoid'){
    s.ramIntent=false;
    if((s.order||'').includes('ram'))s.order='Avoid collision; continue engagement';
    return;
  }
  if(policy!=='ram')return;

  const target=commandedEnemy(this,s);
  if(!target){s.ramIntent=false;return;}
  s.ramIntent=true;
  s.commandTargetId=target.uid;
  const dx=target.x-s.x,dy=target.y-s.y;
  s.desiredAngle=Math.atan2(dy,dx);
  s.throttle=1;
  s.order=`RAM ${target.name}`;
};

function selectedPlayerShips(){
  const battle=window.__fleetBattle;
  if(!battle)return[];
  const recipient=document.querySelector('#orderShips')?.value||'all';
  return battle.ships.filter(s=>s.team==='P'&&!s.dead&&(recipient==='all'||s.uid===recipient));
}

function applyRamPolicy(){
  const battle=window.__fleetBattle;
  if(!battle)return;
  const mode=document.querySelector('#orderRam')?.value||'discretion';
  const target=document.querySelector('#orderTarget')?.value||'any';
  const ships=selectedPlayerShips();
  for(const s of ships){
    s.ramPolicy=mode;
    if(mode==='ram'&&target!=='any')s.commandTargetId=target;
  }
  const label=mode==='avoid'?'avoid collisions':mode==='ram'?'ram target':'captain’s discretion';
  const targetName=document.querySelector('#orderTarget')?.selectedOptions?.[0]?.textContent||'current target';
  battle.log(`Player collision order: ${ships.map(s=>s.name).join(', ')} — ${label}${mode==='ram'?` (${targetName})`:''}.`);
}

// main.js owns battle construction. Expose the current instance through a tiny
// getter hook so this command layer can modify the same ships without duplicating UI logic.
const fight=document.querySelector('#reset');
const apply=document.querySelector('#applyTargetOrder');
apply?.addEventListener('click',()=>queueMicrotask(applyRamPolicy));
fight?.addEventListener('click',()=>queueMicrotask(()=>{
  // New ships default to captain's discretion until the player issues another order.
  const b=window.__fleetBattle;if(b)for(const s of b.ships)if(s.team==='P')s.ramPolicy='discretion';
}));
