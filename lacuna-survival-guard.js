import {registerBattleHook} from './battle-hooks.js';

registerBattleHook('afterStep','lacuna-survival-objective-guard',({battle})=>{
 if(battle?.nonCombatScenario!=='lacunaSurvival')return;
 const h=battle.lacunaSurvivalHazard;
 if(!h||h.finished)return;
 const living=(battle.ships||[]).some(s=>s.team==='P'&&!s.dead&&!s.civilianEscort);
 battle.winner=living?null:'E';
},225);
