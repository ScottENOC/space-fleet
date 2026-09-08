import {shipFromModules} from './sim.js';

export const CELL_METRES=3;
export const DEFAULT_TARGET_PRIORITY=['weapons','engine','reactor','bridge','shield','radiator','armor','hull'];
const DEG=Math.PI/180;

function rowsFromWidths(widths){const max=Math.max(...widths);return widths.map(w=>'.'.repeat((max-w)/2)+'#'.repeat(w)+'.'.repeat((max-w)/2))}
function diamondRows(peak,plateau=1){const up=[];for(let w=1;w<=peak;w+=2)up.push(w);return rowsFromWidths([...up,...Array(Math.max(0,plateau-1)).fill(peak),...up.slice(0,-1).reverse()])}
function cellsFromRows(rows){const out=[];rows.forEach((r,y)=>[...r].forEach((c,x)=>{if(c==='#')out.push([x,y])}));return out}
function hull(id,name,shipClass,role,rows,frameMass,frameHp,ai='pursuit'){const h={id,name,shipClass,role,rows,frameMass,frameHp,ai};h.cells=cellsFromRows(rows);h.width=rows[0].length;h.height=rows.length;h.cellCount=h.cells.length;return h}

export const HULLS={
 frigate_sparrow:hull('frigate_sparrow','Sparrow-class starter frigate','Frigate','7-cell starter / scout',['.#.','.#.','.#.','###','.#.'],7,155,'pursuit'),
 frigate_dart:hull('frigate_dart','Dart-class frigate','Frigate','Fast escort',rowsFromWidths([1,1,3,5,5,3,1]),18,270,'pursuit'),
 frigate_line:hull('frigate_line','Lancer-class frigate','Frigate','Heavy frigate / line escort',rowsFromWidths([1,3,5,7,7,5,3]),28,430,'broadside'),
 destroyer_rapier:hull('destroyer_rapier','Rapier-class destroyer','Destroyer','Fast attack destroyer',diamondRows(11,1),52,690,'pursuit'),
 destroyer_guardian:hull('destroyer_guardian','Guardian-class destroyer','Destroyer','Escort / point defence',diamondRows(11,3),66,900,'broadside'),
 destroyer_torpedo:hull('destroyer_torpedo','Pike-class destroyer','Destroyer','Missile / torpedo attack',diamondRows(11,5),79,1120,'pursuit'),
 cruiser_pathfinder:hull('cruiser_pathfinder','Pathfinder-class light cruiser','Cruiser','Independent patrol cruiser',diamondRows(13,5),112,1550,'pursuit'),
 cruiser_line:hull('cruiser_line','Ardent-class line cruiser','Cruiser','General-purpose line cruiser',diamondRows(15,5),145,1920,'broadside'),
 cruiser_missile:hull('cruiser_missile','Longbow-class missile cruiser','Cruiser','Stand-off missile cruiser',diamondRows(17,5),176,2280,'pursuit'),
 battleship_line:hull('battleship_line','Sovereign-class battleship','Battleship','Line-of-battle anchor',diamondRows(19,5),245,3300,'broadside'),
 battleship_siege:hull('battleship_siege','Monarch-class siege battleship','Battleship','Heavy gun platform',diamondRows(21,5),288,4200,'broadside'),
 battleship_fast:hull('battleship_fast','Vanguard-class fast battleship','Battleship','Fast capital ship',diamondRows(23,5),326,4700,'pursuit'),
 carrier_light:hull('carrier_light','Harrier-class light carrier','Carrier','Fast fighter carrier',diamondRows(19,3),220,2800,'pursuit'),
 carrier_fleet:hull('carrier_fleet','Atlas-class fleet carrier','Carrier','Fleet fighter carrier',diamondRows(23,3),300,3900,'broadside'),
 carrier_super:hull('carrier_super','Leviathan-class heavy carrier','Carrier','Heavy carrier / command ship',diamondRows(25,5),385,5000,'broadside')
};

