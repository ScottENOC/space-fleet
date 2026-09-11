import {registerBattleHook} from './battle-hooks.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const rot=(x,y,a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];

function worldPoint(s,m){const [x,y]=rot(m.x||0,m.y||0,s.angle);return{x:s.x+x,y:s.y+y}}
function threatRank(o){return o.kind==='missile'?0:o.kind==='boardingShuttle'?1:o.kind==='fighter'?2:o.kind==='sensorDrone'?3:4}
function interceptAngle(s,o,speed){
 const p=worldPoint(s,{x:0,y:0}),rx=o.x-p.x,ry=o.y-p.y,rvx=(o.vx||0)-(s.vx||0),rvy=(o.vy||0)-(s.vy||0),a=rvx*rvx+rvy*rvy-speed*speed,b=2*(rx*rvx+ry*rvy),c=rx*rx+ry*ry;let t=null;
 if(Math.abs(a)<1e-9){if(Math.abs(b)>1e-9){const q=-c/b;if(q>0)t=q}}
 else{const d=b*b-4*a*c;if(d>=0){const q=Math.sqrt(d),xs=[(-b-q)/(2*a),(-b+q)/(2*a)].filter(x=>x>0);if(xs.length)t=Math.min(...xs)}}
 return t==null?Math.atan2(ry,rx):Math.atan2(ry+rvy*t,rx+rvx*t)
}
function inTraverse(s,w,o){const desired=interceptAngle(s,o,w.muzzle||1650),centre=wrap(s.angle+(w.mountDir||0)),arc=w.arc||Math.PI/2;return Math.abs(wrap(desired-centre))<=arc?desired:null}
function chooseThreat(b,s,w){
 const range=w.pdcRange||1900,candidates=(b.ordnance||[]).filter(o=>o.team!==s.team&&o.hp>0&&dist(s,o)<=range);
 candidates.sort((a,c)=>threatRank(a)-threatRank(c)||dist(s,a)-dist(s,c));
 return candidates.find(o=>inTraverse(s,w,o)!=null)||null;
}
function payPower(s,w){if(!s.requestPower||!(w.powerUse>0))return true;const ok=s.requestPower(w.powerUse,'defence');if(ok)w._powerPaidBus=s.powerBus;return ok}
function burst(b,s,w,o){
 const aim=inTraverse(s,w,o);if(aim==null||!payPower(s,w))return false;
 const rounds=Math.min(w.ammo||0,w.pdcBurstRounds||24);if(rounds<=0)return false;
 const tracers=Math.max(1,w.pdcTracers||11),spread=w.pdcSpread||.12,p=worldPoint(s,w),range=w.pdcRange||1900,muzzle=w.muzzle||1650;
 const d=Math.max(1,dist(p,o)),flight=d/muzzle,predX=o.x+((o.vx||0)-(s.vx||0))*flight,predY=o.y+((o.vy||0)-(s.vy||0))*flight,predAim=Math.atan2(predY-p.y,predX-p.x),tol=Math.atan2((o.r||3)+(w.pdcAimTolerance||10),d);
 let hits=0;
 for(let i=0;i<tracers;i++){
   const a=predAim+b.rng.range(-spread,spread),rvx=Math.cos(a)*muzzle,rvy=Math.sin(a)*muzzle;
   b.projectiles.push({team:s.team,owner:s,x:p.x,y:p.y,vx:(s.vx||0)+rvx,vy:(s.vy||0)+rvy,mass:w.projectileMass||.06,damage:w.damage||.04,penetration:w.penetration||.025,r:.35,ttl:Math.min(.9,range/muzzle+.08),pdcTracer:true});
   if(Math.abs(wrap(a-predAim))<=tol)hits++;
 }
 if(hits>0)o.hp-=hits*(w.pdcPacketDamage||8);
 w.ammo-=rounds;w.cooldownLeft=w.cooldown||.18;s.shots+=tracers;
 s.heatMJ=(s.heatMJ||0)+(w.pdcHeatMJ||.42);
 w.pdcLastTarget=o.kind;w.pdcLastHits=hits;w.pdcLastFiredAt=b.t;
 return true;
}
function suppressPdcFromNavalFire({ship}){
 for(const m of ship.modules||[])if(m.pdc&&m.hp>0&&!m.disabled){m._pdcSuppressed=true;m.disabled=true}
}
function firePdc({battle}){
 for(const s of battle.ships||[]){if(s.dead)continue;for(const w of s.modules||[]){if(!w.pdc||w.hp<=0||(!w._pdcSuppressed&&w.disabled)||(w.cooldownLeft||0)>0||(w.ammo||0)<=0)continue;const o=chooseThreat(battle,s,w);if(o)burst(battle,s,w,o)}}
}
function restorePdc({battle}){for(const s of battle.ships||[])for(const m of s.modules||[])if(m._pdcSuppressed){m.disabled=false;delete m._pdcSuppressed}}

// Keep the module out of normal anti-ship weapon employment. It remains available
// here for autonomous close-in defence; ordinary naval guns keep their existing
// point-defence role in ordnance.js for small/versatile ships.
registerBattleHook('beforeFireWeapons','pdc-suppress-anti-ship',suppressPdcFromNavalFire,100);
registerBattleHook('beforeProjectiles','pdc-autonomous-defence',firePdc,100);
registerBattleHook('afterProjectiles','pdc-restore',restorePdc,-100);

if(typeof window!=='undefined')window.__pdcThreatRank=threatRank;
