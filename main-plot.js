import {campaign,saveCampaign} from './campaign-core.js';
import {investigationState} from './mystery-system.js?v=79';
import {expeditionSummary} from './expedition-system.js?v=79';
import {changePlayerStanding,localPowers,playerStanding} from './factions-system.js?v=77';
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

const CUSTODY={
 central:{label:'Turn synthesis over to Central Navigation Command',text:'Central provides classified ephemerides, secure compute and a naval route team. They will expect control of whatever endpoint is found.',cost:5},
 meridian:{label:'Partner with Meridian navigation insurers',text:'Meridian funds independent reconstruction because a new safe route could be enormously valuable. Commercial disclosure will be difficult to contain.',cost:6},
 blackWake:{label:'Work through Black Wake navigators',text:'Underworld pilots know undocumented route tricks and can keep the work away from official networks, if they trust you enough.',cost:5,requires:()=>playerStanding('blackWake')>=10},
 independent:{label:'Keep the archive aboard your own fleet',text:'No patron gets the route. You pay the full logistical cost and carry the risk yourself.',cost:8}
};

const ROUTE_TASKS={
 nadirGeometry:{name:'Reacquire anomalous geometry',system:'Nadir',text:'Return to the N-17 frame and measure the route seed against the live gate-field distortion.'},
 pelagosEphemeris:{name:'Reconstruct the old ephemeris',system:'Pelagos',text:'Cross-check the archive against obsolete military and commercial ephemerides recovered with the derelict.'},
 kestrelBaseline:{name:'Validate the expedition baseline',system:'Kestrel',text:'Test the reconstructed route against the missing expedition’s last authenticated baseline instead of trusting archive maths alone.'}
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
 if(p.synthesis===undefined){p.synthesis=null;dirty=true}if(p.custody===undefined){p.custody=null;dirty=true}if(!p.routeTasks){p.routeTasks={};dirty=true}
 for(const id of Object.keys(ROUTE_TASKS))if(!p.routeTasks[id]){p.routeTasks[id]={id,done:false,day:null,finding:null};dirty=true}
 if(p.routeReady===undefined){p.routeReady=false;dirty=true}if(p.destination===undefined){p.destination=null;dirty=true}if(!p.attention){p.attention=[];dirty=true}
 if(dirty)saveCampaign(campaign);return p;
}
function resolvedN17(){const site=expeditionSummary().site;return ['seized','destroyed','recovered','contained'].includes(site.contactOutcome)||site.contactState==='hailed'||site.contactState==='observed'}
function threadsComplete(p){return p.archiveRecovered&&Object.values(p.threads).every(t=>t.resolved)}
function routeComplete(p){return Object.values(p.routeTasks).every(t=>t.done)}
export function plotSummary(){
 const p=ensure(),inv=investigationState(),site=expeditionSummary().site;
 const canResolve=!p.nadirResolution&&site.contactFound&&resolvedN17();
 const custodyOptions=Object.entries(CUSTODY).map(([id,o])=>({id,label:o.label,text:o.text,available:!o.requires||o.requires(),cost:o.cost}));
 return{act:p.act,truth:inv.truth,nadirResolution:p.nadirResolution,canResolve,archiveRecovered:p.archiveRecovered,resolutionOptions:(RESOLUTIONS[inv.truth]||[]).map(x=>({...x})),threads:Object.entries(THREADS).map(([id,t])=>({...t,...p.threads[id],available:p.archiveRecovered&&!p.threads[id].resolved&&campaign.location===t.system})),siteOutcome:site.contactOutcome||site.contactState,threadsComplete:threadsComplete(p),synthesis:p.synthesis,synthesisReady:threadsComplete(p)&&!p.synthesis,custody:p.custody,custodyOptions,routeTasks:Object.entries(ROUTE_TASKS).map(([id,t])=>({...t,...p.routeTasks[id],available:!!p.custody&&!p.routeTasks[id].done&&campaign.location===t.system,cost:p.custody?CUSTODY[p.custody.id]?.cost||8:null})),routeReady:p.routeReady,destination:p.destination,attention:[...p.attention]};
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
export function synthesizeArchive(){
 const p=ensure();if(!threadsComplete(p))return{ok:false,reason:'Resolve all three archive threads before attempting synthesis.'};if(p.synthesis)return{ok:false,reason:'The archive has already been synthesised.'};if(campaign.supplies<12)return{ok:false,reason:'Archive synthesis requires 12 supplies for isolated compute, calibration hardware and secure handling.'};
 campaign.supplies-=12;campaign.day+=2;const connected=Object.keys(p.connections).filter(id=>p.connections[id]);const names=connected.map(id=>THREADS[id].name);p.synthesis={day:campaign.day,connected,count:connected.length,confidence:connected.length>1?'high':'moderate',summary:connected.length>1?`${connected.length} investigated records share a genuine route-key lineage. The rest are unrelated events that only looked similar in the archive.`:'Only one of the three older records is genuinely tied to N-17. The apparent wider conspiracy collapses, but that one surviving route key is real.'};p.act='synthesis';
 campaign.log??=[];campaign.log.push(`Day ${campaign.day}: MAIN PLOT — archive synthesis complete. Genuine connected record${connected.length===1?'':'s'}: ${names.join(', ')}. A partial route solution can now be reconstructed.`);saveCampaign(campaign);return{ok:true,connected};
}
export function chooseArchiveCustody(id){
 const p=ensure(),o=CUSTODY[id];if(!p.synthesis)return{ok:false,reason:'Complete archive synthesis first.'};if(p.custody)return{ok:false,reason:'A custody arrangement is already in force.'};if(!o)return{ok:false,reason:'Unknown custody choice.'};if(o.requires&&!o.requires())return{ok:false,reason:'That channel does not trust you enough for work this sensitive.'};
 campaign.day+=1;p.custody={id,label:o.label,day:campaign.day};p.act='reconstruction';
 if(id==='central'){changePlayerStanding('central',5);changeNpcRelationship('central_vesper',3,'Trusted with the archive route reconstruction.');}
 else if(id==='meridian'){changePlayerStanding('meridian',5);campaign.credits+=220;}
 else if(id==='blackWake'){changePlayerStanding('blackWake',5);changePlayerStanding('central',-2);changeNpcRelationship('blackwake_morrow',3,'Trusted with an undocumented route reconstruction.');}
 else changePlayerStanding('central',-1);
 campaign.log??=[];campaign.log.push(`Day ${campaign.day}: MAIN PLOT — route reconstruction custody: ${o.label}. Three independent calibrations are required before anyone should attempt transit.`);saveCampaign(campaign);return{ok:true};
}
function attentionAt(system,p){const powers=localPowers(system).filter(x=>x.presence>.12);const top=powers[0];if(!top)return null;const key=`${system}:${top.id}`;if(!p.attention.some(x=>x.key===key))p.attention.push({key,system,factionId:top.id,factionName:top.faction.name,day:campaign.day});return top;}
export function calibrateRoute(id){
 const p=ensure(),def=ROUTE_TASKS[id],task=p.routeTasks[id];if(!p.custody)return{ok:false,reason:'Choose who holds the reconstructed archive before calibration.'};if(!def||!task)return{ok:false,reason:'Unknown calibration task.'};if(task.done)return{ok:false,reason:'That calibration is already complete.'};if(campaign.location!==def.system)return{ok:false,reason:`Perform this calibration in ${def.system}.`};
 const cost=CUSTODY[p.custody.id]?.cost||8;if(campaign.supplies<cost)return{ok:false,reason:`This calibration requires ${cost} supplies.`};campaign.supplies-=cost;campaign.day+=1;const watcher=attentionAt(def.system,p);task.done=true;task.day=campaign.day;task.finding=calibrationFinding(id,p.synthesis.connected);campaign.log??=[];campaign.log.push(`Day ${campaign.day}: MAIN PLOT — ${def.name}. ${task.finding}${watcher?` ${watcher.faction.short} assets in-system are now aware that unusual navigation work is underway.`:''}`);
 if(routeComplete(p)){p.routeReady=true;p.destination='Lacuna Reach';p.act='threshold';campaign.log.push(`Day ${campaign.day}: MAIN PLOT — route solution confirmed. The archive points to a dormant endpoint provisionally designated LACUNA REACH, absent from every contemporary gate chart.`);}
 saveCampaign(campaign);return{ok:true,routeReady:p.routeReady,finding:task.finding};
}
function calibrationFinding(id,connected){if(id==='nadirGeometry')return connected.includes('unregisteredGate')?'The live N-17 geometry locks cleanly onto the recovered route seed.':'The N-17 field supplies a usable reference frame even though the unregistered signal itself was unrelated.';if(id==='pelagosEphemeris')return connected.includes('derelictWarship')?'The derelict’s sealed navigation package contains the missing epoch correction needed to make the route physically consistent.':'The derelict was unrelated, but its historical ephemeris still closes a critical timing gap in the reconstruction.';return connected.includes('missingExpedition')?'The expedition baseline proves a crewed ship attempted this route family before the current crisis.':'The expedition was unrelated, but its baseline rules out the most dangerous false solution.'}
export function plotComplete(){return threadsComplete(ensure())}
export function routeReconstructionComplete(){return ensure().routeReady}

if(typeof window!=='undefined')window.__mainPlot={plotSummary,resolveNadir,investigateThread,synthesizeArchive,chooseArchiveCustody,calibrateRoute,plotComplete,routeReconstructionComplete};
