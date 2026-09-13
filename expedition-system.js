import {campaign,saveCampaign,activePlayerShips} from './campaign-core.js';
import {MODULES} from './shipyard.js';
import './sensor-catalog.js';
import {investigationState,addEvidence,interactionContext} from './mystery-system.js?v=73';
import {changePlayerStanding} from './factions-system.js?v=68';
import {changeNpcRelationship} from './campaign-npcs.js?v=69';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const SITE_ID='nadirN17';

const CONTACTS={
 gateEcho:{
  title:'Phase-displaced merchant hull',
  classification:'ANOMALOUS / NON-HOSTILE',
  text:'A merchant hull intermittently resolves against the starfield where no ship was present moments earlier. Its transponder identifies a vessel missing from the Nadir lanes.',
  options:['observe','hail','recover','contain']
 },
 blackProject:{
  title:'Masked interdiction platform',
  classification:'CLASSIFIED HUMAN MILITARY CONTACT',
  text:'Passive sensors resolve a low-emission military platform shadowing several disabled civilian hulls. Its emissions match no declared Central deployment.',
  options:['observe','hail','seize','destroy']
 },
 lostColony:{
  title:'Unknown human picket',
  classification:'UNREGISTERED HUMAN CONTACT',
  text:'A fast vessel with unfamiliar drive geometry is holding position between your fleet and a cluster of captured or sheltered merchant hulls.',
  options:['observe','hail','seize','withdraw']
 }
};

function ensureSite(){
 const inv=investigationState();
 inv.sites??={};
 inv.sites[SITE_ID]??={id:SITE_ID,name:'Nadir N-17 anomaly volume',system:'Nadir',searchProgress:0,searches:0,contactFound:false,contactState:'unknown',contactOutcome:null,lastSearchDay:null,reportedTo:[],concealedFrom:[]};
 return inv.sites[SITE_ID];
}
function moduleHealth(entry,index){const sm=entry.state?.modules?.find(x=>x.id===`m${index}`);if(!sm)return 1;const p=entry.blueprint?.placements?.[index],spec=p&&MODULES[p.moduleId];return spec?.hp?clamp((sm.hp||0)/spec.hp,0,1):1}
export function fleetSurveyProfile(){
 let sensitivity=0,drones=0,ships=0;
 for(const entry of activePlayerShips()){
  ships++;
  for(const [i,p] of (entry.blueprint?.placements||[]).entries()){
   const m=MODULES[p.moduleId];if(!m)continue;
   if(m.type==='sensor')sensitivity+=(m.sensitivity||1)*moduleHealth(entry,i);
   if(m.type==='hangar')drones+=m.defaultCraft?.sensorDrone||0;
  }
 }
 const sensorRating=clamp(sensitivity+drones*.45,0,20);
 return{ships,sensitivity:+sensitivity.toFixed(2),drones,sensorRating:+sensorRating.toFixed(2),grade:sensorRating>=8?'excellent':sensorRating>=4?'strong':sensorRating>=2?'adequate':'poor'};
}
export function expeditionUnlocked(){const inv=investigationState();return campaign.location==='Nadir'&&(inv.resolvedLeads?.includes('derelictSearch')||inv.evidence?.length>=2)}
export function expeditionSummary(){const site=ensureSite(),profile=fleetSurveyProfile(),ctx=interactionContext();return{site:{...site},profile,unlocked:expeditionUnlocked(),contact:site.contactFound?{truth:investigationState().truth,...CONTACTS[investigationState().truth]}:null,context:ctx}}

export function searchSite(mode='standard'){
 const site=ensureSite();if(campaign.location!=='Nadir')return{ok:false,reason:'The expedition site is in Nadir.'};if(!expeditionUnlocked())return{ok:false,reason:'You do not yet have enough positional evidence to search N-17 effectively.'};if(site.contactFound)return{ok:false,reason:'The primary contact has already been located.'};
 const profiles={cautious:{cost:4,days:1,mult:.72,label:'cautious passive sweep'},standard:{cost:7,days:1,mult:1,label:'standard search pattern'},deep:{cost:12,days:2,mult:1.55,label:'deep active survey'}};
 const p=profiles[mode]||profiles.standard;if(campaign.supplies<p.cost)return{ok:false,reason:`This search requires ${p.cost} supplies.`};
 const sensor=fleetSurveyProfile(),base=16+sensor.sensorRating*7,increment=Math.max(8,Math.round(base*p.mult));campaign.supplies-=p.cost;campaign.day+=p.days;site.searches++;site.lastSearchDay=campaign.day;site.searchProgress=clamp(site.searchProgress+increment,0,100);
 campaign.log??=[];campaign.log.push(`Day ${campaign.day}: N-17 ${p.label}; search solution ${site.searchProgress}% (${sensor.grade} sensor picture).`);
 if(site.searchProgress>=100){site.contactFound=true;site.contactState='detected';const c=CONTACTS[investigationState().truth];campaign.log.push(`Day ${campaign.day}: expedition contact acquired — ${c.title}.`);}
 saveCampaign(campaign);return{ok:true,progress:site.searchProgress,found:site.contactFound};
}

function recordOutcome(site,id,text){site.contactOutcome=id;site.contactState=id;site.operations??=[];site.operations.push({day:campaign.day,action:id,text});site.operations=site.operations.slice(-12);campaign.log??=[];campaign.log.push(`Day ${campaign.day}: N-17 — ${text}`);saveCampaign(campaign)}
function patronEffects(action){const ctx=interactionContext();if(action==='reportNavy'&&ctx.navy){changePlayerStanding('central',5);changeNpcRelationship('central_vesper',4,'Received the fleet’s N-17 expedition report.');}
 if(action==='reportMeridian'&&ctx.merchant)changePlayerStanding('meridian',4);
 if(action==='reportWake'&&ctx.underworld){changePlayerStanding('blackWake',4);changeNpcRelationship('blackwake_morrow',3,'Received concealed N-17 route intelligence.');}}
