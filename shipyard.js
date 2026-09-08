import {shipFromModules} from './sim.js';

export const CELL_METRES=3;
export const DEFAULT_TARGET_PRIORITY=['weapons','engine','reactor','bridge','shield','radiator','armor','hull'];
const DEG=Math.PI/180;
const SIM_DEFAULTS={
 hull:{mass:4,hp:100},armor:{mass:4,hp:90,absorb:.68},reactor:{mass:4,hp:70,power:6e6},
 engine:{mass:4,hp:70,force:.42e6,powerUse:1.4e6},gun:{mass:4,hp:65,powerUse:.1e6,ammo:70,projectileMass:8,muzzle:1250,damage:38,cooldown:1.35,penetration:.75,arc:15*DEG},
 laser:{mass:4,hp:60,powerUse:1.8e6,damage:22,cooldown:.8,range:9000,penetration:.35,arc:15*DEG,shieldEfficiency:2.5},
 missile:{mass:4,hp:55,powerUse:.15e6,ammo:6,damage:105,cooldown:4.2,arc:15*DEG,missileThrust:85e3,missileFuel:9,missileHp:24},
 shield:{mass:4,hp:65,powerUse:2e6,capacity:140,recharge:12},bridge:{mass:3,hp:65},radiator:{mass:3,hp:60},fighterBay:{mass:28,hp:180,powerUse:2e6,fighters:4,launchCooldown:3.5}
};
function createSimModule(type,x,y,opts={}){return{type,x,y,...SIM_DEFAULTS[type],...opts,id:opts.id||`${type}-${Math.random().toString(36).slice(2,8)}`,cooldownLeft:0,active:false,disabled:false}}
function rowsFromHalfWidths(halfWidths,centre=true){
 const max=Math.max(...halfWidths),width=max*2+(centre?1:0);
 return halfWidths.map(hw=>'.'.repeat(max-hw)+(centre?'#':'')+'#'.repeat(hw*2)+'.'.repeat(max-hw));
}
function hull(id,name,shipClass,role,rows,frameMass,frameHp,ai='pursuit'){return{id,name,shipClass,role,rows,frameMass,frameHp,ai}}
function cellsFromRows(rows){const cells=[];rows.forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='#')cells.push([x,y])}));return cells}

