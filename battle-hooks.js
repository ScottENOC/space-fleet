import {Battle} from './sim.js';

// Central integration point for cross-cutting combat systems. New systems should
// register hooks here instead of capturing/replacing Battle.prototype methods.
const phases=new Map();
const installed=new Set();

function list(phase){let x=phases.get(phase);if(!x){x=[];phases.set(phase,x)}return x}
export function registerBattleHook(phase,id,fn,priority=0){
  if(!phase||!id||typeof fn!=='function')throw new Error('registerBattleHook requires phase, id and function');
  const key=`${phase}:${id}`;if(installed.has(key))return false;installed.add(key);
  list(phase).push({id,fn,priority});list(phase).sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));return true;
}
function run(phase,ctx){for(const h of list(phase))h.fn(ctx)}

// Capture the existing, older wrapper stack once. Everything loaded after this
// file composes through explicit phases instead of depending on script order.
const BASE={
 step:Battle.prototype.step,
 applySystems:Battle.prototype.applySystems,
 fireWeapons:Battle.prototype.fireWeapons,
 updateProjectiles:Battle.prototype.updateProjectiles,
 hitRay:Battle.prototype.hitRay,
 enemy:Battle.prototype.enemy
};

Battle.prototype.step=function(dt){
 const ctx={battle:this,dt,result:undefined};run('beforeStep',ctx);ctx.result=BASE.step.call(this,dt);run('afterStep',ctx);return ctx.result;
};
Battle.prototype.applySystems=function(ship,dt){
 const ctx={battle:this,ship,dt,result:undefined,skipBase:false};run('beforeApplySystems',ctx);if(!ctx.skipBase)ctx.result=BASE.applySystems.call(this,ship,dt);run('afterApplySystems',ctx);return ctx.result;
};
Battle.prototype.updateProjectiles=function(dt){
 const ctx={battle:this,dt,result:undefined};run('beforeProjectiles',ctx);ctx.result=BASE.updateProjectiles.call(this,dt);run('afterProjectiles',ctx);return ctx.result;
};
Battle.prototype.enemy=function(ship){
 const ctx={battle:this,ship,result:BASE.enemy.call(this,ship)};run('resolveEnemy',ctx);return ctx.result;
};
Battle.prototype.fireWeapons=function(ship,target,powerBudget){
 const ctx={battle:this,ship,target,powerBudget,result:undefined,handled:false};run('beforeFireWeapons',ctx);if(!ctx.handled)ctx.result=BASE.fireWeapons.call(this,ctx.ship,ctx.target,ctx.powerBudget);run('afterFireWeapons',ctx);return ctx.result;
};
Battle.prototype.hitRay=function(attacker,target,damage,kind,ray={}){
 const ctx={battle:this,attacker,target,damage,kind,ray:{...ray},cancel:false,result:undefined};run('beforeHitRay',ctx);if(!ctx.cancel)ctx.result=BASE.hitRay.call(this,ctx.attacker,ctx.target,ctx.damage,ctx.kind,ctx.ray);run('afterHitRay',ctx);return ctx.result;
};

export function battleHookSummary(){return Object.fromEntries([...phases].map(([k,v])=>[k,v.map(x=>({id:x.id,priority:x.priority}))]))}
if(typeof window!=='undefined')window.__battleHookSummary=battleHookSummary;
