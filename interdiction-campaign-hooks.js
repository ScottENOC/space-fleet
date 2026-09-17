import {campaign} from './campaign-core.js';
import {registerBattleHook} from './battle-hooks.js';

registerBattleHook('afterStep','interdiction-campaign-consequences',({battle})=>{
 if(battle?.nonCombatScenario!=='smugglerInterdiction'||!battle.winner||battle._interdictionCampaignApplied)return;
 const result=battle.interdictionResult,contract=campaign.pendingEncounter?.contract;if(!result||!contract)return;
 battle._interdictionCampaignApplied=true;
 campaign.log??=[];
 if(result.success){
   contract.originalPay??=contract.pay;
   const factor=Math.max(.45,1-(result.destroyed||0)*.14-(result.wrongBoardings||0)*.05);
   contract.pay=Math.round(contract.originalPay*factor);
   if(result.destroyed){campaign.reputation=Math.max(-100,(campaign.reputation||0)-result.destroyed);campaign.central.lawfulness=(campaign.central?.lawfulness||0)-result.destroyed*2;}
   campaign.contractsCompleted.interdiction=(campaign.contractsCompleted.interdiction||0)+1;
   campaign.log.push(`Day ${campaign.day}: interdiction objective secured. ${result.wrongBoardings||0} false boarding${result.wrongBoardings===1?'':'s'}; ${result.destroyed||0} civilian hull${result.destroyed===1?'':'s'} destroyed; payout adjusted to ${contract.pay} cr.`);
 }else{
   campaign.log.push(`Day ${campaign.day}: interdiction objective failed (${result.reason||'target not secured'}).`);
 }
},180);
