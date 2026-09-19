import {campaign,saveCampaign} from './campaign-core.js';
import {investigationState} from './mystery-system.js?v=79';
import {expeditionSummary} from './expedition-system.js?v=79';
import {changePlayerStanding,localPowers} from './factions-system.js?v=77';
import {changeNpcRelationship} from './campaign-npcs.js?v=69';

const pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

const RESOLUTIONS={
 gateEcho:[
  {id:'stabilise',label:'Support a stabilisation programme',text:'Work with scientists and traffic control to understand the phase-return window and reduce further disappearances.',central:3,meridian:2},
  {id:'quarantine',label:'Quarantine N-17',text:'Mark the volume permanently hazardous, restrict traffic and deny experiments until the mechanism is better understood.',central:4,meridian:-1},
  {id:'exploit',label:'Keep studying the phenomenon independently',text:'Retain your best telemetry and continue controlled fleet research before giving any institution exclusive access.',central:-2,meridian:1,blackWake:2}
 ],
 blackProject:[
  {id:'expose',label:'Expose the programme',text:'Release enough evidence that the compartmented interdiction programme cannot simply disappear into classified files.',central:-5,meridian:4},
  {id:'cooperate',label:'Cooperate under seal',text:'Accept Central assurances, preserve secrecy and help contain the programme while retaining a private record.',central:6,meridian:-2},
  {id:'shutdown',label:'Force a shutdown without public disclosure',text:'Use the seized evidence as leverage: terminate field testing, return surviving civilians and keep the scandal contained.',central:2,meridian:2,blackWake:1}
 ],
 lostColony:[
  {id:'mediate',label:'Open a protected diplomatic channel',text:'Treat the enclave as a political actor rather than a target and establish rules for contact across the exclusion zone.',central:1,meridian:3},
  {id:'recognise',label:'Keep the enclave semi-secret and respect its boundary',text:'Do not hand its coordinates to every frontier power. Establish a limited contact protocol and let it choose wider contact later.',central:-2,blackWake:2},
  {id:'assert',label:'Back registered-space access',text:'Reject an unrecognised exclusion claim and support sustained access to the area, even if that risks a frontier confrontation.',central:4,meridian:1,blackWake:-2}
 ]
};

const THREADS={
 missingExpedition:{name:'The missing expedition',system:'Kestrel',summary:'A survey expedition vanished years ago after filing a deliberately vague route amendment. The recovered N-17 archive contains one matching navigation key.',steps:['Recover the old expedition routing packet','Compare its last authenticated sensor fix with the N-17 archive','Trace the final unlogged course change']},
 derelictWarship:{name:'The derelict warship',system:'Pelagos',summary:'A military hull with no matching battle report has appeared on an eccentric outer-system trajectory. Its damage predates the current Nadir crisis.',steps:['Inspect the derelict before another claimant strips it','Reconstruct weapon and drive damage from the wreck','Authenticate its sealed navigation core']},
 unregisteredGate:{name:'The unregistered gate signal',system:'Nadir',summary:'A navigation handshake is repeating from beyond the recognised traffic volume. No registered gate or relay should be transmitting there.',steps:['Separate the handshake from ordinary Nadir traffic','Triangulate the source against old gate ephemerides','Decode the route seed without transmitting a reply']}
};