function module(name,type,size,mass,hp,extra={}){return{name,type,size,mass,hp,...extra}}
const directional={directional:true};
export const MODULES={
 bridge_1:module('Compact bridge','bridge',[1,1],3,65,{colour:'#d9e1ec'}),
 bridge_2:module('Command bridge','bridge',[2,1],5,125,{colour:'#e7edf5'}),
 reactor_1:module('Micro reactor','reactor',[1,1],4,70,{power:6e6,colour:'#f4cf63'}),
 reactor_2:module('Reactor','reactor',[2,2],13,190,{power:28e6,colour:'#f4cf63'}),
 reactor_3:module('Capital reactor','reactor',[3,3],24,390,{power:78e6,colour:'#ffe17d'}),
 engine_1:module('Micro engine','engine',[1,1],4,70,{force:.42e6,powerUse:1.4e6,...directional,clearance:'exhaust',colour:'#56b6ff'}),
 engine_2:module('Drive engine','engine',[2,1],7,125,{force:1.05e6,powerUse:2.8e6,...directional,clearance:'exhaust',colour:'#56b6ff'}),
 engine_3:module('Heavy drive','engine',[3,2],17,260,{force:3.9e6,powerUse:7.5e6,...directional,clearance:'exhaust',colour:'#47aef5'}),
 engine_4:module('Capital drive','engine',[3,3],22,390,{force:7.2e6,powerUse:12e6,...directional,clearance:'exhaust',colour:'#3aa7f2'}),
 thruster_1:module('Manoeuvre thruster','engine',[1,1],3,55,{force:.30e6,powerUse:.9e6,...directional,clearance:'exhaust',colour:'#78c9ff'}),
 thruster_2:module('Heavy manoeuvre thruster','engine',[2,1],5,95,{force:.82e6,powerUse:1.9e6,...directional,clearance:'exhaust',colour:'#78c9ff'}),
 gun_1:module('Light naval gun','gun',[1,1],4,65,{powerUse:.1e6,ammo:70,projectileMass:8,muzzle:1250,damage:38,cooldown:1.35,penetration:.75,arc:15*DEG,...directional,clearance:'muzzle',colour:'#dedede'}),
 gun_2:module('Naval gun','gun',[2,1],7,115,{powerUse:.18e6,ammo:115,projectileMass:18,muzzle:1450,damage:82,cooldown:1.15,penetration:1.05,arc:15*DEG,...directional,clearance:'muzzle',colour:'#d4d4d4'}),
 gun_3:module('Heavy naval gun','gun',[3,2],18,270,{powerUse:.4e6,ammo:210,projectileMass:54,muzzle:1650,damage:205,cooldown:1.65,penetration:1.55,arc:15*DEG,...directional,clearance:'muzzle',colour:'#c9c9c9'}),
 missile_1:module('Light missile rack','missile',[1,1],4,55,{powerUse:.12e6,ammo:6,damage:105,cooldown:4.2,missileThrust:85e3,missileFuel:9,missileHp:24,arc:15*DEG,...directional,clearance:'muzzle',colour:'#d88962'}),
 missile_2:module('Missile battery','missile',[2,1],7,100,{powerUse:.22e6,ammo:14,damage:175,cooldown:3.8,missileThrust:135e3,missileFuel:12,missileHp:38,arc:15*DEG,...directional,clearance:'muzzle',colour:'#dc825a'}),
 missile_3:module('Heavy missile battery','missile',[3,2],17,230,{powerUse:.45e6,ammo:34,damage:330,cooldown:3.3,missileThrust:235e3,missileFuel:16,missileHp:68,arc:15*DEG,...directional,clearance:'muzzle',colour:'#e07a4e'}),
 laser_1:module('Light laser','laser',[1,1],4,60,{powerUse:1.8e6,damage:22,cooldown:.8,range:9000,penetration:.35,arc:15*DEG,...directional,clearance:'muzzle',colour:'#ff7c7c'}),
 laser_2:module('Beam laser','laser',[2,1],7,110,{powerUse:4.8e6,damage:48,cooldown:.65,range:16000,penetration:.48,arc:15*DEG,...directional,clearance:'muzzle',colour:'#ff6f6f'}),
 laser_3:module('Heavy beam laser','laser',[3,2],18,250,{powerUse:12e6,damage:115,cooldown:.55,range:28000,penetration:.62,arc:15*DEG,...directional,clearance:'muzzle',colour:'#ff6262'}),
 shield_1:module('Compact shield','shield',[1,1],4,65,{powerUse:2e6,capacity:140,recharge:12,colour:'#79e0ff'}),
 shield_2:module('Shield generator','shield',[2,2],12,180,{powerUse:6e6,capacity:720,recharge:58,colour:'#79e0ff'}),
 shield_3:module('Capital shield','shield',[3,3],23,360,{powerUse:14e6,capacity:1900,recharge:145,colour:'#67d9ff'}),
 armor_1:module('Armour cell','armor',[1,1],5,115,{absorb:.68,colour:'#777'}),
 armor_2:module('Armour block','armor',[2,1],9,245,{absorb:.72,colour:'#707070'}),
 armor_3:module('Heavy armour block','armor',[3,2],24,790,{absorb:.78,colour:'#686868'}),
 radiator_1:module('Compact radiator','radiator',[1,1],3,60,{colour:'#a895c7'}),
 radiator_2:module('Radiator bank','radiator',[2,1],5,115,{colour:'#a895c7'}),
 radiator_3:module('Capital radiator','radiator',[3,2],13,280,{colour:'#9d88bd'}),
 fighter_bay_1:module('Light fighter bay','fighterBay',[4,2],28,180,{powerUse:2e6,fighters:4,launchCooldown:3.5,...directional,clearance:'muzzle',colour:'#9fd18c'}),
 fighter_bay_2:module('Fleet fighter bay','fighterBay',[5,3],47,330,{powerUse:4e6,fighters:10,launchCooldown:2.7,...directional,clearance:'muzzle',colour:'#8fc87b'}),
 fighter_bay_3:module('Capital fighter bay','fighterBay',[6,3],59,440,{powerUse:6e6,fighters:16,launchCooldown:2.2,...directional,clearance:'muzzle',colour:'#83bd70'})
};

