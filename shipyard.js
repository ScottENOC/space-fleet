import {shipFromModules} from './sim.js';

export const CELL_METRES = 3;

const SIM_DEFAULTS={
  hull:{mass:12,hp:260},armor:{mass:18,hp:420},reactor:{mass:22,hp:180,power:24e6},
  engine:{mass:12,hp:150,force:1.8e6,powerUse:5e6},gun:{mass:8,hp:120,powerUse:0.2e6,ammo:100,projectileMass:18,muzzle:1300,damage:95,cooldown:1.25},
  laser:{mass:7,hp:105,powerUse:4e6,damage:60,cooldown:0.7,range:4800},missile:{mass:10,hp:110,powerUse:0.4e6,ammo:12,damage:220,cooldown:4},
  shield:{mass:14,hp:130,powerUse:6e6,capacity:500,recharge:45},bridge:{mass:7,hp:140},radiator:{mass:8,hp:120}
};
function createSimModule(type,x,y,opts={}){return {type,x,y,...SIM_DEFAULTS[type],...opts,id:opts.id||`${type}-${Math.random().toString(36).slice(2,8)}`,cooldownLeft:0,active:false,disabled:false}}

function cellsFromRows(rows){
  const cells=[];
  rows.forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='#')cells.push([x,y])}));
  return cells;
}

export const HULLS={
  escort:{
    id:'escort',name:'Needle-class frigate frame',role:'Fast escort',
    rows:['....##....','...####...','..######..','.########.','##########','##########','.########.','..######..','...####...'],
    frameMass:62,frameHp:850,ai:'pursuit'
  },
  line:{
    id:'line',name:'Bastion-class frigate frame',role:'Line / broadside frigate',
    rows:['...######...','..########..','.##########.','############','############','############','############','.##########.','..########..','...######...'],
    frameMass:105,frameHp:1350,ai:'broadside'
  },
  raider:{
    id:'raider',name:'Corsair-class frigate frame',role:'Asymmetric raider',
    rows:['.....##....','....####...','..########.','###########','###########','..########.','....####...','.....##....'],
    frameMass:72,frameHp:950,ai:'pursuit'
  }
};
for(const h of Object.values(HULLS)){h.cells=cellsFromRows(h.rows);h.width=h.rows[0].length;h.height=h.rows.length;}

export const MODULES={
  bridge:{name:'Bridge',type:'bridge',size:[1,1],mass:7,hp:140,colour:'#d9e1ec'},
  reactor:{name:'Reactor',type:'reactor',size:[2,2],mass:22,hp:180,power:34e6,colour:'#f4cf63'},
  engine:{name:'Main engine',type:'engine',size:[2,1],mass:12,hp:150,force:1.8e6,powerUse:5e6,directional:true,colour:'#56b6ff'},
  thruster:{name:'Manoeuvre thruster',type:'engine',size:[1,1],mass:6,hp:95,force:0.72e6,powerUse:2.2e6,directional:true,colour:'#78c9ff'},
  gun:{name:'Naval gun',type:'gun',size:[2,1],mass:8,hp:120,powerUse:0.2e6,ammo:100,projectileMass:18,muzzle:1300,damage:95,cooldown:1.25,directional:true,colour:'#dedede'},
  laser:{name:'Laser',type:'laser',size:[1,1],mass:7,hp:105,powerUse:4e6,damage:60,cooldown:0.7,range:4800,directional:true,colour:'#ff7c7c'},
  shield:{name:'Shield generator',type:'shield',size:[2,2],mass:14,hp:130,powerUse:6e6,capacity:500,recharge:45,colour:'#79e0ff'},
  armor:{name:'Armour block',type:'armor',size:[2,1],mass:18,hp:420,absorb:0.68,colour:'#777'},
  radiator:{name:'Radiator',type:'radiator',size:[2,1],mass:8,hp:120,colour:'#a895c7'},
  missile:{name:'Missile rack',type:'missile',size:[2,1],mass:10,hp:110,powerUse:0.4e6,ammo:12,damage:220,cooldown:4,directional:true,colour:'#d88962'}
};

