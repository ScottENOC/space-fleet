import {HULLS,MODULES,emptyBlueprint,placeModule} from './shipyard.js';

function rowsFromWidths(widths){const max=Math.max(...widths);return widths.map(w=>'.'.repeat((max-w)/2)+'#'.repeat(w)+'.'.repeat((max-w)/2))}
function cellsFromRows(rows){const out=[];rows.forEach((r,y)=>[...r].forEach((c,x)=>{if(c==='#')out.push([x,y])}));return out}
function tradeHull(id,name,role,widths,frameMass,frameHp,price){
 const rows=rowsFromWidths(widths),h={id,name,shipClass:'Trading Hulk',role,rows,frameMass,frameHp,ai:'pursuit',civilianHull:true,structuralDamageMultiplier:1.42,collisionDamageMultiplier:1.28,basePrice:price};
 h.cells=cellsFromRows(rows);h.width=rows[0].length;h.height=rows.length;h.cellCount=h.cells.length;return h;
}

// Large, broad, cheap civilian frames. Cell counts sit around the largest destroyer,
// cruiser and battleship bands but their frame structure is intentionally far weaker.
HULLS.trader_mule ??=tradeHull('trader_mule','Mule-class trading hulk','Regional bulk freighter',[5,7,9,11,11,11,11,9,7,5],58,470,900);
HULLS.trader_caravan ??=tradeHull('trader_caravan','Caravan-class trading hulk','Inter-system merchantman',[7,9,11,13,15,15,15,15,15,13,11,9,7],92,720,1800);
HULLS.trader_leviathan ??=tradeHull('trader_leviathan','Galleon-class trading hulk','Heavy bulk carrier',[9,11,13,15,17,19,19,19,19,19,19,17,15,13,11,9],138,1060,3200);

MODULES.cargo_1 ??={name:'Cargo hold · 12 units',type:'cargo',size:[1,1],mass:2,hp:48,cargoCapacity:12,colour:'#b88c5a'};
MODULES.cargo_2 ??={name:'Bulk cargo hold · 60 units',type:'cargo',size:[2,2],mass:7,hp:145,cargoCapacity:60,colour:'#b47f48'};
MODULES.cargo_3 ??={name:'Heavy cargo hold · 150 units',type:'cargo',size:[3,3],mass:13,hp:270,cargoCapacity:150,colour:'#a97038'};

function firstFit(bp,moduleId,rot=0){const h=HULLS[bp.hullId];for(let y=0;y<h.height;y++)for(let x=0;x<h.width;x++)if(placeModule(bp,moduleId,x,y,rot))return true;return false}
export function makeTradingPremade(hullId='trader_mule'){
 const h=HULLS[hullId];if(!h?.civilianHull)throw new Error('Trading Hulk hull required');
 const bp=emptyBlueprint(hullId,h.name,'pursuit');
 // Civilian baseline: command, reactor, shields, distributed engines, two defensive guns,
 // then pack the remaining volume with cargo. Clearance rules still apply.
 firstFit(bp,'bridge_2');firstFit(bp,h.cellCount>200?'reactor_3':'reactor_2');
 if(h.cellCount>120)firstFit(bp,'shield_2');
 firstFit(bp,h.cellCount>180?'engine_4':'engine_3',1);firstFit(bp,h.cellCount>180?'engine_4':'engine_3',3);
 firstFit(bp,'gun_1',0);firstFit(bp,'gun_1',2);
 const cargo=h.cellCount>220?'cargo_3':h.cellCount>120?'cargo_2':'cargo_1';
 while(firstFit(bp,cargo)){}
 while(firstFit(bp,'cargo_1')){}
 return bp;
}

export function cargoCapacityFromBlueprint(bp){return (bp.placements||[]).reduce((n,p)=>n+(MODULES[p.moduleId]?.cargoCapacity||0),0)}
export function armamentClass(bp){
 let guns=0,heavyGuns=0,lasers=0,missiles=0,fighters=0;
 for(const p of bp.placements||[]){const m=MODULES[p.moduleId];if(!m)continue;if(m.type==='gun'){guns++;if((m.damage||0)>100)heavyGuns++}else if(m.type==='laser')lasers++;else if(m.type==='missile')missiles++;else if(m.type==='fighterBay')fighters+=m.fighters||0;}
 const h=HULLS[bp.hullId];
 if(!h?.civilianHull)return{classification:'military',guns,lasers,missiles,fighters,reason:'purpose-built naval hull'};
 if(lasers||missiles||fighters||heavyGuns||guns>4)return{classification:'military',guns,lasers,missiles,fighters,reason:lasers||missiles?'restricted weapons fit':'armament exceeds civilian defensive allowance'};
 if(guns>2)return{classification:'armed merchant',guns,lasers,missiles,fighters,reason:'heavy defensive gun fit'};
 return{classification:'civilian merchant',guns,lasers,missiles,fighters,reason:'ordinary defensive armament'};
}
