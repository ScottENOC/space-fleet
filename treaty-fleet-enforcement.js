import {campaign,saveCampaign} from './campaign-core.js';
import {FACTIONS,SYSTEM_POWERS} from './factions-system.js?v=77';
import {strategicMissionAllowed,recordAccessIncursion} from './treaty-operations.js?v=108';

function activeFront(id){return(campaign.strategicFronts?.fronts||[]).find(f=>f.id===id&&f.status==='active')||null}
function presence(id,system){return campaign.factionPresence?.[system]?.[id]??(SYSTEM_POWERS[system]||[]).find(x=>x.id===id)?.presence??0}
function authority(system){return Object.keys(FACTIONS).map(id=>({id,p:presence(id,system)})).filter(x=>x.p>.08&&FACTIONS[x.id]?.lawful).sort((a,b)=>b.p-a.p)[0]?.id||null}
function frontCoversAuthority(front,system){const host=authority(system);return !!host&&!!front&&[front.a,front.b].includes(host)}
function sendHome(f){const system=f.system||f.destination;f.frontId=null;f.status='reserve';f.destination=f.origin||FACTIONS[f.factionId]?.home||system;f.system=f.destination;f.etaDay=campaign.day;f.mission='reserve';f.missionTarget=f.destination;f.missionSince=campaign.day;f.missionUntil=campaign.day+4;campaign.log??=[];campaign.log.push(`Day ${campaign.day}: ${FACTIONS[f.factionId]?.short||f.factionId} task force ${f.id} is denied routine military access and returns to reserve rather than treating the refusal as a casus belli.`);campaign.log=campaign.log.slice(-240);return true}
function enforce(){let dirty=false;for(const f of campaign.strategicFronts?.fleets||[]){if(!['deployed','enroute'].includes(f.status))continue;const system=f.status==='enroute'?f.destination:f.system,front=activeFront(f.frontId),mission=f.mission||'patrol';if(strategicMissionAllowed(f.factionId,system,mission,front)){if(['raid','blockade'].includes(mission)&&!frontCoversAuthority(front,system))dirty=recordAccessIncursion(f.factionId,system,mission)||dirty;continue}if(['patrol','convoyEscort','reinforce'].includes(mission))dirty=sendHome(f)||dirty;else dirty=recordAccessIncursion(f.factionId,system,mission)||dirty}if(dirty)saveCampaign(campaign);return dirty}
export function enforceTreatyFleetAccess(){return enforce()}
if(typeof window!=='undefined'){window.__treatyFleetAccess={enforceTreatyFleetAccess};setInterval(enforceTreatyFleetAccess,1450)}