export function emptyBlueprint(hullId='line',name='Untitled frigate',ai=null){return {name,hullId,ai:ai||HULLS[hullId].ai,placements:[]};}
export function cloneBlueprint(bp){return JSON.parse(JSON.stringify(bp));}
function rotatedSize(spec,rot){const [w,h]=spec.size;return rot%2?[h,w]:[w,h]}
export function footprint(placement){const spec=MODULES[placement.moduleId];const [w,h]=rotatedSize(spec,placement.rot||0);const out=[];for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)out.push([placement.x+xx,placement.y+yy]);return out;}
export function canPlace(bp,moduleId,x,y,rot=0,ignoreIndex=-1){const hull=HULLS[bp.hullId],valid=new Set(hull.cells.map(c=>c.join(','))),occupied=new Set();bp.placements.forEach((p,i)=>{if(i!==ignoreIndex)for(const c of footprint(p))occupied.add(c.join(','))});const test={moduleId,x,y,rot};return footprint(test).every(c=>valid.has(c.join(','))&&!occupied.has(c.join(',')));}
export function placeModule(bp,moduleId,x,y,rot=0){if(!canPlace(bp,moduleId,x,y,rot))return false;bp.placements.push({moduleId,x,y,rot:rot%4});return true}
export function removeAt(bp,x,y){const i=bp.placements.findIndex(p=>footprint(p).some(c=>c[0]===x&&c[1]===y));if(i<0)return false;bp.placements.splice(i,1);return true}

function cellCentre(hull,p){const cells=footprint(p);const cx=cells.reduce((a,c)=>a+c[0]+0.5,0)/cells.length;const cy=cells.reduce((a,c)=>a+c[1]+0.5,0)/cells.length;return [(cx-hull.width/2)*CELL_METRES,(cy-hull.height/2)*CELL_METRES];}
function directionRadians(rot){return (rot%4)*Math.PI/2}
export function blueprintToShip(bp,team='A'){
  const hull=HULLS[bp.hullId];
  const modules=[createSimModule('hull',0,0,{id:'keel',mass:hull.frameMass,hp:hull.frameHp})];
  bp.placements.forEach((p,i)=>{
    const spec=MODULES[p.moduleId],[x,y]=cellCentre(hull,p),dir=directionRadians(p.rot||0),opts={...spec,id:`${p.moduleId}-${i+1}`};
    delete opts.name;delete opts.type;delete opts.size;delete opts.directional;delete opts.colour;
    if(spec.type==='engine')opts.dir=dir;
    if(['gun','laser','missile'].includes(spec.type))opts.mountDir=dir;
    if(spec.type==='armor')opts.arc='all';
    modules.push(createSimModule(spec.type,x,y,opts));
  });
  return shipFromModules(bp.name,team,modules,{length:hull.width*CELL_METRES,width:hull.height*CELL_METRES,ai:bp.ai||hull.ai});
}
export function designStats(bp){const hull=HULLS[bp.hullId];let mass=hull.frameMass,power=0,maxPowerUse=0,thrust=0,weapons=0;for(const p of bp.placements){const m=MODULES[p.moduleId];mass+=m.mass||0;if(m.power)power+=m.power;if(m.powerUse)maxPowerUse+=m.powerUse;if(m.force)thrust+=m.force;if(['gun','laser','missile'].includes(m.type))weapons++;}return {mass,power,maxPowerUse,thrust,weapons,cellsUsed:bp.placements.reduce((a,p)=>a+footprint(p).length,0),cellsTotal:hull.cells.length};}

export function presetBroadside(){
  const b=emptyBlueprint('line','Resolute-class broadside frigate','broadside'),add=(id,x,y,r=0)=>placeModule(b,id,x,y,r);
  add('reactor',5,4);add('bridge',8,4);add('shield',3,4);add('engine',0,3,0);add('engine',0,5,0);add('thruster',9,2,2);add('thruster',9,7,2);
  add('armor',3,2,0);add('armor',5,2,0);add('armor',7,2,0);add('armor',3,7,0);add('armor',5,7,0);add('armor',7,7,0);
  add('gun',3,0,3);add('gun',5,0,3);add('gun',7,0,3);add('gun',3,8,1);add('gun',5,8,1);add('gun',7,8,1);return b;
}
export function presetPursuit(){
  const b=emptyBlueprint('escort','Vigilant-class pursuit frigate','pursuit'),add=(id,x,y,r=0)=>placeModule(b,id,x,y,r);
  add('reactor',4,4);add('bridge',6,4);add('shield',6,2);add('armor',7,4,1);add('engine',1,3,0);add('engine',1,5,0);add('thruster',4,1,1);add('thruster',5,7,3);add('thruster',7,3,2);add('thruster',7,5,2);add('gun',5,1,0);add('gun',5,6,0);add('laser',8,4,0);return b;
}
