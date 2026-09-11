import {campaign,saveCampaign} from './campaign-core.js';
import {HULLS,MODULES} from './shipyard.js';
import {makeTradingPremade,cargoCapacityFromBlueprint,armamentClass} from './trading-hulks.js';
import {FACTIONS,ensureFactionState,issuerFor,changePlayerStanding} from './factions-system.js?v=68';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const R=()=>Math.random();

export const SYSTEMS={
 'Sol Gateway':{authority:1,market:1,security:1,links:['Haven Reach'],note:'The regulated outer-system gate complex. Central authority is immediate and very real here.'},
 'Haven Reach':{authority:.7,market:.85,security:.75,links:['Sol Gateway','Pelagos','Kestrel'],note:'Established colony system, naval paperwork hub and gateway to the frontier.'},
 'Pelagos':{authority:.45,market:1,security:.55,links:['Haven Reach','Nadir'],note:'Prosperous commercial colonies with several rival planetary governments.'},
 'Kestrel':{authority:.28,market:.45,security:.3,links:['Haven Reach','Nadir'],note:'Young scattered colonies, survey claims and large stretches of barely governed space.'},
 'Nadir':{authority:.12,market:.5,security:.15,links:['Pelagos','Kestrel'],note:'Remote frontier system. Smugglers, private navies and pirates operate openly beyond the main settlements.'}
};

export {FACTIONS};

export function ensureFrontierState(){
 campaign.central??={standing:20,lawfulness:0,militaryPermit:false,auxiliary:false,violations:0};
 campaign.factionRep??={haven:5,pelagosA:0,pelagosB:0,kestrel:0,nadir:0};
 campaign.cargo??={};
 campaign.contractsCompleted??={trade:0,escort:0,scout:0,mercenary:0,smuggling:0,antiPiracy:0};
 campaign.knownSystems??=['Sol Gateway','Haven Reach','Pelagos','Kestrel','Nadir'];
 if(!SYSTEMS[campaign.location])campaign.location='Haven Reach';
 ensureFactionState();
 saveCampaign(campaign);return campaign;
}

export function shipLegalProfile(entry){
 const a=armamentClass(entry.blueprint),h=HULLS[entry.blueprint?.hullId];
 return{...a,hullClass:h?.shipClass||'Unknown',civilian:!!h?.civilianHull,cargo:cargoCapacityFromBlueprint(entry.blueprint)};
}
export function activeFleetProfile(){
 ensureFrontierState();const ids=new Set(campaign.activeShipIds||[]),ships=campaign.ships.filter(s=>ids.has(s.id)&&s.status==='active');
 const profiles=ships.map(shipLegalProfile),military=profiles.filter(p=>p.classification==='military').length,merchants=profiles.filter(p=>p.civilian).length,armedMerchants=profiles.filter(p=>p.classification==='armed merchant').length;
 const escortAllowance=merchants?Math.max(2,merchants*2):0;
 const suspicious=Math.max(0,military-escortAllowance)+(merchants===0?military*.7:0);
 return{ships,profiles,military,merchants,armedMerchants,escortAllowance,suspicious,cargoCapacity:profiles.reduce((n,p)=>n+p.cargo,0)};
}

export function cargoUsed(){return Object.values(campaign.cargo||{}).reduce((n,x)=>n+(x.qty||0),0)}
export function cargoFree(){return Math.max(0,activeFleetProfile().cargoCapacity-cargoUsed())}

export function gateDecision(from,to){
 ensureFrontierState();const dest=SYSTEMS[to],profile=activeFleetProfile(),central=campaign.central;
 if(!dest)return{allowed:false,reason:'No calculated gate route.'};
 const scrutiny=Math.max(SYSTEMS[from]?.authority||0,dest.authority||0);
 if(scrutiny<.25)return{allowed:true,risk:.05,reason:'Frontier gate has little effective inspection.'};
 if(profile.suspicious<=0)return{allowed:true,risk:.05+.12*scrutiny,reason:'Fleet profile is consistent with ordinary civilian escort work.'};
 if(central.auxiliary)return{allowed:true,risk:.02,reason:'Central auxiliary credentials authorise military transit.'};
 if(central.militaryPermit)return{allowed:true,risk:.08*scrutiny,reason:'Military transit permit accepted.'};
 const standing=central.standing||0,permitChance=clamp(.12+standing/120-profile.suspicious*.11+(1-scrutiny)*.35,.03,.85);
 if(R()<permitChance)return{allowed:true,risk:.25*scrutiny,reason:'Gate controller accepts your stated military transit purpose.'};
 return{allowed:false,risk:.4*scrutiny,reason:'Military vessels have no recognised business on this inter-system route. Transit denied.'};
}

export function applyInspection(risk=.2){
 ensureFrontierState();if(R()>risk)return{inspected:false};
 const contraband=Object.entries(campaign.cargo||{}).filter(([,v])=>v.illegal&&v.qty>0);
 if(contraband.length){campaign.central.standing-=12;campaign.central.lawfulness-=18;campaign.central.violations+=1;campaign.reputation-=2;changePlayerStanding('central',-12);saveCampaign(campaign);return{inspected:true,caught:true,text:`Inspection found contraband: ${contraband.map(([k,v])=>`${v.qty} ${k}`).join(', ')}.`};}
 return{inspected:true,caught:false,text:'Gate patrol completed an inspection and found nothing actionable.'};
}

