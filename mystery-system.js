import {campaign,saveCampaign} from './campaign-core.js';
import {playerStanding,changePlayerStanding} from './factions-system.js?v=68';
import {NPCS,changeNpcRelationship} from './campaign-npcs.js?v=69';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const pick=a=>a[Math.floor(Math.random()*a.length)];

export const MYSTERIES={
 nadirDisappearances:{
  name:'The Nadir disappearances',
  summary:'Ships are vanishing around Nadir often enough to worry insurers, pirates and patrol officers, but not enough to produce an agreed explanation.',
  truths:{
   gateEcho:{label:'Gate echo phenomenon',secret:'A poorly understood gate-field interaction is displacing ships through time and space. Some losses are destroyed; some emerge elsewhere or later.'},
   blackProject:{label:'Classified interdiction programme',secret:'A covert Central research cell is testing a gate-adjacent interdiction system and concealing casualties and captures.'},
   lostColony:{label:'Lost human enclave',secret:'An isolated human settlement has developed stealthy interception craft and is seizing vessels that approach territory it considers its own.'}
  }
 }
};

const EVIDENCE={
 insurance:{title:'Meridian loss pattern',confidence:'high',source:'Meridian insurance records',text:'Losses cluster around a narrow family of Nadir approach vectors. Cargo value and pirate activity do not explain the pattern.',supports:['gateEcho','blackProject','lostColony']},
 pirateAvoidance:{title:'The dark marker',confidence:'medium',source:'Black Wake testimony',text:'Black Wake captains avoid sector N-17 despite rich traffic. They claim ships sometimes vanish without a weapons flash or distress call.',supports:['gateEcho','blackProject','lostColony']},
 clockDrift:{title:'Impossible transponder clock',confidence:'high',source:'Recovered wreckage',text:'A recovered transponder is 11.4 hours ahead of authenticated network time despite an intact clock and power history.',supports:['gateEcho']},
 navyTelemetry:{title:'Classified field telemetry',confidence:'high',source:'Central Navy',text:'Central sensor logs show a brief gate-like spacetime distortion at the moment one missing ship disappeared.',supports:['gateEcho','blackProject']},
 cutHull:{title:'Selective hull cutting',confidence:'high',source:'Direct salvage inspection',text:'A derelict has precision cuts around command, navigation and engineering spaces. The pattern looks like seizure, not ordinary piracy.',supports:['blackProject','lostColony']},
 unknownAlloy:{title:'Uncatalogued drive alloy',confidence:'medium',source:'Orpheus metallurgical analysis',text:'Recovered fragments use a human-compatible alloy recipe not found in current frontier or Central production catalogues.',supports:['lostColony']},
 scrubbedOrders:{title:'Scrubbed naval tasking',confidence:'medium',source:'Central records discrepancy',text:'A patrol detachment received sealed orders for Nadir, but the tasking record was later removed from ordinary Navy systems.',supports:['blackProject']}
};

const LEADS={
 meridianAudit:{title:'Audit the loss records',system:'Pelagos',route:'merchant',requires:()=>playerStanding('meridian')>=15,description:'Meridian will open detailed claims data to captains it considers reliable.',resolve:()=>({evidence:'insurance',log:'Meridian opened its restricted loss database. The disappearances form a geographic pattern.'})},
 blackWakeRumour:{title:'Ask about the dark marker',system:'Nadir',route:'underworld',requires:()=>playerStanding('blackWake')>=5,description:'Black Wake captains know which empty places they refuse to enter.',resolve:()=>({evidence:'pirateAvoidance',npc:'blackwake_morrow',log:'Nyx Morrow gave you coordinates for the “dark marker”, with the advice not to linger there.'})},
 derelictSearch:{title:'Search Nadir N-17',system:'Nadir',route:'independent',requires:s=>s.evidence.includes('insurance')||s.evidence.includes('pirateAvoidance'),description:'Take the fleet off the normal lane and search the N-17 volume directly.',cost:8,resolve:s=>({evidence:s.truth==='gateEcho'?'clockDrift':'cutHull',log:'The fleet located wreckage in N-17 and recovered evidence that does not fit ordinary piracy.'})},
 navyBriefing:{title:'Receive sealed Navy briefing',system:'Haven Reach',route:'navy',requires:()=>!!campaign.central?.auxiliary||playerStanding('central')>=60,description:'Commodore Vesper has classified material and expects operational discretion.',resolve:s=>({evidence:s.truth==='blackProject'?'scrubbedOrders':'navyTelemetry',npc:'central_vesper',log:'Commodore Vesper released classified Nadir telemetry under operational restrictions.'})},
 orpheusAnalysis:{title:'Have Orpheus analyse fragments',system:'Kestrel',route:'industrial',requires:s=>playerStanding('orpheus')>=10&&s.evidence.includes('cutHull'),description:'Orpheus laboratories can identify whether the cutting debris came from known industry.',resolve:s=>({evidence:s.truth==='lostColony'?'unknownAlloy':'scrubbedOrders',log:'Orpheus completed a metallurgical and tool-mark analysis of the recovered fragments.'})}
};

