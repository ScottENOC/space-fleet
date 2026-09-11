import {campaign,saveCampaign} from './campaign-core.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export const FACTIONS={
 central:{name:'Terran Central Government',short:'Central Government',kind:'government',home:'Sol Gateway',scope:'interstellar',lawful:true,colour:'#9fb9c8',description:'The gate-regulating central state, distant on the frontier but overwhelmingly powerful when it chooses to intervene.'},
 haven:{name:'Haven Reach Administration',short:'Haven Administration',kind:'government',home:'Haven Reach',scope:'system',lawful:true,colour:'#7da9bd',description:'An established colonial administration whose prosperity depends on orderly gate traffic and predictable law.'},
 pelagosA:{name:'Pelagos Compact',short:'Pelagos Compact',kind:'government',home:'Pelagos',scope:'system',lawful:true,colour:'#79a6c1',description:'A coalition of major Pelagos colonies favouring coordinated defence, tariffs and political integration.'},
 pelagosB:{name:'Pelagos Free Ports',short:'Free Ports',kind:'government',home:'Pelagos',scope:'system',lawful:true,colour:'#8fb9a1',description:'Commercial city-states and orbital ports determined to protect local autonomy and open trade.'},
 kestrel:{name:'Kestrel Colonial Council',short:'Kestrel Council',kind:'government',home:'Kestrel',scope:'system',lawful:true,colour:'#a6a47a',description:'A loose council trying to turn scattered survey claims and young settlements into functioning government.'},
 nadir:{name:'Nadir Settlements League',short:'Nadir League',kind:'government',home:'Nadir',scope:'system',lawful:true,colour:'#9b8873',description:'A practical alliance of isolated settlements with limited reach beyond defended habitats and shipping lanes.'},
 meridian:{name:'Meridian Mercantile Combine',short:'Meridian Combine',kind:'merchant',home:'Pelagos',scope:'regional',lawful:true,colour:'#c5a76b',description:'A wealthy shipping, finance and warehousing combine with interests from Haven Reach to Nadir.'},
 orpheus:{name:'Orpheus Extractive Consortium',short:'Orpheus Consortium',kind:'industrial',home:'Kestrel',scope:'regional',lawful:true,colour:'#b4906c',description:'Mining and heavy-industry interests holding remote claims, refinery contracts and their own armed security.'},
 frontierGuard:{name:'Frontier Mutual Defence League',short:'Mutual Defence League',kind:'militia',home:'Kestrel',scope:'regional',lawful:true,colour:'#799c88',description:'A loose network of colonial militias and escort captains formed because official patrols cannot be everywhere.'},
 redKnives:{name:'Red Knives',short:'Red Knives',kind:'pirate',home:'Nadir',scope:'regional',lawful:false,colour:'#b56565',description:'Aggressive raiders who prey on weak traffic, sell captured cargo and occasionally hire out as deniable force.'},
 blackWake:{name:'Black Wake Brotherhood',short:'Black Wake',kind:'pirate',home:'Nadir',scope:'regional',lawful:false,colour:'#856f86',description:'Smugglers, wreckers and pirate captains bound more by mutual protection and markets than central command.'}
};

export const SYSTEM_POWERS={
 'Sol Gateway':[{id:'central',presence:1,role:'sovereign'}],
 'Haven Reach':[{id:'haven',presence:1,role:'government'},{id:'central',presence:.7,role:'oversight'},{id:'meridian',presence:.55,role:'commerce'},{id:'frontierGuard',presence:.2,role:'militia'}],
 'Pelagos':[{id:'pelagosA',presence:.85,role:'government'},{id:'pelagosB',presence:.8,role:'government'},{id:'meridian',presence:.9,role:'commerce'},{id:'central',presence:.25,role:'oversight'},{id:'redKnives',presence:.12,role:'raiders'}],
 'Kestrel':[{id:'kestrel',presence:.72,role:'government'},{id:'orpheus',presence:.8,role:'industry'},{id:'frontierGuard',presence:.76,role:'militia'},{id:'meridian',presence:.3,role:'commerce'},{id:'blackWake',presence:.16,role:'smugglers'}],
 'Nadir':[{id:'nadir',presence:.48,role:'government'},{id:'redKnives',presence:.75,role:'raiders'},{id:'blackWake',presence:.7,role:'underworld'},{id:'meridian',presence:.28,role:'commerce'},{id:'orpheus',presence:.22,role:'industry'},{id:'frontierGuard',presence:.2,role:'militia'}]
};

const INITIAL_RELATIONS={
 'central|haven':62,'central|pelagosA':28,'central|pelagosB':12,'central|kestrel':18,'central|nadir':4,'central|meridian':35,'central|orpheus':22,'central|frontierGuard':16,'central|redKnives':-88,'central|blackWake':-70,
 'haven|meridian':42,'haven|frontierGuard':24,'haven|redKnives':-58,'haven|blackWake':-32,
 'pelagosA|pelagosB':-22,'pelagosA|meridian':24,'pelagosA|redKnives':-54,'pelagosA|blackWake':-28,
 'pelagosB|meridian':55,'pelagosB|redKnives':-30,'pelagosB|blackWake':4,
 'kestrel|orpheus':34,'kestrel|frontierGuard':52,'kestrel|redKnives':-46,'kestrel|blackWake':-16,
 'nadir|redKnives':-18,'nadir|blackWake':8,'nadir|frontierGuard':10,
 'meridian|orpheus':14,'meridian|frontierGuard':30,'meridian|redKnives':-44,'meridian|blackWake':-8,
 'orpheus|frontierGuard':18,'orpheus|redKnives':-36,'orpheus|blackWake':-12,
 'frontierGuard|redKnives':-76,'frontierGuard|blackWake':-48,
 'redKnives|blackWake':-10
};

