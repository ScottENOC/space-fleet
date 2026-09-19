import {campaign} from './campaign-core.js';
import {registerBattleHook} from './battle-hooks.js';

registerBattleHook('afterStep','lacuna-debris-objective-guard',({battle})=>{
 if(battle?.nonCombatScenario!=='lacunaTransit'||!battle.lacunaHazard||battle.lacunaHazard.finished)return;
 const h=battle.lacunaHazard,living=(battle.ships||[]).some(s=>s.team==='P'&&!s.dead&&!s.civilianEscort);
 if(!living){battle.winner='E';return}
 const elapsed=battle.t-h.startedAt;if(elapsed<h.duration)battle.winner=null;
},210);

if(typeof document!=='undefined')document.addEventListener('click',e=>{
 const target=e.target?.closest?.('[data-travel],[data-repair],[data-buyhull],[data-contract],[data-buygood],[data-sellgood]');if(!target)return;
 const g=campaign.mainPlot?.gauntlet,atLacuna=campaign.location==='Lacuna Reach';
 if(g?.active||atLacuna){e.preventDefault();e.stopImmediatePropagation();const reason=g?.active?'The fleet is committed to the Lacuna transit. There is no gate diversion, dockyard, market or resupply access between legs.':'Lacuna Reach has no functioning registered dockyard, market or gate authority. Secure local facilities before attempting ordinary campaign servicing.';alert(reason)}
},true);