function ensureState(){
 campaign.investigations??={};
 let s=campaign.investigations.nadirDisappearances;
 if(!s){s=campaign.investigations.nadirDisappearances={truth:pick(Object.keys(MYSTERIES.nadirDisappearances.truths)),evidence:[],resolvedLeads:[],hypotheses:{gateEcho:0,blackProject:0,lostColony:0},status:'open',operations:[],createdDay:campaign.day};saveCampaign(campaign)}
 s.evidence??=[];s.resolvedLeads??=[];s.hypotheses??={gateEcho:0,blackProject:0,lostColony:0};s.operations??=[];return s;
}
export function investigationState(){return ensureState()}
export function evidenceRecord(id){return EVIDENCE[id]?{id,...EVIDENCE[id]}:null}
export function evidenceList(){const s=ensureState();return s.evidence.map(evidenceRecord).filter(Boolean)}
export function recalcHypotheses(){const s=ensureState(),scores={gateEcho:0,blackProject:0,lostColony:0};for(const id of s.evidence){const e=EVIDENCE[id];if(!e)continue;const w=e.confidence==='high'?2:1;for(const h of e.supports)scores[h]+=w}s.hypotheses=scores;return scores}
export function addEvidence(id,note=''){const s=ensureState();if(!EVIDENCE[id]||s.evidence.includes(id))return false;s.evidence.push(id);recalcHypotheses();campaign.log??=[];campaign.log.push(`Day ${campaign.day}: INTEL added evidence — ${EVIDENCE[id].title}.${note?` ${note}`:''}`);saveCampaign(campaign);return true}
export function availableLeads(){const s=ensureState();return Object.entries(LEADS).filter(([id,l])=>!s.resolvedLeads.includes(id)&&l.system===campaign.location&&l.requires(s)).map(([id,l])=>({id,...l}))}
export function knownLeads(){const s=ensureState();return Object.entries(LEADS).filter(([id,l])=>!s.resolvedLeads.includes(id)&&l.requires(s)).map(([id,l])=>({id,...l,available:l.system===campaign.location}))}
export function resolveLead(id){const s=ensureState(),l=LEADS[id];if(!l||s.resolvedLeads.includes(id)||l.system!==campaign.location||!l.requires(s))return{ok:false,reason:'Lead is not currently actionable.'};if(l.cost&&campaign.supplies<l.cost)return{ok:false,reason:`This expedition needs ${l.cost} supplies.`};if(l.cost)campaign.supplies-=l.cost;campaign.day+=1;s.resolvedLeads.push(id);const r=l.resolve(s)||{};if(r.evidence)addEvidence(r.evidence);if(r.npc&&NPCS[r.npc])changeNpcRelationship(r.npc,2,'Shared sensitive information concerning the Nadir disappearances.');campaign.log??=[];campaign.log.push(`Day ${campaign.day}: ${r.log||`Investigated ${l.title}.`}`);saveCampaign(campaign);return{ok:true,...r}}
export function navyDirective(){const s=ensureState(),eligible=!!campaign.central?.auxiliary||playerStanding('central')>=60;if(!eligible||s.evidence.length<2)return null;return{title:'NAVY DIRECTIVE // NADIR ANOMALY',text:'Central command authorises you to enter the anomaly volume. Recover intelligence if practical. Seize unfamiliar technology. If containment fails or the material presents an uncontrolled threat, destroy it rather than allow proliferation.',rules:['Preserve recoverable intelligence','Seize unknown military technology','Deny or destroy uncontrollable hazards'],classified:true}}
export function merchantDirective(){const s=ensureState();if(playerStanding('meridian')<30||s.evidence.length<2)return null;return{title:'MERIDIAN REQUEST // MISSING SHIPPING',text:'Meridian wants proof of what is happening, not a battle. Locate missing hulls, recover voyage recorders and avoid destroying evidence if possible.'}}
export function underworldDirective(){const s=ensureState();if(playerStanding('blackWake')<20||s.evidence.length<1)return null;return{title:'BLACK WAKE OFFER // DARK MARKER',text:'Nyx Morrow will pay for a route through the dark marker that does not attract whatever owns it. She would prefer you not hand everything you find to Central.'}}
export function interactionContext(){return{navy:navyDirective(),merchant:merchantDirective(),underworld:underworldDirective()}}
export function investigationSummary(){const s=ensureState(),scores=recalcHypotheses(),max=Math.max(1,...Object.values(scores));return{...s,name:MYSTERIES.nadirDisappearances.name,summary:MYSTERIES.nadirDisappearances.summary,evidence:evidenceList(),hypotheses:Object.entries(scores).map(([id,score])=>({id,label:MYSTERIES.nadirDisappearances.truths[id].label,score,strength:score===0?'unsupported':score===max&&score>=3?'leading':score>=2?'plausible':'weak'})),leads:knownLeads(),context:interactionContext()}}

// Transitional compatibility: old plot tokens become one mundane starting lead rather than XP.
export function migrateLegacyMystery(){const s=ensureState();if((campaign.plotStage||0)>0&&!s.evidence.length){addEvidence('insurance','Converted from earlier campaign mystery progress.')}campaign.plotStage=0;saveCampaign(campaign)}

if(typeof window!=='undefined')window.__mysteries={investigationSummary,availableLeads,resolveLead,addEvidence};