const DEFAULT_POWER={
 central:{power:100,wealth:100,military:100},haven:{power:46,wealth:52,military:43},pelagosA:{power:44,wealth:55,military:46},pelagosB:{power:39,wealth:66,military:31},kestrel:{power:25,wealth:28,military:22},nadir:{power:18,wealth:20,military:19},meridian:{power:42,wealth:78,military:21},orpheus:{power:35,wealth:61,military:27},frontierGuard:{power:24,wealth:17,military:34},redKnives:{power:22,wealth:23,military:37},blackWake:{power:19,wealth:29,military:24}
};
function pairKey(a,b){return[a,b].sort().join('|')}
function initialRelation(a,b){if(a===b)return 100;return INITIAL_RELATIONS[`${a}|${b}`]??INITIAL_RELATIONS[`${b}|${a}`]??0}
function defaultPlayerRep(id){const legacy=campaign.factionRep||{};if(Number.isFinite(legacy[id]))return legacy[id];if(id==='central')return campaign.central?.standing??20;return 0}

export function ensureFactionState(){
 let dirty=false;
 if(!campaign.factions){campaign.factions={};dirty=true}if(!campaign.factionRelations){campaign.factionRelations={};dirty=true}if(!campaign.factionRep){campaign.factionRep={};dirty=true}
 for(const id of Object.keys(FACTIONS)){
   const base=DEFAULT_POWER[id]||{power:20,wealth:20,military:20};
   if(!campaign.factions[id]){campaign.factions[id]={...base,status:'active'};dirty=true}
   if(!Number.isFinite(campaign.factionRep[id])){campaign.factionRep[id]=defaultPlayerRep(id);dirty=true}
 }
 const ids=Object.keys(FACTIONS);for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const key=pairKey(ids[i],ids[j]);if(!Number.isFinite(campaign.factionRelations[key])){campaign.factionRelations[key]=initialRelation(ids[i],ids[j]);dirty=true}}
 if(!campaign.central){campaign.central={standing:20,lawfulness:0,militaryPermit:false,auxiliary:false,violations:0};dirty=true}
 if(Number.isFinite(campaign.central.standing)){if(campaign.factionRep.central!==campaign.central.standing){campaign.factionRep.central=campaign.central.standing;dirty=true}}else{campaign.central.standing=campaign.factionRep.central||0;dirty=true}
 if(dirty)saveCampaign(campaign);return campaign.factions;
}
export function relation(a,b){ensureFactionState();return a===b?100:(campaign.factionRelations[pairKey(a,b)]??0)}
export function relationLabel(v){if(v<=-65)return'hostile';if(v<=-30)return'adversarial';if(v<15)return'cool';if(v<45)return'cooperative';if(v<70)return'friendly';return'allied'}
export function setRelation(a,b,value){ensureFactionState();if(a===b)return 100;campaign.factionRelations[pairKey(a,b)]=clamp(Math.round(value),-100,100);saveCampaign(campaign);return campaign.factionRelations[pairKey(a,b)]}
export function changeRelation(a,b,delta){return setRelation(a,b,relation(a,b)+delta)}
export function playerStanding(id){ensureFactionState();return campaign.factionRep[id]??0}
export function changePlayerStanding(id,delta){ensureFactionState();campaign.factionRep[id]=clamp(Math.round((campaign.factionRep[id]||0)+delta),-100,100);if(id==='central')campaign.central.standing=campaign.factionRep[id];saveCampaign(campaign);return campaign.factionRep[id]}
export function localPowers(system=campaign.location){ensureFactionState();return(SYSTEM_POWERS[system]||[]).map(x=>({...x,faction:FACTIONS[x.id],state:campaign.factions[x.id],playerStanding:campaign.factionRep[x.id]||0})).sort((a,b)=>b.presence-a.presence)}
export function factionSummary(id){ensureFactionState();const faction=FACTIONS[id],state=campaign.factions[id];if(!faction||!state)return null;const relations=Object.keys(FACTIONS).filter(x=>x!==id).map(other=>{const value=relation(id,other);return{id:other,value,label:relationLabel(value)}}).sort((a,b)=>a.value-b.value);return{id,faction,state,playerStanding:campaign.factionRep[id]||0,best:relations.at(-1),worst:relations[0]}}
export function issuerFor(kind,system=campaign.location){const powers=localPowers(system);const lawful=powers.filter(x=>x.faction.lawful),underworld=powers.filter(x=>!x.faction.lawful);if(kind==='smuggling')return(underworld.sort((a,b)=>b.presence-a.presence)[0]||powers[0])?.id||'blackWake';if(kind==='antiPiracy')return(lawful.filter(x=>['government','militia','merchant'].includes(x.faction.kind))[0]||lawful[0])?.id||'central';if(kind==='mercenary')return(lawful.filter(x=>x.faction.kind==='government')[0]||lawful[0])?.id||'central';if(kind==='escort'||kind==='trade')return(lawful.filter(x=>x.faction.kind==='merchant')[0]||lawful[0])?.id||'central';if(kind==='scout')return(lawful.filter(x=>['government','industrial','militia'].includes(x.faction.kind))[0]||lawful[0])?.id||'central';if(kind==='government')return'central';return lawful[0]?.id||powers[0]?.id||'central'}

if(typeof window!=='undefined')window.__campaignFactions={FACTIONS,SYSTEM_POWERS,localPowers,relation,playerStanding};