const GOODS={
 machinery:{name:'Machinery',base:12},food:{name:'Food & life support',base:7},metals:{name:'Refined metals',base:9},medicine:{name:'Medical supplies',base:18},luxuries:{name:'Luxury goods',base:24},restricted:{name:'Restricted electronics',base:35,illegal:true}
};
export {GOODS};
export function marketPrice(good,system,buy=true){
 const g=GOODS[good],s=SYSTEMS[system]||SYSTEMS['Haven Reach'];let mod=1;
 if(system==='Pelagos'&&good==='luxuries')mod=.72;if(system==='Kestrel'&&['machinery','medicine'].includes(good))mod=1.45;if(system==='Nadir'&&good==='restricted')mod=.62;if(system==='Haven Reach'&&good==='machinery')mod=.82;if(system==='Sol Gateway'&&good==='medicine')mod=.8;
 return Math.max(1,Math.round(g.base*mod*(buy?1.08:.92)));
}
export function tradeGood(good,qty,buy){
 ensureFrontierState();qty=Math.max(0,Math.floor(qty));const g=GOODS[good];if(!g||!qty)return false;
 campaign.cargo[good]??={qty:0,illegal:!!g.illegal};
 if(buy){qty=Math.min(qty,cargoFree());const cost=marketPrice(good,campaign.location,true)*qty;if(qty<=0||campaign.credits<cost)return false;campaign.credits-=cost;campaign.cargo[good].qty+=qty;}
 else{qty=Math.min(qty,campaign.cargo[good].qty);if(qty<=0)return false;campaign.credits+=marketPrice(good,campaign.location,false)*qty;campaign.cargo[good].qty-=qty;}
 saveCampaign(campaign);return true;
}

export function buyTradingHulk(kind){
 ensureFrontierState();const hull=HULLS[kind];if(!hull?.civilianHull||campaign.credits<(hull.basePrice||999999))return null;
 campaign.credits-=hull.basePrice;const number=campaign.ships.filter(s=>s.blueprint?.hullId===kind).length+1,name=`${hull.name.split('-class')[0]} ${number}`;
 const bp=makeTradingPremade(kind);bp.name=name;const entry={id:'ship_'+Math.random().toString(36).slice(2,10),name,blueprint:bp,status:'active',xp:0,battles:0,kills:0,state:null,history:[`Day ${campaign.day}: purchased at ${campaign.location}.`]};campaign.ships.push(entry);saveCampaign(campaign);return entry;
}

function contract(kind,title,pay,legal,text){const issuer=issuerFor(kind,campaign.location);return{kind,title,pay,legal,text,issuer,issuerName:FACTIONS[issuer]?.name||'Independent principal'}}
export function generateContracts(){
 ensureFrontierState();const sys=campaign.location,security=SYSTEMS[sys].security,authority=SYSTEMS[sys].authority,contracts=[];
 contracts.push(contract('escort','Convoy escort',180+Math.round((1-security)*220),true,'Escort civilian transports between local planets and the gate approaches.'));
 contracts.push(contract('scout','Survey / scout run',130+Math.round((1-security)*120),true,'Map contacts and route hazards in the outer system.'));
 if(sys==='Pelagos'||sys==='Nadir')contracts.push(contract('mercenary','Local war contract',320+Math.round((1-security)*260),true,'One recognised local government wants naval support against another faction inside this solar system.'));
 if(security<.6)contracts.push(contract('antiPiracy','Pirate suppression',220+Math.round((1-security)*250),true,'Hunt raiders threatening commercial traffic.'));
 if(authority<.6)contracts.push(contract('smuggling','Quiet cargo movement',360+Math.round(authority*180),false,'Move restricted cargo through a gate without attracting official attention.'));
 if((campaign.central.standing||0)>55)contracts.push(contract('government','Central Government special tasking',500,true,'A naval liaison wants a deniable, experienced independent fleet for sensitive work.'));
 return contracts;
}

export function completeAbstractContract(c){
 ensureFrontierState();campaign.day+=1;campaign.credits+=c.pay;campaign.contractsCompleted[c.kind]=(campaign.contractsCompleted[c.kind]||0)+1;
 if(c.legal){campaign.central.standing+=c.kind==='antiPiracy'?2:1;campaign.central.lawfulness+=1;campaign.reputation+=1;changePlayerStanding(c.issuer||'central',c.kind==='government'?4:2);}else{campaign.central.lawfulness-=4;campaign.cargo.restricted??={qty:0,illegal:true};campaign.cargo.restricted.qty+=Math.min(5,cargoFree());changePlayerStanding(c.issuer||'blackWake',3);}
 if(c.kind==='government'){campaign.central.auxiliary=true;campaign.central.militaryPermit=true;campaign.log.push(`Day ${campaign.day}: Central Naval Liaison granted auxiliary transit credentials.`);}
 else campaign.log.push(`Day ${campaign.day}: completed ${c.title} for ${c.issuerName||FACTIONS[c.issuer]?.name||'a local principal'}; earned ${c.pay} cr.`);
 saveCampaign(campaign);
}
