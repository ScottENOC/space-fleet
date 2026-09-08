import {Battle} from './sim.js';

export const FORMATIONS={
  loose:{id:'loose',name:'Loose screen',spacing:620,tolerance:230},
  tight:{id:'tight',name:'Tight formation',spacing:260,tolerance:110},
  broadside:{id:'broadside',name:'Prepare broadside',spacing:430,tolerance:150},
  ramming:{id:'ramming',name:'Ramming wedge',spacing:360,tolerance:130}
};
export const FLEET_DOCTRINES={
  fleetBalanced:{id:'fleetBalanced',name:'Fleet balanced',formation:'loose',shipDoctrine:'balanced'},
  fleetCodeRed:{id:'fleetCodeRed',name:'Fleet Code Red',formation:'tight',shipDoctrine:'codeRed'},
  broadsideLine:{id:'broadsideLine',name:'Line for broadside',formation:'broadside',shipDoctrine:'balanced'},
  rammingAttack:{id:'rammingAttack',name:'Ramming attack',formation:'ramming',shipDoctrine:'balanced'}
};

const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerpAngle=(a,b,t)=>wrap(a+wrap(b-a)*t);
const shipSize=s=>s.grid?.validCells?.length||Math.max(1,(s.length||1)*(s.width||1)/9);
const health=s=>{const ms=s.modules.filter(m=>(m.maxHp||m.hp)>0),max=ms.reduce((n,m)=>n+(m.maxHp||m.hp||0),0)||1;return ms.reduce((n,m)=>n+Math.max(0,m.hp||0),0)/max;};
const thrust=s=>s.modules.filter(m=>m.type==='engine'&&m.hp>0&&!m.disabled).reduce((n,m)=>n+(m.force||0),0);
const accel=s=>thrust(s)/Math.max(1,s.mass||1);
const hasRam=s=>s.modules.some(m=>m.ram&&m.hp>0&&!m.disabled);
function teamShips(b,team){return b.ships.filter(s=>s.team===team&&!s.dead)}
function pickFlagship(b,team){const ships=teamShips(b,team);if(!ships.length)return null;const largest=Math.max(...ships.map(shipSize)),candidates=ships.filter(s=>shipSize(s)===largest);return candidates[Math.floor((b.rng?.next?.()??Math.random())*candidates.length)]||candidates[0];}
function ensureFleetState(b){
  b.fleetState??={};
  for(const team of ['P','E']){
    const ships=teamShips(b,team);if(!ships.length)continue;
    let st=b.fleetState[team];if(!st)st=b.fleetState[team]={formation:'loose',fleetDoctrineId:'fleetBalanced',flagshipUid:null,admiralTransferAt:0};
    let flag=ships.find(s=>s.uid===st.flagshipUid);
    if(!flag){if(st.flagshipUid&&b.t<(st.admiralTransferAt||0))continue;flag=pickFlagship(b,team);if(flag){st.flagshipUid=flag.uid;st.admiralTransferAt=0;flag.isFlagship=true;b.log(`${team==='P'?'Player':'Enemy'} Admiral aboard ${flag.name}.`);}}
    for(const s of ships)s.isFlagship=s.uid===st.flagshipUid;
  }
}
export function setFormation(b,team,id){ensureFleetState(b);const st=b.fleetState?.[team];if(!st)return null;st.formation=FORMATIONS[id]?id:'loose';return FORMATIONS[st.formation];}
export function getFleetState(b,team){ensureFleetState(b);return b.fleetState?.[team]||null}
export function registerFleetDoctrine(d){if(d?.id)FLEET_DOCTRINES[d.id]={...d};}
export function applyFleetDoctrine(b,team,id,applyShipDoctrine){ensureFleetState(b);const d=FLEET_DOCTRINES[id]||FLEET_DOCTRINES.fleetBalanced,st=b.fleetState?.[team];if(st){st.fleetDoctrineId=d.id;setFormation(b,team,d.formation);}if(applyShipDoctrine)for(const s of teamShips(b,team))applyShipDoctrine(s,d.shipDoctrine||'balanced');return d;}