const SIM_DEFAULTS={hull:{mass:4,hp:100},armor:{mass:4,hp:90,absorb:.68},reactor:{mass:4,hp:70,power:6e6},engine:{mass:4,hp:70,force:.42e6,powerUse:1.4e6},gun:{mass:4,hp:65,powerUse:.1e6,ammo:70,projectileMass:8,muzzle:1250,damage:38,cooldown:1.35,penetration:.75,arc:15*DEG},laser:{mass:4,hp:60,powerUse:1.8e6,damage:22,cooldown:.8,range:9000,penetration:.35,arc:15*DEG},missile:{mass:4,hp:55,powerUse:.15e6,ammo:6,damage:105,cooldown:4.2,arc:15*DEG,missileThrust:85e3,missileFuel:9,missileHp:24},shield:{mass:4,hp:65,powerUse:2e6,capacity:140,recharge:12},bridge:{mass:3,hp:65},radiator:{mass:3,hp:60},fighterBay:{mass:28,hp:180,powerUse:2e6,fighters:4,launchCooldown:3.5}};
function createSimModule(type,x,y,opts={}){return{type,x,y,...SIM_DEFAULTS[type],...opts,id:opts.id||`${type}-${Math.random().toString(36).slice(2,8)}`,cooldownLeft:0,active:false,disabled:false}}
export function emptyBlueprint(hullId='frigate_sparrow',name='Untitled ship',ai=null){return{name,hullId,ai:ai||HULLS[hullId].ai,targetPriority:[...DEFAULT_TARGET_PRIORITY],placements:[]}}
export function cloneBlueprint(bp){return JSON.parse(JSON.stringify(bp))}
function rotatedSize(spec,rot){const [w,h]=spec.size;return rot%2?[h,w]:[w,h]}
export function footprint(p){const spec=MODULES[p.moduleId],[w,h]=rotatedSize(spec,p.rot||0),out=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++)out.push([p.x+x,p.y+y]);return out}
function dirForRot(rot){return[[1,0],[0,1],[-1,0],[0,-1]][((rot%4)+4)%4]}
export function clearanceCells(bp,p){const spec=MODULES[p.moduleId];if(!spec?.clearance)return[];const h=HULLS[bp.hullId],valid=new Set(h.cells.map(c=>c.join(','))),own=footprint(p),ownSet=new Set(own.map(c=>c.join(',')));let[dx,dy]=dirForRot(p.rot||0);if(spec.clearance==='exhaust'){dx=-dx;dy=-dy}const out=[],seen=new Set();for(const[cx,cy]of own){if(ownSet.has(`${cx+dx},${cy+dy}`))continue;let x=cx+dx,y=cy+dy;while(valid.has(`${x},${y}`)){const k=`${x},${y}`;if(!seen.has(k)){seen.add(k);out.push([x,y])}x+=dx;y+=dy}}return out}
function occupied(bp,ignore=-1){const out=new Set();bp.placements.forEach((p,i)=>{if(i!==ignore)for(const c of footprint(p))out.add(c.join(','))});return out}
function reserved(bp,ignore=-1){const out=new Set();bp.placements.forEach((p,i)=>{if(i!==ignore)for(const c of clearanceCells(bp,p))out.add(c.join(','))});return out}
export function canPlace(bp,moduleId,x,y,rot=0,ignore=-1){const h=HULLS[bp.hullId],valid=new Set(h.cells.map(c=>c.join(','))),occ=occupied(bp,ignore),res=reserved(bp,ignore),test={moduleId,x,y,rot},fp=footprint(test);if(!fp.every(c=>valid.has(c.join(','))&&!occ.has(c.join(','))&&!res.has(c.join(','))))return false;return clearanceCells(bp,test).every(c=>!occ.has(c.join(',')))}
export function placeModule(bp,moduleId,x,y,rot=0){if(!MODULES[moduleId]||!canPlace(bp,moduleId,x,y,rot))return false;bp.placements.push({moduleId,x,y,rot:((rot%4)+4)%4});return true}
export function removeAt(bp,x,y){const i=bp.placements.findIndex(p=>footprint(p).some(c=>c[0]===x&&c[1]===y));if(i<0)return false;bp.placements.splice(i,1);return true}
function centre(h,p){const cs=footprint(p),x=cs.reduce((a,c)=>a+c[0]+.5,0)/cs.length,y=cs.reduce((a,c)=>a+c[1]+.5,0)/cs.length;return[(x-h.width/2)*CELL_METRES,(y-h.height/2)*CELL_METRES]}
function dirRadians(rot){return(rot%4)*Math.PI/2}
export function blueprintToShip(bp,team='A'){const h=HULLS[bp.hullId],mods=[createSimModule('hull',0,0,{id:'keel',mass:h.frameMass,hp:h.frameHp})];bp.placements.forEach((p,i)=>{const spec=MODULES[p.moduleId],[x,y]=centre(h,p),dir=dirRadians(p.rot||0),opts={...spec,moduleId:p.moduleId,id:`${p.moduleId}-${i+1}`,gridCells:footprint(p).map(c=>[...c])};delete opts.name;delete opts.type;delete opts.size;delete opts.directional;delete opts.colour;delete opts.clearance;if(spec.type==='engine')opts.dir=dir;if(['gun','laser','missile','fighterBay'].includes(spec.type))opts.mountDir=dir;mods.push(createSimModule(spec.type,x,y,opts))});const s=shipFromModules(bp.name,team,mods,{length:h.width*CELL_METRES,width:h.height*CELL_METRES,ai:bp.ai||h.ai,targetPriority:bp.targetPriority||DEFAULT_TARGET_PRIORITY,grid:{cellMetres:CELL_METRES,width:h.width,height:h.height,validCells:h.cells.map(c=>[...c])}});s.shipClass=h.shipClass;s.hullId=h.id;return s}
export function designStats(bp){const h=HULLS[bp.hullId];let mass=h.frameMass,power=0,maxPowerUse=0,thrust=0,weapons=0,fighters=0;for(const p of bp.placements){const m=MODULES[p.moduleId];mass+=m.mass||0;if(m.power)power+=m.power;if(m.powerUse)maxPowerUse+=m.powerUse;if(m.force)thrust+=m.force;if(['gun','laser','missile'].includes(m.type))weapons++;if(m.type==='fighterBay')fighters+=m.fighters||0}return{mass,power,maxPowerUse,thrust,weapons,fighters,cellsUsed:bp.placements.reduce((a,p)=>a+footprint(p).length,0),cellsTotal:h.cellCount}}
