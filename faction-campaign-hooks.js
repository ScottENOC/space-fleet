import {campaign,saveCampaign} from './campaign-core.js';
import {registerBattleHook} from './battle-hooks.js';
import {changePlayerStanding,FACTIONS} from './factions-system.js?v=68';
import {recordNpcContract} from './campaign-npcs.js?v=69';

registerBattleHook('afterStep','campaign-faction-contract-outcome',({battle})=>{
 if(!battle?.campaignBattle||!battle.winner||battle._factionContractOutcomeApplied)return;
 const contract=campaign.pendingEncounter?.contract;if(!contract)return;
 battle._factionContractOutcomeApplied=true;
 const issuer=contract.issuer,won=battle.winner==='P';
 if(won&&issuer&&issuer!=='central'){
   const gain=contract.kind==='mercenary'?4:3;changePlayerStanding(issuer,gain);
   campaign.log??=[];campaign.log.push(`Day ${campaign.day}: ${FACTIONS[issuer]?.name||'Contract issuer'} records successful combat service (+${gain} standing).`);
 }else if(!won&&issuer&&issuer!=='central'){
   changePlayerStanding(issuer,-2);
   campaign.log??=[];campaign.log.push(`Day ${campaign.day}: ${FACTIONS[issuer]?.name||'Contract issuer'} records the failed operation (-2 standing).`);
 }
 if(contract.issuerNpc)recordNpcContract(contract.issuerNpc,won);
 saveCampaign(campaign);
},-50);
