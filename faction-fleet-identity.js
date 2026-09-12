import {campaign} from './campaign-core.js';
import {blueprintToShip,canPlace,placeModule,MODULES,HULLS} from './shipyard.js';
import {makePremade} from './premades.js';
import './craft-catalog.js';
import {FACTIONS,localPowers} from './factions-system.js?v=68';
import {installSpecialisation,applySpecialisations} from './ship-specialisations.js?v=70';

export const FACTION_FLEET_IDENTITIES={
 central:{label:'Central Navy',hulls:['destroyer_guardian','cruiser_line'],doctrine:'broadside',priority:['weapons','engine','reactor','bridge','shield','radiator','armor','hull'],style:'Layered defence, disciplined fire control and conservative redundancy.',specialisations:['centralFireControl']},
 haven:{label:'Haven Patrol',hulls:['frigate_line','destroyer_guardian'],doctrine:'broadside',priority:['weapons','engine','bridge','reactor','shield','radiator','armor','hull'],style:'Escort-oriented generalists with dependable close defence.',specialisations:['havenEscort']},
 pelagosA:{label:'Compact Defence Fleet',hulls:['destroyer_rapier','cruiser_line'],doctrine:'pursuit',priority:['weapons','engine','reactor','bridge','shield','armor','hull'],style:'Coordinated missile pressure built around the restricted Asterion missile family.',specialisations:['asterion']},
 pelagosB:{label:'Free Port Security',hulls:['frigate_dart','destroyer_rapier'],doctrine:'pursuit',priority:['engine','weapons','bridge','reactor','shield','armor','hull'],style:'Fast, commercially minded ships that favour mobility and disengagement options.',specialisations:['freePortDrive']},
 kestrel:{label:'Kestrel Colonial Fleet',hulls:['frigate_line','destroyer_guardian'],doctrine:'broadside',priority:['weapons','engine','reactor','bridge','armor','hull'],style:'Practical mixed batteries designed to keep functioning far from support.',specialisations:['frontierRepair']},
 nadir:{label:'Nadir League Fleet',hulls:['frigate_dart','frigate_line'],doctrine:'pursuit',priority:['engine','weapons','bridge','reactor','armor','hull'],style:'Rugged local defence craft with little wasted mass.',specialisations:['frontierRepair']},
 meridian:{label:'Meridian Security',hulls:['frigate_dart','destroyer_guardian'],doctrine:'broadside',priority:['weapons','engine','bridge','reactor','hull'],style:'Convoy protection: strong point defence, endurance and threat suppression.',specialisations:['havenEscort']},
 orpheus:{label:'Orpheus Security',hulls:['frigate_line','destroyer_torpedo'],doctrine:'broadside',priority:['engine','weapons','reactor','bridge','armor','hull'],style:'Heavy industrial security ships: tough, blunt and well supplied.',specialisations:['orpheusArmour']},
 frontierGuard:{label:'Mutual Defence flotilla',hulls:['frigate_sparrow','frigate_line','destroyer_guardian'],doctrine:'broadside',priority:['weapons','engine','bridge','reactor','hull'],style:'Versatile civilian-derived escorts built around ordinary naval guns and field repair.',specialisations:['frontierRepair']},
 redKnives:{label:'Red Knives prize crew',hulls:['frigate_dart','destroyer_rapier'],doctrine:'pursuit',priority:['engine','weapons','bridge','reactor','shield','hull'],style:'Fast raiders using precise disabling fire to kill drives, close and board intact prizes.',boarding:true,precision:true,specialisations:['redKnifePrize']},
 blackWake:{label:'Black Wake raider',hulls:['frigate_sparrow','destroyer_torpedo'],doctrine:'pursuit',priority:['engine','weapons','bridge','reactor','hull'],style:'Elusive raiders favouring deception, missiles, boarding and escape over stand-up fights.',boarding:true,precision:true,ew:true,specialisations:['blackWakeBaffles']}
};