export function contactActions(){const s=expeditionSummary();if(!s.contact)return[];const base=s.contact.options.map(id=>({id,label:({observe:'Observe at standoff range',hail:'Open communications',recover:'Attempt recovery',contain:'Deploy beacons and contain the volume',seize:'Order seizure operation',destroy:'Destroy the contact',withdraw:'Withdraw without escalation'})[id]||id}));return base;}
export function resolveContactAction(action){
 const site=ensureSite(),inv=investigationState(),truth=inv.truth;if(!site.contactFound)return{ok:false,reason:'No expedition contact has been located.'};if(site.contactOutcome&&['seized','destroyed','recovered','contained'].includes(site.contactOutcome))return{ok:false,reason:'The primary contact has already been resolved.'};campaign.day+=1;
 if(action==='observe'){
  const evidence=truth==='gateEcho'?'phaseReturn':truth==='blackProject'?'maskedTelemetry':'enclaveSignature';addEvidence(evidence);recordOutcome(site,'observed',`The fleet held outside weapons range and completed a full passive observation of ${CONTACTS[truth].title}.`);return{ok:true};
 }
 if(action==='hail'){
  if(truth==='gateEcho'){addEvidence('phaseReturn');recordOutcome(site,'hailed','The missing merchant answers in fragments. Its crew believes only minutes have passed since its disappearance.');return{ok:true};}
  if(truth==='blackProject'){addEvidence('projectChallenge');recordOutcome(site,'hailed','The platform identifies itself only as Central special operations and orders the fleet to leave the volume.');return{ok:true};}
  addEvidence('enclaveVoice');recordOutcome(site,'hailed','The unknown vessel answers in an archaic but recognisably human protocol and demands to know why registered-space ships keep entering its exclusion zone.');return{ok:true};
 }
 if(action==='recover'&&truth==='gateEcho'){addEvidence('phaseReturn');campaign.credits+=180;recordOutcome(site,'recovered','The fleet stabilised a docking window long enough to recover survivors and the merchant voyage recorder.');return{ok:true,resolved:true};}
 if(action==='contain'&&truth==='gateEcho'){addEvidence('phaseReturn');changePlayerStanding('central',2);recordOutcome(site,'contained','Navigation beacons now mark the unstable volume and traffic control has been warned away.');return{ok:true,resolved:true};}
 if(action==='withdraw'){recordOutcome(site,'withdrawn','The fleet withdrew without forcing the contact to respond. The site remains active.');return{ok:true};}
 if(['seize','destroy'].includes(action)&&truth!=='gateEcho'){
  campaign.pendingEncounter={kind:'mystery',title:action==='seize'?'N-17 seizure operation':'N-17 denial operation',mysteryTruth:truth,mysteryAction:action,day:campaign.day,targetFaction:truth==='blackProject'?'central':null};saveCampaign(campaign);return{ok:true,battle:true};
 }
 return{ok:false,reason:'That action is not appropriate to this contact.'};
}
export function resolveExpeditionBattle(enc,winner){if(!enc||enc.kind!=='mystery')return;const site=ensureSite(),truth=enc.mysteryTruth,action=enc.mysteryAction;if(winner==='P'){
  if(action==='seize'){site.contactState='seized';site.contactOutcome='seized';campaign.credits+=truth==='blackProject'?260:190;addEvidence(truth==='blackProject'?'projectHardware':'enclaveHardware');campaign.log.push(`Day ${campaign.day}: N-17 contact seized; technical intelligence transferred to fleet custody.`);}
  else {site.contactState='destroyed';site.contactOutcome='destroyed';campaign.log.push(`Day ${campaign.day}: N-17 contact destroyed under fleet weapons fire.`);}
  const ctx=interactionContext();if(ctx.navy){changePlayerStanding('central',action==='seize'?5:2);changeNpcRelationship('central_vesper',action==='seize'?4:1,'N-17 military objective completed.');}if(ctx.merchant&&action==='destroy')changePlayerStanding('meridian',-3);if(ctx.underworld&&action==='seize')changePlayerStanding('blackWake',-2);
 }else{site.contactState='escaped';campaign.log.push(`Day ${campaign.day}: N-17 operation failed; the contact broke engagement or the fleet was forced off.`);}saveCampaign(campaign)}
export function reportDiscovery(channel){const site=ensureSite();if(!site.contactFound)return{ok:false,reason:'There is no confirmed contact to report.'};if(site.reportedTo.includes(channel))return{ok:false,reason:'That party already has your report.'};const ctx=interactionContext(),allowed=(channel==='Navy'&&ctx.navy)||(channel==='Meridian'&&ctx.merchant)||(channel==='Black Wake'&&ctx.underworld);if(!allowed)return{ok:false,reason:'You do not have a sufficiently trusted channel to send that report.'};site.reportedTo.push(channel);patronEffects(channel==='Navy'?'reportNavy':channel==='Meridian'?'reportMeridian':'reportWake');campaign.log.push(`Day ${campaign.day}: N-17 findings reported to ${channel}.`);saveCampaign(campaign);return{ok:true}}

if(typeof window!=='undefined')window.__expeditions={expeditionSummary,searchSite,resolveContactAction,contactActions,reportDiscovery};
