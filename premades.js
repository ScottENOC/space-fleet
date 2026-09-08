import {HULLS,emptyBlueprint,canPlace,placeModule,removeAt,MODULES} from './shipyard.js';
import './hull-catalog.js';

function rotatedSize(id,rot){const [w,h]=MODULES[id].size;return rot%2?[h,w]:[w,h]}
function centreScore(h,x,y,rw,rh){const cx=x+rw/2,cy=y+rh/2;return Math.abs(cx-h.width/2)+Math.abs(cy-h.height/2)}
function placeCentral(bp,id,rot=0,count=1){const h=HULLS[bp.hullId],[rw,rh]=rotatedSize(id,rot),c=[];for(let x=0;x<=h.width-rw;x++)for(let y=0;y<=h.height-rh;y++)if(canPlace(bp,id,x,y,rot))c.push({x,y,s:centreScore(h,x,y,rw,rh)});c.sort((a,b)=>a.s-b.s);let n=0;for(const q of c){if(canPlace(bp,id,q.x,q.y,rot)){placeModule(bp,id,q.x,q.y,rot);if(++n>=count)break}}return n}
function placePairs(bp,id,rotTop=0,rotBottom=rotTop,pairs=1,edge='any'){
 const h=HULLS[bp.hullId],[rw,rh]=rotatedSize(id,rotTop),[rw2,rh2]=rotatedSize(id,rotBottom);let xs=[...Array(Math.max(0,h.width-rw+1)).keys()];if(edge==='front')xs.reverse();let made=0;
 for(const x of xs){for(let y=0;y<=Math.floor((h.height-rh)/2);y++){
   const my=h.height-y-rh2;if(my===y)continue;if(!canPlace(bp,id,x,y,rotTop)||!canPlace(bp,id,x,my,rotBottom))continue;
   const before=bp.placements.length;placeModule(bp,id,x,y,rotTop);if(!placeModule(bp,id,x,my,rotBottom)){bp.placements.splice(before);continue}made++;if(made>=pairs)return made;
 }}return made;
}
function fillSymmetricArmour(bp,id){const h=HULLS[bp.hullId],[rw,rh]=rotatedSize(id,0);for(let x=0;x<=h.width-rw;x++)for(let y=0;y<=Math.floor((h.height-rh)/2);y++){const my=h.height-y-rh;if(my===y){if(canPlace(bp,id,x,y,0))placeModule(bp,id,x,y,0);continue}if(canPlace(bp,id,x,y,0)&&canPlace(bp,id,x,my,0)){const before=bp.placements.length;placeModule(bp,id,x,y,0);if(!placeModule(bp,id,x,my,0))bp.placements.splice(before)}}}
function sparrow(){const b=emptyBlueprint('frigate_sparrow','Sparrow starter','pursuit');placeModule(b,'reactor_1',1,1,0);placeModule(b,'bridge_1',1,2,0);placeModule(b,'engine_1',0,3,0);placeModule(b,'gun_1',2,3,0);placeModule(b,'shield_1',1,3,0);placeModule(b,'armor_1',1,0,0);placeModule(b,'armor_1',1,4,0);return b}

export function makePremade(hullId){
 if(hullId==='frigate_sparrow')return sparrow();
 const h=HULLS[hullId],n=h.cellCount,b=emptyBlueprint(hullId,`${h.name} preset`,h.ai),carrier=h.shipClass==='Carrier';
 if(n<=32){
   placeCentral(b,'bridge_1');placeCentral(b,'reactor_1');placeCentral(b,'shield_1');placePairs(b,'engine_1',0,0,1,'any');placePairs(b,'gun_1',3,1,1,'front');placePairs(b,'laser_1',3,1,1,'front');placePairs(b,'thruster_1',1,3,1,'any');fillSymmetricArmour(b,'armor_1');return b;
 }
 if(n<=110){
   placeCentral(b,'bridge_1');placeCentral(b,'reactor_2');placeCentral(b,'shield_2');placePairs(b,'engine_2',0,0,2,'any');placePairs(b,'gun_2',3,1,2,'front');placePairs(b,'missile_2',0,0,1,'front');placePairs(b,'laser_1',3,1,1,'front');placePairs(b,'thruster_1',1,3,2,'any');placePairs(b,'radiator_2',0,0,1,'any');fillSymmetricArmour(b,'armor_1');return b;
 }
 if(carrier){
   placeCentral(b,'bridge_2');placeCentral(b,'reactor_3',0,n>350?2:1);placeCentral(b,'shield_3',0,n>300?2:1);placePairs(b,n>350?'engine_4':'engine_3',0,0,2,'any');placePairs(b,n>350?'fighter_bay_3':'fighter_bay_2',3,1,n>350?2:1,'front');placePairs(b,'laser_2',3,1,2,'front');placePairs(b,'gun_2',3,1,2,'front');placePairs(b,'missile_2',0,0,1,'front');placePairs(b,'thruster_2',1,3,2,'any');placePairs(b,'radiator_3',0,0,2,'any');fillSymmetricArmour(b,'armor_2');return b;
 }
 if(n<=220){
   placeCentral(b,'bridge_2');placeCentral(b,'reactor_3');placeCentral(b,'shield_3');placePairs(b,'engine_3',0,0,2,'any');placePairs(b,'gun_3',3,1,2,'front');placePairs(b,'missile_2',0,0,2,'front');placePairs(b,'laser_2',3,1,2,'front');placePairs(b,'thruster_2',1,3,2,'any');placePairs(b,'radiator_3',0,0,1,'any');fillSymmetricArmour(b,'armor_2');return b;
 }
 placeCentral(b,'bridge_2');placeCentral(b,'reactor_3',0,n>330?3:2);placeCentral(b,'shield_3',0,n>330?3:2);placePairs(b,'engine_4',0,0,n>330?3:2,'any');placePairs(b,'gun_3',3,1,n>330?4:3,'front');placePairs(b,'missile_3',0,0,n>330?2:1,'front');placePairs(b,'laser_3',3,1,n>330?2:1,'front');placePairs(b,'thruster_2',1,3,3,'any');placePairs(b,'radiator_3',0,0,2,'any');fillSymmetricArmour(b,'armor_3');return b;
}

export const PREMADES=Object.fromEntries(Object.keys(HULLS).map(id=>[id,makePremade(id)]));
