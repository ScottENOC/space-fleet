import {campaign,saveCampaign} from './campaign-core.js';
import {FACTIONS,SYSTEM_POWERS,relation} from './factions-system.js?v=77';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const BASE={
 central:{power:100,wealth:100,military:100},haven:{power:46,wealth:52,military:43},pelagosA:{power:44,wealth:55,military:46},pelagosB:{power:39,wealth:66,military:31},kestrel:{power:25,wealth:28,military:22},nadir:{power:18,wealth:20,military:19},meridian:{power:42,wealth:78,military:21},orpheus:{power:35,wealth:61,military:27},frontierGuard:{power:24,wealth:17,military:34},redKnives:{power:22,wealth:23,military:37},blackWake:{power:19,wealth:29,military:24}
};
const CLASS_RANK={Frigate:1,Destroyer:2,Cruiser:3,Battleship:4,Carrier:4};

function basePresence(system,id){return (SYSTEM_POWERS[system]||[]).find(x=>x.id===id)?.presence||0}
function ensurePresence(){campaign.factionPresence??={};for(const [system,entries] of Object.entries(SYSTEM_POWERS)){campaign.factionPresence[system]??={};for(const e of entries)if(!Number.isFinite(campaign.factionPresence[system][e.id]))campaign.factionPresence[system][e.id]=e.presence}}
function postureFor(state,id){const base=BASE[id]||{military:20};const ratio=(state.military||0)/Math.max(1,base.military),p=state.pressure||0;if((state.military||0)<8||ratio<.28||p>78)return'critical';if(ratio<.50||p>58)return'defensive';if(ratio<.72||p>38)return'strained';return'normal'}
function strategicLabel(p){return p==='critical'?'core defence only':p==='defensive'?'concentrating forces':p==='strained'?'reduced projection':'normal operations'}
function hostilePressure(id){let weighted=0,footprint=0;for(const [system,entries] of Object.entries(campaign.factionPresence||{})){const own=entries[id]||0;if(own<=.01)continue;footprint+=own;for(const [other,pres] of Object.entries(entries)){if(other===id||pres<=.01)continue;const r=relation(id,other);if(r<0)weighted+=own*pres*clamp(-r/70,0,1.5)}}return clamp((weighted/Math.max(.35,footprint))*82,0,100)}
function systemThreat(id,system){const entries=campaign.factionPresence?.[system]||{};let x=0;for(const [other,p] of Object.entries(entries)){if(other===id||p<=.01)continue;const r=relation(id,other);if(r<0)x+=p*clamp(-r/75,0,1.4)}return clamp(x,0,1.5)}

export function ensureStrategicFactionState(){
 campaign.factions??={};ensurePresence();let dirty=false;
 for(const id of Object.keys(FACTIONS)){
  const b=BASE[id]||{power:20,wealth:20,military:20},s=campaign.factions[id]??=( {...b,status:'active'} );
  if(!Number.isFinite(s.pressure)){s.pressure=0;dirty=true}if(!Number.isFinite(s.readiness)){s.readiness=65;dirty=true}if(!s.posture){s.posture='normal';dirty=true}if(!Number.isFinite(s.lastStrategicDay)){s.lastStrategicDay=campaign.day||1;dirty=true}
 }
 campaign.factionStrategicDay??=campaign.day||1;if(dirty)saveCampaign(campaign);return campaign.factions;
}

function stepOneDay(){ensureStrategicFactionState();
 for(const [id,s] of Object.entries(campaign.factions)){
  const b=BASE[id]||{power:20,wealth:20,military:20};
  const pressure=hostilePressure(id);s.pressure=clamp(s.pressure*.82+pressure*.18,0,100);
  const footprint=Object.values(campaign.factionPresence).reduce((n,m)=>n+(m[id]||0),0);
  const income=(.05+.035*footprint)*(id==='meridian'?1.45:id==='orpheus'?1.25:1),upkeep=.018*(s.military||0)+.012*(s.readiness||0);
  s.wealth=clamp((s.wealth||0)+income-upkeep-s.pressure*.0025,0,100);
  const recovery=Math.max(0,(s.wealth-18)*.0028+(s.power||0)*.0012),attrition=Math.max(0,s.pressure-28)*.0052;
  s.military=clamp((s.military||0)+recovery-attrition,0,100);
  s.readiness=clamp((s.readiness||0)+(.10+(s.wealth||0)*.002)-s.pressure*.003,10,100);
  s.power=clamp((s.power||0)*.992+((s.military||0)*.56+(s.wealth||0)*.44)*.008,0,100);
  s.posture=postureFor(s,id);s.status=(s.military<3&&s.power<8)?'fragmented':'active';s.lastStrategicDay=campaign.day;
  const projection=s.posture==='critical'?.20:s.posture==='defensive'?.42:s.posture==='strained'?.70:1;
  for(const system of Object.keys(SYSTEM_POWERS)){
   campaign.factionPresence[system]??={};const base=basePresence(system,id),home=FACTIONS[id]?.home===system,cur=campaign.factionPresence[system][id]||0,threat=systemThreat(id,system);
   let target=base*(home?clamp(.75+(s.power||0)/180,.75,1.15):projection*clamp(.55+(s.power||0)/90,.35,1.12));
   if(!home)target*=clamp(1-threat*.28,.45,1);else target=Math.max(target,base*.55);
   const rate=home?.028:.018;let next=cur+(target-cur)*rate;
   if(!home&&s.posture==='critical')next-=.0035;if(!home&&s.posture==='defensive')next-=.0015;
   campaign.factionPresence[system][id]=clamp(next,0,1.15);
  }
 }
 campaign.factionStrategicDay=campaign.day;
}