// All frames are bilaterally symmetric. The Sparrow is intentionally the exact
// seven-cell T requested: five cells in a column with a one-cell wing on either
// side of the second cell from the bottom.
export const HULLS={
 frigate_sparrow:hull('frigate_sparrow','Sparrow-class starter frigate','Frigate','7-cell starter / scout',['.#.','.#.','.#.','###','.#.'],7,155,'pursuit'),
 frigate_dart:hull('frigate_dart','Dart-class frigate','Frigate','Fast escort',rowsFromHalfWidths([0,1,1,2,2,2,1,1,0]),18,270,'pursuit'),
 frigate_line:hull('frigate_line','Lancer-class frigate','Frigate','Heavy frigate / line escort',rowsFromHalfWidths([1,2,2,3,3,3,3,3,2,2,1]),32,430,'broadside'),

 destroyer_rapier:hull('destroyer_rapier','Rapier-class destroyer','Destroyer','Fast attack destroyer',rowsFromHalfWidths([0,1,2,3,3,4,4,4,3,3,2,1,0]),58,690,'pursuit'),
 destroyer_guardian:hull('destroyer_guardian','Guardian-class destroyer','Destroyer','Escort / point defence',rowsFromHalfWidths([1,2,3,4,4,5,5,5,5,4,4,3,2,1]),82,900,'broadside'),
 destroyer_torpedo:hull('destroyer_torpedo','Pike-class destroyer','Destroyer','Missile / torpedo attack',rowsFromHalfWidths([0,1,2,3,4,5,5,6,6,5,5,4,3,2,1,0]),108,1120,'pursuit'),

 cruiser_pathfinder:hull('cruiser_pathfinder','Pathfinder-class light cruiser','Cruiser','Independent patrol cruiser',rowsFromHalfWidths([1,2,3,4,5,6,6,7,7,7,6,6,5,4,3,2,1]),155,1550,'pursuit'),
 cruiser_line:hull('cruiser_line','Ardent-class line cruiser','Cruiser','General-purpose line cruiser',rowsFromHalfWidths([1,2,3,4,5,6,7,8,8,8,8,8,7,6,5,4,3,2,1]),205,1920,'broadside'),
 cruiser_missile:hull('cruiser_missile','Longbow-class missile cruiser','Cruiser','Stand-off missile cruiser',rowsFromHalfWidths([0,1,2,3,4,5,6,7,8,9,9,9,9,9,8,7,6,5,4,3,2,1,0]),270,2280,'pursuit'),

 battleship_line:hull('battleship_line','Sovereign-class battleship','Battleship','Line-of-battle anchor',rowsFromHalfWidths([2,3,4,5,6,7,8,9,10,10,11,11,11,11,11,10,10,9,8,7,6,5,4,3,2]),370,3300,'broadside'),
 battleship_siege:hull('battleship_siege','Monarch-class siege battleship','Battleship','Heavy gun platform',rowsFromHalfWidths([1,2,3,4,5,6,7,8,9,10,11,12,12,12,13,13,13,13,13,12,12,12,11,10,9,8,7,6,5,4,3,2,1]),510,4200,'broadside'),
 battleship_fast:hull('battleship_fast','Vanguard-class fast battleship','Battleship','Fast capital ship',rowsFromHalfWidths([0,1,2,3,4,5,6,7,8,9,10,11,12,12,13,13,13,13,13,13,13,12,12,11,10,9,8,7,6,5,4,3,2,1,0]),610,4700,'pursuit'),

 carrier_light:hull('carrier_light','Harrier-class light carrier','Carrier','Fast fighter carrier',rowsFromHalfWidths([1,2,3,4,5,6,7,8,9,10,10,10,10,10,10,10,9,8,7,6,5,4,3,2,1]),330,2800,'pursuit'),
 carrier_fleet:hull('carrier_fleet','Atlas-class fleet carrier','Carrier','Fleet fighter carrier',rowsFromHalfWidths([2,3,4,5,6,7,8,9,10,11,12,12,12,12,12,12,12,12,12,12,12,11,10,9,8,7,6,5,4,3,2]),500,3900,'broadside'),
 carrier_super:hull('carrier_super','Leviathan-class heavy carrier','Carrier','Heavy carrier / command ship',rowsFromHalfWidths([2,3,4,5,6,7,8,9,10,11,12,13,14,14,14,14,14,14,14,14,14,14,14,14,14,13,12,11,10,9,8,7,6,5,4,3,2]),690,5000,'broadside')
};
for(const h of Object.values(HULLS)){h.cells=cellsFromRows(h.rows);h.width=h.rows[0].length;h.height=h.rows.length;h.cellCount=h.cells.length}

