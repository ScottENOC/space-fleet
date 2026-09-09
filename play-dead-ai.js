import {registerBattleHook} from './battle-hooks.js';

function contact(b,s,t){return typeof window!=='undefined'?window.__sensorGetContact?.(b,s.team,t.uid):null}

// Offensive fire normally ignores contacts assessed as combat-ineffective. Point
// defence remains outside this filter, so missiles/fighters/boarding craft stay threats.
registerBattleHook('beforeFireWeapons','play-dead-target-filter',(ctx)=>{
 const s=ctx.ship;if(s.finishDisabledTargets)return;
 const hidden=[];
 for(const t of ctx.battle.ships||[]){
   if(t.dead||t.team===s.team)continue;
   const c=contact(ctx.battle,s,t);
   if(c?.apparentlyDisabled&&c.quality>=.25){hidden.push([t,t.dead]);t.dead=true;}
 }
 ctx._playDeadHidden=hidden;
},100);

registerBattleHook('afterFireWeapons','play-dead-target-restore',(ctx)=>{
 for(const[t,d]of ctx._playDeadHidden||[])t.dead=d;
},-100);