export function advanceFactionStrategy(targetDay=campaign.day){ensureStrategicFactionState();let d=campaign.factionStrategicDay||targetDay;const end=Math.max(d,Math.floor(targetDay||d));let steps=0;while(d<end&&steps<365){d++;campaign.factionStrategicDay=d;stepOneDay();steps++}if(steps)saveCampaign(campaign);return steps}
export function strategicPresence(id,system){ensureStrategicFactionState();return campaign.factionPresence?.[system]?.[id]??basePresence(system,id)}
export function factionStrategicSummary(id,system=campaign.location){ensureStrategicFactionState();advanceFactionStrategy(campaign.day);const s=campaign.factions?.[id];if(!s)return null;const p=strategicPresence(id,system);return{id,posture:s.posture||'normal',postureLabel:strategicLabel(s.posture||'normal'),pressure:Math.round(s.pressure||0),readiness:Math.round(s.readiness||0),military:Math.round(s.military||0),wealth:Math.round(s.wealth||0),power:Math.round(s.power||0),presence:p,home:FACTIONS[id]?.home===system}}
export function factionForcePlan(id,system=campaign.location,requested=1,purpose='general'){
 const x=factionStrategicSummary(id,system);if(!x)return{count:1,maxClass:1,posture:'normal',presence:0,reason:'unknown force'};
 const core=x.home||x.presence>=.58,defence=purpose==='defence'||purpose==='antiPiracy';let count=Math.max(0,Math.round(requested));
 if(x.presence<.035&&!core)count=0;else if(x.posture==='critical')count=core?Math.min(2,Math.max(1,count)):Math.min(1,count);else if(x.posture==='defensive')count=core?Math.min(3,Math.max(1,count)):Math.min(1,count);else if(x.posture==='strained')count=Math.min(2,Math.max(1,count));else count=Math.min(3,Math.max(1,count));
 if(defence&&core&&x.posture!=='critical')count=Math.min(3,Math.max(count,2));
 let maxClass=x.military>=62?4:x.military>=34?3:x.military>=18?2:1;if(!core&&x.posture==='defensive')maxClass=Math.min(maxClass,2);if(x.posture==='critical')maxClass=1;
 return{...x,count,maxClass,core,purpose,reason:core?`forces concentrated around ${system}`:`${x.postureLabel} at ${system}`};
}
export function hullAllowedByPlan(hull,plan){return (CLASS_RANK[hull?.shipClass]||1)<=Math.max(1,plan?.maxClass||1)}
export function applyFactionLosses(id,{military=0,power=0,wealth=0,presenceSystem=campaign.location,presence=0}={}){ensureStrategicFactionState();const s=campaign.factions?.[id];if(!s)return null;s.military=clamp((s.military||0)-military,0,100);s.power=clamp((s.power||0)-power,0,100);s.wealth=clamp((s.wealth||0)-wealth,0,100);s.readiness=clamp((s.readiness||0)-military*.7,10,100);s.pressure=clamp((s.pressure||0)+military*.9,0,100);s.posture=postureFor(s,id);if(presenceSystem&&campaign.factionPresence?.[presenceSystem])campaign.factionPresence[presenceSystem][id]=clamp((campaign.factionPresence[presenceSystem][id]||0)-presence,0,1.15);saveCampaign(campaign);return s}

ensureStrategicFactionState();advanceFactionStrategy(campaign.day);
if(typeof window!=='undefined'){window.__factionStrategy={advanceFactionStrategy,factionStrategicSummary,factionForcePlan,applyFactionLosses};setInterval(()=>advanceFactionStrategy(campaign.day),1200)}
