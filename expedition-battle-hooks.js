import {campaign} from './campaign-core.js';
import {registerBattleHook} from './battle-hooks.js';
import {resolveExpeditionBattle} from './expedition-system.js?v=73';

registerBattleHook('afterStep','mystery-expedition-outcome',({battle})=>{
 if(!battle?.campaignBattle||!battle.winner||battle._mysteryExpeditionResolved)return;
 const enc=campaign.pendingEncounter;if(enc?.kind!=='mystery')return;
 battle._mysteryExpeditionResolved=true;
 resolveExpeditionBattle(enc,battle.winner);
},-80);
