import {registerBattleHook} from './battle-hooks.js';

const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const health=s=>{const ms=s?.modules||[],max=ms.reduce((n,m)=>n+(m.maxHp||m.hp||1),0)||1;return ms.reduce((n,m)=>n+Math.max(0,m.hp||0),0)/max};
const active=s=>s&&!s.dead&&!s.escaped&&!s.surrendered;
const players=b=>(b.ships||[]).filter(s=>s.team==='P'&&!s.missionProtectedShip&&active(s));
const target=b=>(b.ships||[]).find(s=>s.missionObjectiveTarget);
const protectedShip=b=>(b.ships||[]).find(s=>s.missionProtectedShip);

function ensure(b){
 if(!b?.combatObjectiveType)return null;
 if(b.combatObjectiveState)return b.combatObjectiveState;
 const type=b.combatObjectiveType;
 const t=target(b),p=protectedShip(b);
 const label=type==='destroyTarget'?'Targeted strike':'Cover withdrawal';
 const brief=type==='destroyTarget'
  ?`Destroy ${t?.name||'the designated vessel'}. Once it is destroyed, further fighting is optional.`
  :`Keep ${p?.name||'the designated vessel'} alive until it successfully disengages. Once it escapes, further fighting is optional.`;
 b.combatObjectiveState={type,label,brief,complete:false,failed:false,completedAt:null};
 b.log(`${label}: ${brief}`);
 return b.combatObjectiveState;
}

function updateTargetBehaviour(b,st){
 if(st.type!=='destroyTarget'||st.complete||st.failed)return;
 const t=target(b);if(!active(t))return;
 const nearest=players(b).sort((a,c)=>dist(a,t)-dist(c,t))[0];
 if((nearest&&dist(nearest,t)<3200)||health(t)<.72){
  if(!t.withdrawOrder)b.log(`${t.name}: designated target begins emergency withdrawal.`);
  t.withdrawOrder=true;t.ramPolicy='avoid';t.formationDiscipline='independent';t.order='PROTECT FLAGSHIP / WITHDRAW';
 }
}

function resolve(b){
 const st=ensure(b);if(!st||st.failed)return;
 if(st.type==='destroyTarget'){
  const t=target(b);if(!t)return;
  if(!st.complete&&(t.dead||t.outcome==='captured')){
   st.complete=true;st.completedAt=b.t;
   b.missionResult={success:true,type:'destroyTarget',payoutFactor:1,summary:`Designated target ${t.name} destroyed; contract objective achieved.`};
   b.log(`PRIMARY OBJECTIVE COMPLETE: ${t.name} destroyed. Withdraw or continue engagement at captain's discretion.`);
  }else if(!st.complete&&t.escaped){
   st.failed=true;b.missionResult={success:false,type:'destroyTarget',payoutFactor:0,reason:`${t.name} escaped`};b.winner='E';
   b.log(`Targeted strike failed: ${t.name} escaped.`);
  }
 }else if(st.type==='protectWithdrawal'){
  const p=protectedShip(b);if(!p)return;
  if(!st.complete&&p.escaped){
   st.complete=true;st.completedAt=b.t;
   b.missionResult={success:true,type:'protectWithdrawal',payoutFactor:1,summary:`${p.name} disengaged safely; escort objective achieved.`};
   b.log(`PRIMARY OBJECTIVE COMPLETE: ${p.name} is clear. Withdraw or continue engagement at captain's discretion.`);
  }else if(!st.complete&&(p.dead||p.outcome==='captured'||p.surrendered)){
   st.failed=true;b.missionResult={success:false,type:'protectWithdrawal',payoutFactor:0,reason:`${p.name} was lost before disengaging`};b.winner='E';
   b.log(`Cover withdrawal failed: ${p.name} was lost.`);
  }
 }
}

registerBattleHook('afterStep','combat-objective-resolution',({battle})=>{if(!battle?.combatObjectiveType)return;const st=ensure(battle);updateTargetBehaviour(battle,st);resolve(battle)},250);

export function combatObjectiveSummary(b){
 const st=b?.combatObjectiveType?ensure(b):null;if(!st)return null;
 const t=target(b),p=protectedShip(b),ship=st.type==='destroyTarget'?t:p;
 return{...st,target:ship?{name:ship.name,health:+health(ship).toFixed(2),dead:!!ship.dead,escaped:!!ship.escaped,withdrawing:!!ship.withdrawOrder}:null};
}
if(typeof window!=='undefined')window.__combatObjectiveSummary=()=>combatObjectiveSummary(window.__fleetBattle);