function slotOffsets(b,s){
  const st=b.fleetState?.[s.team],form=FORMATIONS[st?.formation]||FORMATIONS.loose,members=teamShips(b,s.team),flag=members.find(x=>x.uid===st?.flagshipUid);if(!flag||s===flag)return{flag,x:0,y:0,form};
  const escorts=members.filter(x=>x!==flag);
  if(health(s)<.28){const i=escorts.filter(x=>health(x)<.28).sort((a,c)=>a.uid.localeCompare(c.uid)).indexOf(s);return{flag,x:-form.spacing*(1.3+i*.45),y:(i%2?1:-1)*form.spacing*.22,form};}
  if(form.id==='ramming'){const ordered=[...escorts].sort((a,c)=>(hasRam(c)?1:0)-(hasRam(a)?1:0)||shipSize(a)-shipSize(c)),i=ordered.indexOf(s),front=hasRam(s)||i===0;return{flag,x:front?form.spacing*(1+i*.35):-form.spacing*.65,y:(i%2?1:-1)*form.spacing*.42,form};}
  const healthy=escorts.filter(x=>health(x)>=.28).sort((a,c)=>{const score=x=>-shipSize(x)+accel(x)*1200;return score(c)-score(a);});
  const i=healthy.indexOf(s),side=i%2===0?-1:1,rank=Math.floor(i/2)+1;
  if(form.id==='broadside')return{flag,x:-form.spacing*.08*rank,y:side*form.spacing*rank,form};
  const outside=1+Math.max(0,(shipSize(flag)-shipSize(s))/Math.max(1,shipSize(flag)))*.35+clamp(accel(s)-accel(flag),0,.25)*.8;
  return{flag,x:-form.spacing*.25*rank,y:side*form.spacing*rank*outside,form};
}
function worldSlot(flag,x,y){const c=Math.cos(flag.angle),si=Math.sin(flag.angle);return{x:flag.x+x*c-y*si,y:flag.y+x*si+y*c};}
function discipline(s){return s.formationDiscipline||'normal'}

const baseAI=Battle.prototype.ai;
Battle.prototype.ai=function(s,e){
  ensureFleetState(this);baseAI.call(this,s,e);
  if(!e||e.dead||s.dead||s.ramOrder==='ram'||s.ramIntent)return;
  const slot=slotOffsets(this,s);if(!slot.flag)return;
  const target=worldSlot(slot.flag,slot.x,slot.y),dx=target.x-s.x,dy=target.y-s.y,d=Math.hypot(dx,dy),mode=discipline(s);
  s.formationId=slot.form.id;s.formationDistance=d;if(s.isFlagship)return;
  const tolerance=slot.form.tolerance*(mode==='strict'?.72:mode==='independent'?1.9:1);
  if(d>tolerance){
    const course=Math.atan2(dy,dx),baseWeight=clamp((d-tolerance)/(slot.form.spacing*1.6),.18,.82),weight=clamp(baseWeight*(mode==='strict'?1.28:mode==='independent'?.48:1),.08,.95);
    s.desiredAngle=lerpAngle(s.desiredAngle,course,weight);s.throttle=Math.max(s.throttle||0,clamp(d/(slot.form.spacing*(mode==='strict'?1.45:2.0)),mode==='independent'?.10:.18,mode==='strict'?1:.88));
    s.order=`${s.order||'Engage'} · reform ${slot.form.name}`;
  }else if(slot.form.id==='broadside'&&mode!=='independent')s.desiredAngle=lerpAngle(s.desiredAngle,slot.flag.angle,mode==='strict'?.42:.28);
};

const baseStep=Battle.prototype.step;
Battle.prototype.step=function(dt){
  ensureFleetState(this);const out=baseStep.call(this,dt);
  for(const team of ['P','E']){const st=this.fleetState?.[team];if(!st)continue;const flag=this.ships.find(s=>s.uid===st.flagshipUid);if(flag?.dead){flag.isFlagship=false;st.flagshipUid=null;st.admiralTransferAt=this.t+2.5;this.log(`${team==='P'?'Player':'Enemy'} flagship lost; Admiral command transfer underway.`);}}
  return out;
};