function firstSpace(bp,id,rot=0){const h=HULLS[bp.hullId];if(!h)return null;for(let y=0;y<h.height;y++)for(let x=0;x<h.width;x++)if(canPlace(bp,id,x,y,rot))return{x,y};return null}
function placeAnywhere(bp,id,rot=0){const p=firstSpace(bp,id,rot);return p?placeModule(bp,id,p.x,p.y,rot):false}
function freeFor(bp,id,rot=0){if(firstSpace(bp,id,rot))return true;for(let i=bp.placements.length-1;i>=0;i--){const p=bp.placements[i];if(!/^armor_/.test(p.moduleId)&&!/^radiator_/.test(p.moduleId))continue;bp.placements.splice(i,1);if(firstSpace(bp,id,rot))return true}return false}
function fitBoardingPackage(bp){for(const [id,rot] of [['marine_1',0],['launch_bay_1',3],['hangar_1',0]]){if(!MODULES[id])continue;if(!freeFor(bp,id,rot)||!placeAnywhere(bp,id,rot))return false}return true}
function tuneBlueprint(bp,factionId){const id=FACTION_FLEET_IDENTITIES[factionId]||FACTION_FLEET_IDENTITIES.haven;bp.ai=id.doctrine;bp.targetPriority=[...id.priority];bp.factionId=factionId;bp.factionStyle=id.style;bp.specialisationIds=[...(id.specialisations||[])];if(id.boarding)fitBoardingPackage(bp);return bp}
export function makeFactionBlueprint(factionId,index=0){const id=FACTION_FLEET_IDENTITIES[factionId]||FACTION_FLEET_IDENTITIES.haven,hull=id.hulls[index%id.hulls.length],bp=tuneBlueprint(makePremade(hull),factionId);bp.name=`${FACTIONS[factionId]?.short||'Unknown'} ${id.label}`;return bp}
function tuneShip(s,factionId,index=0){const id=FACTION_FLEET_IDENTITIES[factionId]||FACTION_FLEET_IDENTITIES.haven;s.factionId=factionId;s.factionName=FACTIONS[factionId]?.name||factionId;s.factionStyle=id.style;s.targetPriority=[...id.priority];s.ai=id.doctrine;
 if(id.precision){for(const m of s.modules){if(m.type==='gun'){m.muzzle=(m.muzzle||1250)*1.12;m.cooldown=(m.cooldown||1.3)*.86;m.damage=(m.damage||38)*.72;m.penetration=(m.penetration||.75)*.78}if(m.type==='engine')m.force=(m.force||0)*1.10}s.boardingDoctrine='aggressive';s.boardingObjective='capture';s.boardingPosture='capture'}
 if(id.boarding){for(const h of s.modules.filter(m=>m.type==='hangar')){h.defaultCraft={boardingShuttle:Math.max(1,Math.floor((h.hangarSpaces||4)/2))};h.craftInventory={...h.defaultCraft};h.initialCraft={...h.defaultCraft}}}
 if(factionId==='central'||factionId==='haven')s.boardingDoctrine='opportunistic';if(factionId==='blackWake'){s.jammingPosture='aggressive';s.decoyPosture='aggressive'}
 s.specialisationIds=[];for(const spec of id.specialisations||[])installSpecialisation(s,spec);applySpecialisations(s);
 s.name=`${id.label} ${index+1}`;return s}
export function makeFactionEnemyFleet(factionId,count=1){const out=[];for(let i=0;i<count;i++){const bp=makeFactionBlueprint(factionId,i),s=blueprintToShip(bp,'E');out.push(tuneShip(s,factionId,i))}return out}
export function encounterEnemyFaction(enc=campaign.pendingEncounter){if(enc?.targetFaction&&FACTIONS[enc.targetFaction])return enc.targetFaction;if(enc?.centralPatrol)return'central';if(enc?.contract?.targetFaction)return enc.contract.targetFaction;if(enc?.contract?.kind==='antiPiracy'){const local=localPowers(campaign.location).filter(x=>!x.faction.lawful);return local[0]?.id||'redKnives'}if(enc?.contract?.kind==='mercenary')return enc.contract.targetFaction||'pelagosB';const local=localPowers(campaign.location).filter(x=>!x.faction.lawful);return local[0]?.id||'redKnives'}
export function campaignEnemyFleet(playerCount=1){const faction=encounterEnemyFaction(),strength=campaign.factions?.[faction]?.military||20,count=Math.max(1,Math.min(3,playerCount+(strength>45?1:0)-(strength<20?1:0)));return makeFactionEnemyFleet(faction,count)}

if(typeof window!=='undefined')window.__factionFleetIdentity={FACTION_FLEET_IDENTITIES,makeFactionBlueprint,makeFactionEnemyFleet,encounterEnemyFaction};
