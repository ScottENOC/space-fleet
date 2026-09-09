import {HULLS,emptyBlueprint,canPlace,placeModule,MODULES} from './shipyard.js';
import './craft-catalog.js';

function setStarterHull(){
  const h=HULLS.frigate_sparrow;
  h.name='Sparrow-class starter frigate';h.role='9-cell starter / scout';
  h.rows=['..#..','..#..','..#..','#####','..#..'];
  h.cells=[];h.rows.forEach((r,y)=>[...r].forEach((c,x)=>{if(c==='#')h.cells.push([x,y])}));
  h.width=5;h.height=5;h.cellCount=9;h.frameMass=9;h.frameHp=185;
}
setStarterHull();
function rotatedSize(id,rot){const [w,h]=MODULES[id].size;return rot%2?[h,w]:[w,h]}
function centreScore(h,x,y,rw,rh){return Math.abs(x+rw/2-h.width/2)+Math.abs(y+rh/2-h.height/2)}
function candidates(bp,id,rot,mode='centre'){const h=HULLS[bp.hullId],[rw,rh]=rotatedSize(id,rot),out=[];for(let y=0;y<=h.height-rh;y++)for(let x=0;x<=h.width-rw;x++)if(canPlace(bp,id,x,y,rot)){let score=centreScore(h,x,y,rw,rh);if(mode==='front')score+=y*4;if(mode==='rear')score+=(h.height-(y+rh))*4;out.push({x,y,score})}return out.sort((a,b)=>a.score-b.score)}
function placeOne(bp,id,rot=0,mode='centre'){const q=candidates(bp,id,rot,mode)[0];if(!q)return false;return placeModule(bp,id,q.x,q.y,rot)}
function placeMirrorPair(bp,id,leftRot,rightRot=leftRot,mode='centre'){const h=HULLS[bp.hullId],[rw]=rotatedSize(id,leftRot),list=candidates(bp,id,leftRot,mode);for(const q of list){const mx=h.width-q.x-rw;if(mx===q.x)continue;if(!canPlace(bp,id,mx,q.y,rightRot))continue;const n=bp.placements.length;if(placeModule(bp,id,q.x,q.y,leftRot)&&placeModule(bp,id,mx,q.y,rightRot))return true;bp.placements.splice(n)}return false}
function fillMirrorArmour(bp,id){const h=HULLS[bp.hullId],[rw]=rotatedSize(id,0);for(let y=0;y<h.height;y++)for(let x=0;x<Math.ceil(h.width/2);x++){const mx=h.width-x-rw;if(mx===x){if(canPlace(bp,id,x,y,0))placeModule(bp,id,x,y,0);continue}if(canPlace(bp,id,x,y,0)&&canPlace(bp,id,mx,y,0)){const n=bp.placements.length;if(!(placeModule(bp,id,x,y,0)&&placeModule(bp,id,mx,y,0)))bp.placements.splice(n)}}}
function starter(){const b=emptyBlueprint('frigate_sparrow','Sparrow starter','pursuit');placeModule(b,'gun_1',2,0,3);placeModule(b,'reactor_1',2,1,0);placeModule(b,'bridge_1',2,2,0);placeModule(b,'engine_1',1,3,3);placeModule(b,'shield_1',2,3,0);placeModule(b,'engine_1',3,3,3);placeModule(b,'armor_1',0,3,0);placeModule(b,'armor_1',4,3,0);placeModule(b,'armor_1',2,4,0);return b}

export function makePremade(hullId){
  if(hullId==='frigate_sparrow')return starter();
  const h=HULLS[hullId],n=h.cellCount,b=emptyBlueprint(hullId,`${h.name} preset`,h.ai),carrier=h.shipClass==='Carrier';
  const small=n<=32,medium=n<=110,large=n<=220;
  placeOne(b,small?'bridge_1':'bridge_2',0,'centre');placeOne(b,small?'reactor_1':medium?'reactor_2':'reactor_3',0,'centre');placeOne(b,small?'shield_1':medium?'shield_2':'shield_3',0,'centre');
  const engine=small?'engine_1':medium?'engine_2':large?'engine_3':'engine_4',gun=small?'gun_1':medium?'gun_2':'gun_3',missile=small?'missile_1':medium?'missile_2':'missile_3',laser=small?'laser_1':medium?'laser_1':large?'laser_2':'laser_3',armour=small?'armor_1':medium?'armor_1':large?'armor_2':'armor_3',radiator=small?'radiator_1':medium?'radiator_2':'radiator_3';
  placeMirrorPair(b,engine,3,3,'rear');if(n>70)placeMirrorPair(b,engine,3,3,'rear');
  if(h.ai==='broadside'){placeMirrorPair(b,gun,2,0,'centre');if(n>120)placeMirrorPair(b,gun,2,0,'front')}else{placeMirrorPair(b,gun,3,3,'front');if(n>120)placeMirrorPair(b,gun,3,3,'front')}
  placeMirrorPair(b,missile,3,3,'front');placeMirrorPair(b,laser,3,3,'front');if(n>55)placeMirrorPair(b,radiator,0,0,'rear');
  if(carrier){
    const hangar=n>340?'hangar_3':n>250?'hangar_2':'hangar_1';
    const bay=n>340?'launch_bay_3':n>250?'launch_bay_2':'launch_bay_1';
    placeMirrorPair(b,hangar,0,0,'centre');
    placeMirrorPair(b,bay,3,3,'rear');
    if(n>340){placeMirrorPair(b,hangar,0,0,'centre');placeMirrorPair(b,bay,3,3,'rear')}
  }
  fillMirrorArmour(b,armour);return b;
}
