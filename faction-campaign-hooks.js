import {campaign,saveCampaign} from './campaign-core.js';
import {registerBattleHook} from './battle-hooks.js';
import {changePlayerStanding,FACTIONS} from './factions-system.js?v=68';

registerBattleHook('afterStep','campaign-faction-contract-outcome',({battle})=>{
 if(!battle?.campaignBattle||!battle.winner||battle._factionContractOutcomeApplied)return;
 const contract=campaign.pendingEncounter?.contract;if(!contract)return;
 battle._factionContractOutcomeApplied=true;
 const issuer=contract.issuer;
 if(battle.winner==='P'&&issuer&&issuer!=='central'){
   const gain=contract.kind==='mercenary'?4:3;changePlayerStanding(issuer,gain);
   campaign.log??=[];campaign.log.push(`Day ${campaign.day}: ${FACTIONS[issuer]?.name||'Contract issuer'} records successful combat service (+${gain} standing).`);
 }else if(battle.winner!=='P'&&issuer&&issuer!=='central'){
   changePlayerStanding(issuer,-2);
   campaign.log??=[];campaign.log.push(`Day ${campaign.day}: ${FACTIONS[issuer]?.name||'Contract issuer'} records the failed operation (-2 standing).`);
 }
 saveCampaign(campaign);
},-50);