function module(name,type,size,mass,hp,extra={}){return{name,type,size,mass,hp,...extra}}
const dir={directional:true};
export const MODULES={
 bridge_1:module('Compact bridge','bridge',[1,1],3,65,{colour:'#d9e1ec'}),
 bridge_2:module('Command bridge','bridge',[2,1],5,125,{colour:'#e7edf5'}),
 reactor_1:module('Micro reactor','reactor',[1,1],4,70,{power:6e6,colour:'#f4cf63'}),
 reactor_2:module('Reactor','reactor',[2,2],13,190,{power:28e6,colour:'#f4cf63'}),
 reactor_3:module('Capital reactor','reactor',[3,3],24,390,{power:78e6,colour:'#ffe17d'}),
 engine_1:module('Micro engine','engine',[1,1],4,70,{force:.42e6,powerUse:1.4e6,...dir,clearance:'exhaust',colour:'#56b6ff'}),
 engine_2:module('Drive engine','engine',[2,1],7,125,{force:1.05e6,powerUse:2.8e6,...dir,clearance:'exhaust',colour:'#56b6ff'}),
 engine_3:module('Heavy drive','engine',[3,2],17,260,{force:3.9e6,powerUse:7.5e6,...dir,clearance:'exhaust',colour:'#47aef5'}),
 engine_4:module('Capital drive','engine',[3,3],22,390,{force:7.2e6,powerUse:12e6,...dir,clearance:'exhaust',colour:'#3aa7f2'}),
 thruster_1:module('Manoeuvre thruster','engine',[1,1],3,55,{force:.30e6,powerUse:.9e6,...dir,clearance:'exhaust',colour:'#78c9ff'}),
 thruster_2:module('Heavy manoeuvre thruster','engine',[2,1],5,95,{force:.82e6,powerUse:1.9e6,...dir,clearance:'exhaust',colour:'#78c9ff'}),

 gun_1:module('Light naval gun','gun',[1,1],4,65,{powerUse:.1e6,ammo:70,projectileMass:8,muzzle:1250,damage:38,cooldown:1.35,penetration:.75,arc:15*DEG,...dir,clearance:'muzzle',colour:'#dedede'}),
 gun_2:module('Naval gun','gun',[2,1],7,115,{powerUse:.18e6,ammo:115,projectileMass:18,muzzle:1450,damage:82,cooldown:1.15,penetration:1.05,arc:15*DEG,...dir,clearance:'muzzle',colour:'#d4d4d4'}),
 gun_3:module('Heavy naval gun','gun',[3,2],18,270,{powerUse:.4e6,ammo:210,projectileMass:54,muzzle:1650,damage:205,cooldown:1.65,penetration:1.55,arc:15*DEG,...dir,clearance:'muzzle',colour:'#c9c9c9'}),
 missile_1:module('Light missile rack','missile',[1,1],4,55,{powerUse:.12e6,ammo:6,damage:105,cooldown:4.2,missileThrust:85e3,missileFuel:9,missileHp:24,arc:15*DEG,...dir,clearance:'muzzle',colour:'#d88962'}),
 missile_2:module('Missile battery','missile',[2,1],7,100,{powerUse:.22e6,ammo:14,damage:175,cooldown:3.8,missileThrust:135e3,missileFuel:12,missileHp:38,arc:15*DEG,...dir,clearance:'muzzle',colour:'#dc825a'}),
 missile_3:module('Heavy missile battery','missile',[3,2],17,230,{powerUse:.45e6,ammo:34,damage:330,cooldown:3.3,missileThrust:235e3,missileFuel:16,missileHp:68,arc:15*DEG,...dir,clearance:'muzzle',colour:'#e07a4e'}),
 laser_1:module('Light laser','laser',[1,1],4,60,{powerUse:1.8e6,damage:22,cooldown:.8,range:9000,penetration:.35,shieldEfficiency:2.5,arc:15*DEG,...dir,clearance:'muzzle',colour:'#ff7c7c'}),
 laser_2:module('Beam laser','laser',[2,1],7,110,{powerUse:4.8e6,damage:48,cooldown:.65,range:16000,penetration:.48,shieldEfficiency:2.8,arc:15*DEG,...dir,clearance:'muzzle',colour:'#ff6f6f'}),
 laser_3:module('Heavy beam laser','laser',[3,2],18,250,{powerUse:12e6,damage:115,cooldown:.55,range:28000,penetration:.62,shieldEfficiency:3.1,arc:15*DEG,...dir,clearance:'muzzle',colour:'#ff6262'}),

 shield_1:module('Compact shield','shield',[1,1],4,65,{powerUse:2e6,capacity:140,recharge:12,colour:'#79e0ff'}),
 shield_2:module('Shield generator','shield',[2,2],12,180,{powerUse:6e6,capacity:720,recharge:58,colour:'#79e0ff'}),
 shield_3:module('Capital shield','shield',[3,3],23,360,{powerUse:14e6,capacity:1900,recharge:145,colour:'#67d9ff'}),
 armor_1:module('Armour cell','armor',[1,1],5,115,{absorb:.68,colour:'#777'}),
 armor_2:module('Armour block','armor',[2,1],9,245,{absorb:.72,colour:'#707070'}),
 armor_3:module('Heavy armour block','armor',[3,2],24,790,{absorb:.78,colour:'#686868'}),
 radiator_1:module('Compact radiator','radiator',[1,1],3,60,{colour:'#a895c7'}),
 radiator_2:module('Radiator bank','radiator',[2,1],5,115,{colour:'#a895c7'}),
 radiator_3:module('Capital radiator','radiator',[3,2],13,280,{colour:'#9d88bd'}),
 fighter_bay_1:module('Light fighter bay','fighterBay',[4,2],28,180,{powerUse:2e6,fighters:4,launchCooldown:3.5,...dir,clearance:'muzzle',colour:'#9fd18c'}),
 fighter_bay_2:module('Fleet fighter bay','fighterBay',[5,3],47,330,{powerUse:4e6,fighters:10,launchCooldown:2.7,...dir,clearance:'muzzle',colour:'#8fc87b'}),
 fighter_bay_3:module('Capital fighter bay','fighterBay',[6,3],59,440,{powerUse:6e6,fighters:16,launchCooldown:2.2,...dir,clearance:'muzzle',colour:'#83bd70'})
};