function seedConnections(truth){
 const ids=Object.keys(THREADS),map={};
 const primary=truth==='gateEcho'?'unregisteredGate':truth==='blackProject'?'derelictWarship':'missingExpedition';
 for(const id of ids)map[id]=id===primary;
 const extra=pick(ids.filter(x=>x!==primary));if(Math.random()<.45)map[extra]=true;
 return map;
}
function ensure(){
 let dirty=false;if(!campaign.mainPlot){campaign.mainPlot={};dirty=true}const p=campaign.mainPlot;
 if(!p.act){p.act='nadir';dirty=true}if(p.nadirResolution===undefined){p.nadirResolution=null;dirty=true}if(p.archiveRecovered===undefined){p.archiveRecovered=false;dirty=true}if(p.unlockedDay===undefined){p.unlockedDay=null;dirty=true}
 if(!p.connections){p.connections=seedConnections(investigationState().truth);dirty=true}if(!p.threads){p.threads={};dirty=true}
 for(const id of Object.keys(THREADS))if(!p.threads[id]){p.threads[id]={id,stage:0,progress:0,findings:[],status:'locked',resolved:false};dirty=true}
 if(dirty)saveCampaign(campaign);return p;
}
function resolvedN17(){const site=expeditionSummary().site;return ['seized','destroyed','recovered','contained'].includes(site.contactOutcome)||site.contactState==='hailed'||site.contactState==='observed'}
export function plotSummary(){
 const p=ensure(),inv=investigationState(),site=expeditionSummary().site;
 const canResolve=!p.nadirResolution&&site.contactFound&&resolvedN17();
 return{act:p.act,truth:inv.truth,nadirResolution:p.nadirResolution,canResolve,archiveRecovered:p.archiveRecovered,resolutionOptions:(RESOLUTIONS[inv.truth]||[]).map(x=>({...x})),threads:Object.entries(THREADS).map(([id,t])=>({...t,...p.threads[id],available:p.archiveRecovered&&!p.threads[id].resolved&&campaign.location===t.system})),siteOutcome:site.contactOutcome||site.contactState};
}
function applyStanding(o){if(o.central)changePlayerStanding('central',o.central);if(o.meridian)changePlayerStanding('meridian',o.meridian);if(o.blackWake)changePlayerStanding('blackWake',o.blackWake)}
export function resolveNadir(choice){
 const p=ensure(),inv=investigationState(),option=(RESOLUTIONS[inv.truth]||[]).find(x=>x.id===choice);if(!option)return{ok:false,reason:'Unknown resolution.'};
 if(p.nadirResolution)return{ok:false,reason:'The Nadir crisis already has a strategic disposition.'};if(!resolvedN17())return{ok:false,reason:'You have not yet established enough control or contact at N-17.'};
 campaign.day+=2;p.nadirResolution={choice:option.id,label:option.label,truth:inv.truth,day:campaign.day};p.archiveRecovered=true;p.act='echoes';p.unlockedDay=campaign.day;
 for(const t of Object.values(p.threads))t.status='open';applyStanding(option);
 if(inv.truth==='blackProject')changeNpcRelationship('central_vesper',choice==='expose'?-3:choice==='cooperate'?4:2,'The N-17 programme reached a political resolution.');
 campaign.log??=[];campaign.log.push(`Day ${campaign.day}: MAIN PLOT — N-17 disposition: ${option.label}. Analysis of the recovered navigation archive exposes three older unresolved references.`);saveCampaign(campaign);return{ok:true};
}
function localInterference(system){const powers=localPowers(system).filter(x=>x.presence>.15);const top=powers[0];return top?`${top.faction.short} has the strongest local presence and notices the investigation.`:'No local power has enough reach to control the site.'}
export function investigateThread(id){
 const p=ensure(),t=THREADS[id],s=p.threads[id];if(!t||!s)return{ok:false,reason:'Unknown plot thread.'};if(!p.archiveRecovered)return{ok:false,reason:'The thread has not been unlocked.'};if(s.resolved)return{ok:false,reason:'This thread is already resolved.'};if(campaign.location!==t.system)return{ok:false,reason:`Continue this investigation in ${t.system}.`};
 const cost=5+s.stage*3;if(campaign.supplies<cost)return{ok:false,reason:`This investigation requires ${cost} supplies.`};campaign.supplies-=cost;campaign.day+=1;
 const step=t.steps[Math.min(s.stage,t.steps.length-1)],connected=!!p.connections[id];s.stage++;s.progress=clamp(Math.round(s.stage/t.steps.length*100),0,100);s.findings.push({day:campaign.day,text:step});
 let reveal='';if(s.stage>=t.steps.length){s.resolved=true;s.status='resolved';reveal=connected?connectedFinding(id):independentFinding(id);s.findings.push({day:campaign.day,text:reveal});}
 campaign.log??=[];campaign.log.push(`Day ${campaign.day}: MAIN PLOT — ${t.name}: ${step}. ${localInterference(t.system)}${reveal?` ${reveal}`:''}`);saveCampaign(campaign);return{ok:true,resolved:s.resolved,finding:reveal};
}
function connectedFinding(id){if(id==='missingExpedition')return'The expedition knowingly followed the same anomalous route-key family later found at N-17. Its disappearance is part of the larger gate mystery.';if(id==='derelictWarship')return'The warship carried an undeclared gate-field monitoring package keyed to the same archive family. Someone was studying this before the recent crisis.';return'The signal resolves into a valid but unregistered route seed using the same anomalous navigation family recovered at N-17.'}
function independentFinding(id){if(id==='missingExpedition')return'The expedition was lost to an unrelated navigation and life-support failure. The matching archive key was copied from common survey software, not evidence of the same event.';if(id==='derelictWarship')return'The derelict was destroyed in an unrecorded human engagement. Its apparent N-17 connection is archival contamination, not shared cause.';return'The handshake is an old human emergency relay using obsolete gate syntax. Strange, but unrelated to the N-17 phenomenon.'}
export function plotComplete(){const p=ensure();return p.archiveRecovered&&Object.values(p.threads).every(t=>t.resolved)}

if(typeof window!=='undefined')window.__mainPlot={plotSummary,resolveNadir,investigateThread,plotComplete};
