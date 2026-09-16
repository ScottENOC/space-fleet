import {registerBattleHook} from './battle-hooks.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const METEOR_TEAM='H';

function scenario(b){return b?.nonCombatScenario==='meteorEscort'}
function convoy(b){return (b.ships||[]).filter(s=>s.civilianEscort&&!s.dead)}
function escorts(b){return (b.ships||[]).filter(s=>s.team==='P'&&!s.civilianEscort&&!s.dead)}
function sensors(b){return (b.ships||[]).filter(s=>s.team==='P'&&!s.dead)}
function sensorStrength(s){
 let v=(s.modules||[]).some(m=>m.type==='bridge'&&m.hp>0&&!m.disabled) ? .7 : 0;
 for(const m of s.modules||[])if(m.type==='sensor'&&m.hp>0&&!m.disabled)v+=(m.sensitivity||1)*(m.hp/Math.max(1,m.maxHp||m.hp));
 return v*clamp(s.sensorPowerFraction??1,.2,1);
}
function ensure(b){
 if(!scenario(b))return null;
 if(b.hazardState)return b.hazardState;
 const ships=convoy(b),avg=ships.length?ships.reduce((n,s)=>n+s.x,0)/ships.length:-1300;
 b.hazardState={kind:'meteorSwarm',startedAt:b.t,initialConvoy:ships.length,startX:avg,duration:78,spawnUntil:64,spawnClock:0,spawned:0,detected:0,destroyed:0,impacts:0,finished:false,lastDetectionLog:-99,sensorRating:0};
 b.ordnance??=[];b.hazardMeteors??=[];
 b.log(`Hazard transit: ${ships.length} merchant vessel${ships.length===1?'':'s'} entering a charted meteor swarm. Fleet sensors are sharing tracks over the convoy datalink.`);
 return b.hazardState;
}
function convoyCentre(b){const c=convoy(b);if(!c.length)return{x:0,y:0};return{x:c.reduce((n,s)=>n+s.x,0)/c.length,y:c.reduce((n,s)=>n+s.y,0)/c.length}}
function meteorSpec(b){
 const c=convoyCentre(b),r=b.rng.range(1.1,4.2),speed=b.rng.range(470,880),side=b.rng.range(-1,1),mass=900*r*r*r;
 return{kind:'meteor',neutralHazard:true,team:METEOR_TEAM,x:c.x+b.rng.range(4300,6100),y:c.y+b.rng.range(-1250,1250),vx:-speed,vy:b.rng.range(-85,85)+side*25,r,hp:Math.round(16+r*r*5),maxHp:Math.round(16+r*r*5),mass,damage:Math.round(45+r*r*24+speed*.08),penetration:.72+r*.12,ttl:18,detectedBy:{P:false},detectionQuality:0};
}
function spawn(b,dt){
 const h=ensure(b);if(!h||h.finished||b.t-h.startedAt>h.spawnUntil)return;
 h.spawnClock-=dt;
 while(h.spawnClock<=0){
  const burst=b.rng.next()<.14?2:1;
  for(let i=0;i<burst;i++){b.hazardMeteors.push(meteorSpec(b));h.spawned++}
  h.spawnClock+=b.rng.range(.72,1.45);
 }
}
function detect(b,dt){
 const h=ensure(b);if(!h)return;
 const obs=sensors(b).map(s=>({s,strength:sensorStrength(s)})).filter(x=>x.strength>0),drones=(b.ordnance||[]).filter(o=>o.kind==='sensorDrone'&&o.team==='P'&&o.hp>0);
 h.sensorRating=obs.reduce((n,x)=>n+x.strength,0)+drones.reduce((n,d)=>n+(d.sensorStrength||1.6),0);
 const acquired=[];
 for(const m of b.hazardMeteors||[]){
  if(m.hp<=0)continue;let best=0;
  for(const {s,strength} of obs){const range=1900+strength*1050,q=1-dist(s,m)/Math.max(1,range);if(q>0)best=Math.max(best,q*(.45+strength*.16))}
  for(const d of drones){const range=3300+(d.sensorStrength||1.6)*750,q=1-dist(d,m)/range;if(q>0)best=Math.max(best,q*.9)}
  m.detectionQuality=clamp((m.detectionQuality||0)+best*dt*.75,0,1);
  if(m.detectionQuality>=.13){m.detectedBy={P:true};acquired.push(m);h.detected++;if(b.t-h.lastDetectionLog>5){b.log('Sensor net: incoming meteor tracks resolved. Convoy evasive manoeuvres and point defence authorised.');h.lastDetectionLog=b.t}}
 }
 if(acquired.length){const found=new Set(acquired);b.hazardMeteors=b.hazardMeteors.filter(m=>!found.has(m));b.ordnance.push(...acquired)}
}
function closestApproach(s,m){
 const rx=m.x-s.x,ry=m.y-s.y,rvx=m.vx-(s.vx||0),rvy=m.vy-(s.vy||0),rv2=rvx*rvx+rvy*rvy;if(rv2<1e-6)return{time:Infinity,miss:Infinity,side:0};
 const t=-((rx*rvx)+(ry*rvy))/rv2;if(t<0)return{time:t,miss:Math.hypot(rx,ry),side:0};
 const x=rx+rvx*t,y=ry+rvy*t;return{time:t,miss:Math.hypot(x,y),side:Math.sign(rx*rvy-ry*rvx)||1};
}
function steerShips({battle:b,ship:s}){
 if(!scenario(b)||s.dead||s.team!=='P')return;
 const h=ensure(b);if(!h||h.finished)return;
 s.desiredAngle=0;s.throttle=s.civilianEscort ? .58 : .66;
 const tracked=(b.ordnance||[]).filter(o=>o.kind==='meteor'&&o.hp>0&&o.detectedBy?.P);
 if(s.civilianEscort){
  let threat=null;
  for(const m of tracked){const a=closestApproach(s,m);if(a.time>0&&a.time<6.5&&a.miss<(s.radius||15)+95&&(!threat||a.time<threat.a.time))threat={m,a}}
  if(threat){s.desiredAngle=clamp(-threat.a.side*.34,-.38,.38);s.throttle=.76;s.order='Evasive turn on shared meteor track';return}
  s.order='Maintain convoy transit vector';
 }else{
  const screen=escorts(b),index=screen.indexOf(s),lane=(index-(Math.max(1,screen.length)-1)/2)*230,targetY=convoyCentre(b).y+lane;
  s.desiredAngle=clamp((targetY-s.y)/950,-.28,.28);s.order='Screen convoy through hazard corridor';
 }
}
function segmentCircle(ax,ay,bx,by,cx,cy,r){
 const dx=bx-ax,dy=by-ay,fx=ax-cx,fy=ay-cy,a=dx*dx+dy*dy;if(a<1e-9)return Math.hypot(fx,fy)<=r?0:null;
 const bb=2*(fx*dx+fy*dy),cc=fx*fx+fy*fy-r*r,d=bb*bb-4*a*cc;if(d<0)return null;const q=Math.sqrt(d),ts=[(-bb-q)/(2*a),(-bb+q)/(2*a)].filter(t=>t>=0&&t<=1);return ts.length?Math.min(...ts):null;
}
function impact(b,m,s,x,y){
 const rvx=m.vx-(s.vx||0),rvy=m.vy-(s.vy||0),attacker={name:'Meteor',team:METEOR_TEAM,x:m.x,y:m.y,damageDone:0};
 b.hitRay(attacker,s,m.damage,'meteor',{x,y,dx:rvx,dy:rvy,penetration:m.penetration||1});
 const impulse=Math.min(18000000,m.mass*Math.hypot(rvx,rvy)),mag=Math.max(1,Math.hypot(rvx,rvy));s.vx+=(rvx/mag)*impulse/Math.max(1,s.mass);s.vy+=(rvy/mag)*impulse/Math.max(1,s.mass);
 m.hp=0;ensure(b).impacts++;b.log(`${s.name}: meteor impact. ${s.civilianEscort?'Convoy vessel damaged.':'Escort absorbed the strike.'}`);
}
function moveOne(b,m,dt){
 if(m.hp<=0)return;const ax=m.x,ay=m.y,bx=ax+m.vx*dt,by=ay+m.vy*dt;let hit=null;
 for(const s of b.ships||[]){if(s.dead)continue;const t=segmentCircle(ax,ay,bx,by,s.x,s.y,(s.radius||15)+(m.r||1));if(t!=null&&(!hit||t<hit.t))hit={s,t}}
 if(hit){const x=ax+(bx-ax)*hit.t,y=ay+(by-ay)*hit.t;impact(b,m,hit.s,x,y)}else{m.x=bx;m.y=by}
}
function advanceMeteors({battle:b,dt}){
 if(!scenario(b))return;const h=ensure(b);if(!h)return;
 for(const m of b.hazardMeteors||[]){m.ttl-=dt;moveOne(b,m,dt)}
 b.hazardMeteors=(b.hazardMeteors||[]).filter(m=>m.hp>0&&m.ttl>0);
 for(const m of b.ordnance||[])if(m.kind==='meteor'&&m.hp>0)moveOne(b,m,dt);
 // A tracked meteor disappearing from ordnance without an impact was destroyed by defensive fire.
 const trackedLive=(b.ordnance||[]).filter(o=>o.kind==='meteor'&&o.hp>0).length;
 h.destroyed=Math.max(h.destroyed,h.detected-h.impacts-trackedLive);
}
function finishObjective({battle:b}){
 if(!scenario(b))return;const h=ensure(b);if(!h||h.finished)return;
 const elapsed=b.t-h.startedAt,survivors=convoy(b).length,total=h.initialConvoy;
 if(survivors<=0){h.finished=true;b.hazardResult={success:false,survivors:0,total,payoutFactor:0,detected:h.detected,destroyed:h.destroyed,impacts:h.impacts};b.winner='E';b.log('Hazard transit failed: all escorted merchant vessels were lost.');return}
 if(elapsed<h.duration){if(b.winner)b.winner=null;return}
 const factor=survivors===total ? 1 : (survivors/total>=.66 ? .78 : .48);h.finished=true;b.hazardResult={success:true,survivors,total,payoutFactor:factor,detected:h.detected,destroyed:h.destroyed,impacts:h.impacts};b.winner='P';b.log(`Hazard transit complete: ${survivors}/${total} merchant vessels cleared the swarm.`);
}

registerBattleHook('beforeStep','hazard-meteor-spawn-detect',({battle,dt})=>{if(!scenario(battle))return;ensure(battle);spawn(battle,dt);detect(battle,dt)},220);
registerBattleHook('beforeApplySystems','hazard-convoy-navigation',steerShips,220);
registerBattleHook('afterProjectiles','hazard-meteor-ballistics',advanceMeteors,140);
registerBattleHook('afterStep','hazard-objective-resolution',finishObjective,100);

export function hazardSummary(b){const h=scenario(b)?ensure(b):null;if(!h)return null;const tracked=(b.ordnance||[]).filter(o=>o.kind==='meteor'&&o.hp>0);return{...h,elapsed:b.t-h.startedAt,timeRemaining:Math.max(0,h.duration-(b.t-h.startedAt)),convoySurvivors:convoy(b).length,liveMeteors:tracked.length+(b.hazardMeteors?.length||0),trackedMeteors:tracked.length}}
if(typeof window!=='undefined')window.__hazardSummary=()=>hazardSummary(window.__fleetBattle);
