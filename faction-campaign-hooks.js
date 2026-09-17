import {campaign,saveCampaign} from './campaign-core.js';
import {registerBattleHook} from './battle-hooks.js';
import {changePlayerStanding,FACTIONS} from './factions-system.js?v=77';
import {applyFactionLosses} from './faction-strategy.js?v=77';
import {recordNpcContract} from './campaign-npcs.js?v=69';

function shipLossWeight(s){const cells=s.grid?.validCells?.length||20;if(cells>=300)return 8;if(cells>=180)return 6;if(cells>=90)return 4;if(cells>=35)return 2.2;return 1.2}
function applyBattleAttrition(battle){if(battle._factionStrategicLossesApplied)return;battle._factionStrategicLossesApplied=true;const grouped={};for(const s of battle.ships||[]){if(s.team==='P'||!s.factionId||!FACTIONS[s.factionId])continue;const lost=s.dead||s.outcome==='captured'||s.surrendered;if(!lost)continue;grouped[s.factionId]=(grouped[s.factionId]||0)+shipLossWeight(s)}for(const [id,w] of Object.entries(grouped)){applyFactionLosses(id,{military:w*1.7,power:w*.55,wealth:w*.35,presenceSystem:campaign.location,presence:w*.008});campaign.log??=[];campaign.log.push(`Day ${campaign.day}: ${FACTIONS[id]?.short||id} strategic strength reduced by fleet losses in ${campaign.location}.`)}}

registerBattleHook('afterStep','campaign-faction-contract-outcome',({battle})=>{
 if(!battle?.campaignBattle||!battle.winner||battle._factionContractOutcomeApplied)return;
 const contract=campaign.pendingEncounter?.contract;if(!contract)return;
 battle._factionContractOutcomeApplied=true;applyBattleAttrition(battle);
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

registerBattleHook('afterStep','campaign-faction-uncontracted-losses',({battle})=>{if(!battle?.campaignBattle||!battle.winner||battle._factionStrategicLossesApplied)return;applyBattleAttrition(battle)},-55);
