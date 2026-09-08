import {HULLS} from './shipyard.js';

function rowsFromWidths(widths){const max=Math.max(...widths);return widths.map(w=>'.'.repeat((max-w)/2)+'#'.repeat(w)+'.'.repeat((max-w)/2))}
function diamondRows(peak,plateau=1){const up=[];for(let w=1;w<=peak;w+=2)up.push(w);return rowsFromWidths([...up,...Array(Math.max(0,plateau-1)).fill(peak),...up.slice(0,-1).reverse()])}
function cells(rows){const out=[];rows.forEach((r,y)=>[...r].forEach((c,x)=>{if(c==='#')out.push([x,y])}));return out}

const CATALOG={
 frigate_sparrow:{name:'Sparrow-class starter frigate',shipClass:'Frigate',role:'7-cell starter / scout',rows:['.#.','.#.','.#.','###','.#.'],frameMass:7,frameHp:155,ai:'pursuit'},
 frigate_dart:{name:'Dart-class frigate',shipClass:'Frigate',role:'Fast escort',rows:rowsFromWidths([1,1,3,5,5,3,1]),frameMass:18,frameHp:270,ai:'pursuit'},
 frigate_line:{name:'Lancer-class frigate',shipClass:'Frigate',role:'Heavy frigate / line escort',rows:rowsFromWidths([1,3,5,7,7,5,3]),frameMass:28,frameHp:430,ai:'broadside'},
 destroyer_rapier:{name:'Rapier-class destroyer',shipClass:'Destroyer',role:'Fast attack destroyer',rows:diamondRows(11,1),frameMass:52,frameHp:690,ai:'pursuit'},
 destroyer_guardian:{name:'Guardian-class destroyer',shipClass:'Destroyer',role:'Escort / point defence',rows:diamondRows(11,3),frameMass:66,frameHp:900,ai:'broadside'},
 destroyer_torpedo:{name:'Pike-class destroyer',shipClass:'Destroyer',role:'Missile / torpedo attack',rows:diamondRows(11,5),frameMass:79,frameHp:1120,ai:'pursuit'},
 cruiser_pathfinder:{name:'Pathfinder-class light cruiser',shipClass:'Cruiser',role:'Independent patrol cruiser',rows:diamondRows(13,5),frameMass:112,frameHp:1550,ai:'pursuit'},
 cruiser_line:{name:'Ardent-class line cruiser',shipClass:'Cruiser',role:'General-purpose line cruiser',rows:diamondRows(15,5),frameMass:145,frameHp:1920,ai:'broadside'},
 cruiser_missile:{name:'Longbow-class missile cruiser',shipClass:'Cruiser',role:'Stand-off missile cruiser',rows:diamondRows(17,5),frameMass:176,frameHp:2280,ai:'pursuit'},
 battleship_line:{name:'Sovereign-class battleship',shipClass:'Battleship',role:'Line-of-battle anchor',rows:diamondRows(19,5),frameMass:245,frameHp:3300,ai:'broadside'},
 battleship_siege:{name:'Monarch-class siege battleship',shipClass:'Battleship',role:'Heavy gun platform',rows:diamondRows(21,5),frameMass:288,frameHp:4200,ai:'broadside'},
 battleship_fast:{name:'Vanguard-class fast battleship',shipClass:'Battleship',role:'Fast capital ship',rows:diamondRows(23,5),frameMass:326,frameHp:4700,ai:'pursuit'},
 carrier_light:{name:'Harrier-class light carrier',shipClass:'Carrier',role:'Fast fighter carrier',rows:diamondRows(19,3),frameMass:220,frameHp:2800,ai:'pursuit'},
 carrier_fleet:{name:'Atlas-class fleet carrier',shipClass:'Carrier',role:'Fleet fighter carrier',rows:diamondRows(23,3),frameMass:300,frameHp:3900,ai:'broadside'},
 carrier_super:{name:'Leviathan-class heavy carrier',shipClass:'Carrier',role:'Heavy carrier / command ship',rows:diamondRows(25,5),frameMass:385,frameHp:5000,ai:'broadside'}
};

for(const [id,data] of Object.entries(CATALOG)){
 const h=HULLS[id];Object.assign(h,data,{id});h.cells=cells(h.rows);h.width=h.rows[0].length;h.height=h.rows.length;h.cellCount=h.cells.length;
}

export {CATALOG};