export function emptyBlueprint(hullId='frigate_sparrow',name='Untitled ship',ai=null){return{name,hullId,ai:ai||HULLS[hullId].ai,targetPriority:[...DEFAULT_TARGET_PRIORITY],placements:[]}}
export function cloneBlueprint(bp){return JSON.parse(JSON.stringify(bp))}
function rotatedSize(spec,rot){const [w,h]=spec.size;return rot%2?[h,w]:[w,h]}
export function footprint(placement){const spec=MODULES[placement.moduleId],[w,h]=rotatedSize(spec,placement.rot||0),out=[];for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)out.push([placement.x+xx,placement.y+yy]);return out}
function dirForRot(rot){return [[1,0],[0,1],[-1,0],[0,-1]][((rot%4)+4)%4]}
export function clearanceCells(bp,placement){
 const spec=MODULES[placement.moduleId];if(!spec?.clearance)return[];
 const hull=HULLS[bp.hullId],valid=new Set(hull.cells.map(c=>c.join(','))),own=footprint(placement),ownSet=new Set(own.map(c=>c.join(',')));
 let [dx,dy]=dirForRot(placement.rot||0);if(spec.clearance==='exhaust'){dx=-dx;dy=-dy}
 const out=[],seen=new Set();
 for(const [cx,cy] of own){if(ownSet.has(`${cx+dx},${cy+dy}`))continue;let x=cx+dx,y=cy+dy;while(valid.has(`${x},${y}`)){const k=`${x},${y}`;if(!seen.has(k)){seen.add(k);out.push([x,y])}x+=dx;y+=dy}}
 return out;
}
function occupiedCells(bp,ignoreIndex=-1){const out=new Set();bp.placements.forEach((p,i)=>{if(i!==ignoreIndex)for(const c of footprint(p))out.add(c.join(','))});return out}
function reservedClearance(bp,ignoreIndex=-1){const out=new Set();bp.placements.forEach((p,i)=>{if(i!==ignoreIndex)for(const c of clearanceCells(bp,p))out.add(c.join(','))});return out}
export function canPlace(bp,moduleId,x,y,rot=0,ignoreIndex=-1){
 const hull=HULLS[bp.hullId],valid=new Set(hull.cells.map(c=>c.join(','))),occupied=occupiedCells(bp,ignoreIndex),reserved=reservedClearance(bp,ignoreIndex),test={moduleId,x,y,rot};
 const fp=footprint(test);if(!fp.every(c=>valid.has(c.join(','))&&!occupied.has(c.join(','))&&!reserved.has(c.join(','))))return false;
 return clearanceCells(bp,test).every(c=>!occupied.has(c.join(',')));
}
export function placeModule(bp,moduleId,x,y,rot=0){if(!MODULES[moduleId]||!canPlace(bp,moduleId,x,y,rot))return false;bp.placements.push({moduleId,x,y,rot:rot%4});return true}
export function removeAt(bp,x,y){const i=bp.placements.findIndex(p=>footprint(p).some(c=>c[0]===x&&c[1]===y));if(i<0)return false;bp.placements.splice(i,1);return true}
function cellCentre(hull,p){const cells=footprint(p),cx=cells.reduce((a,c)=>a+c[0]+.5,0)/cells.length,cy=cells.reduce((a,c)=>a+c[1]+.5,0)/cells.length;return[(cx-hull.width/2)*CELL_METRES,(cy-hull.height/2)*CELL_METRES]}
function directionRadians(rot){return(rot%4)*Math.PI/2}

export function blueprintToShip(bp,team='A'){
 const hull=HULLS[bp.hullId],modules=[createSimModule('hull',0,0,{id:'keel',mass:hull.frameMass,hp:hull.frameHp})];
 bp.placements.forEach((p,i)=>{const spec=MODULES[p.moduleId],[x,y]=cellCentre(hull,p),dir=directionRadians(p.rot||0),opts={...spec,moduleId:p.moduleId,id:`${p.moduleId}-${i+1}`,gridCells:footprint(p).map(c=>[...c])};delete opts.name;delete opts.type;delete opts.size;delete opts.directional;delete opts.colour;delete opts.clearance;if(spec.type==='engine')opts.dir=dir;if(['gun','laser','missile','fighterBay'].includes(spec.type))opts.mountDir=dir;modules.push(createSimModule(spec.type,x,y,opts))});
 return shipFromModules(bp.name,team,modules,{length:hull.width*CELL_METRES,width:hull.height*CELL_METRES,ai:bp.ai||hull.ai,targetPriority:bp.targetPriority||DEFAULT_TARGET_PRIORITY,grid:{cellMetres:CELL_METRES,width:hull.width,height:hull.height,validCells:hull.cells.map(c=>[...c])},shipClass:hull.shipClass,hullId:hull.id})
}
export function designStats(bp){const hull=HULLS[bp.hullId];let mass=hull.frameMass,power=0,maxPowerUse=0,thrust=0,weapons=0,fighters=0;for(const p of bp.placements){const m=MODULES[p.moduleId];mass+=m.mass||0;if(m.power)power+=m.power;if(m.powerUse)maxPowerUse+=m.powerUse;if(m.force)thrust+=m.force;if(['gun','laser','missile'].includes(m.type))weapons++;if(m.type==='fighterBay')fighters+=m.fighters||0}return{mass,power,maxPowerUse,thrust,weapons,fighters,cellsUsed:bp.placements.reduce((a,p)=>a+footprint(p).length,0),cellsTotal:hull.cells.length}}

function tryPlace(bp,id,x,y,r=0){return placeModule(bp,id,x,y,r)}
function mirroredY(h,p){const spec=MODULES[p.id],[,rh]=rotatedSize(spec,p.r||0);return h.height-p.y-rh}
function pair(bp,id,x,y,r=0){const h=HULLS[bp.hullId],my=mirroredY(h,{id,y,r});const a=tryPlace(bp,id,x,y,r);if(my===y)return a;const b=tryPlace(bp,id,x,my,r);return a||b}
function scanPlace(bp,id,rot=0,limit=1,edge='any'){
 const h=HULLS[bp.hullId],spec=MODULES[id],[rw,rh]=rotatedSize(spec,rot);let n=0;
 const xs=[...Array(h.width-rw+1).keys()];if(edge==='front')xs.reverse();
 for(const x of xs)for(let y=0;y<=h.height-rh;y++)if(canPlace(bp,id,x,y,rot)){placeModule(bp,id,x,y,rot);if(++n>=limit)return n}
 return n;
}
function fillArmour(bp,id='armor_1'){
 const h=HULLS[bp.hullId];for(let x=0;x<h.width;x++)for(let y=0;y<h.height;y++)if(canPlace(bp,id,x,y,0))placeModule(bp,id,x,y,0);
}

export function presetForHull(hullId){
 const h=HULLS[hullId],b=emptyBlueprint(hullId,`${h.name.replace(' frame','')} preset`,h.ai),n=h.cellCount;
 // Power, command and protection scale upward. Larger modules deliberately become
 // more cell/mass efficient, so capital ships have a reason to use capital machinery.
 if(n<12){scanPlace(b,'bridge_1',0,1);scanPlace(b,'reactor_1',0,1);scanPlace(b,'shield_1',0,1);scanPlace(b,'engine_1',0,1,'front');scanPlace(b,'gun_1',0,1,'front');scanPlace(b,'armor_1',0,2)}
 else if(n<45){scanPlace(b,'bridge_1',0,1);scanPlace(b,'reactor_1',0,2);scanPlace(b,'shield_1',0,2);scanPlace(b,'engine_2',0,2);scanPlace(b,'gun_2',0,2,'front');scanPlace(b,'laser_1',0,2,'front');scanPlace(b,'thruster_1',1,2);fillArmour(b,'armor_1')}
 else if(n<130){scanPlace(b,'bridge_2',0,1);scanPlace(b,'reactor_2',0,1);scanPlace(b,'shield_2',0,1);scanPlace(b,'engine_3',0,2);scanPlace(b,'gun_2',0,4,'front');scanPlace(b,'missile_2',0,2,'front');scanPlace(b,'laser_2',0,2,'front');scanPlace(b,'thruster_2',1,2);scanPlace(b,'radiator_2',0,2);fillArmour(b,'armor_1')}
 else if(h.shipClass==='Carrier'){
   scanPlace(b,'bridge_2',0,1);scanPlace(b,'reactor_3',0,2);scanPlace(b,'shield_3',0,2);scanPlace(b,'engine_4',0,2);scanPlace(b,n>450?'fighter_bay_3':'fighter_bay_2',0,n>450?4:3,'front');scanPlace(b,'laser_2',0,4,'front');scanPlace(b,'gun_2',0,4,'front');scanPlace(b,'missile_2',0,2,'front');scanPlace(b,'thruster_2',1,4);scanPlace(b,'radiator_3',0,3);fillArmour(b,'armor_2')
 }else if(n<320){scanPlace(b,'bridge_2',0,1);scanPlace(b,'reactor_3',0,1);scanPlace(b,'shield_3',0,1);scanPlace(b,'engine_3',0,3);scanPlace(b,'gun_3',0,4,'front');scanPlace(b,'missile_3',0,2,'front');scanPlace(b,'laser_2',0,3,'front');scanPlace(b,'thruster_2',1,4);scanPlace(b,'radiator_3',0,2);fillArmour(b,'armor_2')}
 else{scanPlace(b,'bridge_2',0,2);scanPlace(b,'reactor_3',0,3);scanPlace(b,'shield_3',0,3);scanPlace(b,'engine_4',0,4);scanPlace(b,'gun_3',0,8,'front');scanPlace(b,'missile_3',0,4,'front');scanPlace(b,'laser_3',0,4,'front');scanPlace(b,'thruster_2',1,6);scanPlace(b,'radiator_3',0,4);fillArmour(b,'armor_3')}
 return b;
}

export const PREMADE_SHIPS=Object.fromEntries(Object.keys(HULLS).map(id=>[id,presetForHull(id)]));
export function presetBroadside(){const b=cloneBlueprint(PREMADE_SHIPS.frigate_line);b.name='Resolute-class broadside frigate';b.ai='broadside';return b}
export function presetPursuit(){const b=cloneBlueprint(PREMADE_SHIPS.frigate_sparrow);b.name='Vigilant-class starter frigate';b.ai='pursuit';return b}
