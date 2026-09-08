import {Battle,recalc} from './sim.js';
import {MODULES} from './shipyard.js';

// Ram components are armour in ordinary combat, but are purpose-built for impact.
// They remain targetable as armour while carrying collision-specific properties.
MODULES.ram_1 ??= {
  name:'Ram prow',type:'armor',size:[1,1],mass:7,hp:190,absorb:.78,
  ram:true,ramDamage:1.7,ramResistance:.42,colour:'#a78b67'
};
MODULES.ram_2 ??= {
  name:'Heavy ram',type:'armor',size:[2,1],mass:12,hp:410,absorb:.82,
  ram:true,ramDamage:2.0,ramResistance:.34,colour:'#9a7957'
};

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dot=(ax,ay,bx,by)=>ax*bx+ay*by;
const cross=(ax,ay,bx,by)=>ax*by-ay*bx;
const rot=(x,y,a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
const baseAI=Battle.prototype.ai;
const baseStep=Battle.prototype.step;

function healthFraction(s){
  const live=s.modules.filter(m=>m.maxHp>0||m.hp>0);
  const now=live.reduce((n,m)=>n+Math.max(0,m.hp||0),0);
  const max=live.reduce((n,m)=>n+(m.maxHp||m.hp||0),0)||1;
  return now/max;
}
function collisionFaceQuality(s){
  // Ram modules matter most; armour gives some confidence but not enough to make
  // otherwise-suicidal impacts attractive.
  const rams=s.modules.filter(m=>m.hp>0&&m.ram);
  if(rams.length)return 1.45+rams.reduce((n,m)=>n+(m.hp/(m.maxHp||m.hp)),0)*.18;
  const armour=s.modules.filter(m=>m.hp>0&&m.type==='armor');
  return armour.length?1.0:0.72;
}
function shouldRam(s,e){
  if(!e||e.dead)return false;
  const ownH=healthFraction(s),enemyH=healthFraction(e);
  const massRatio=s.mass/Math.max(1,e.mass);
  const face=collisionFaceQuality(s);
  const favourable=massRatio*face*(.65+ownH) > 1.75*(.6+enemyH);
  const desperate=ownH<.27&&(enemyH>ownH*1.35||s.modules.filter(m=>['gun','laser','missile'].includes(m.type)&&m.hp>0).length===0);
  return favourable||desperate;
}

Battle.prototype.ai=function(s,e){
  baseAI.call(this,s,e);
  if(!e||e.dead)return;
  s.ramIntent=shouldRam(s,e);
  if(!s.ramIntent)return;
  const dx=e.x-s.x,dy=e.y-s.y;
  s.desiredAngle=Math.atan2(dy,dx);
  s.throttle=1;
  s.order=healthFraction(s)<.27?'Desperate ramming attack':'Commit to ram';
};

function moduleWorld(s,m){const [x,y]=rot(m.x,m.y,s.angle);return{x:s.x+x,y:s.y+y}}
function impactSequence(s,nx,ny,towardContact=true){
  // Sort modules from the impact-facing surface inward. nx,ny points from this
  // ship toward the other ship.
  return s.modules.filter(m=>m.hp>0&&m.id!=='keel').map(m=>{
    const p=moduleWorld(s,m);return{m,depth:dot(p.x-s.x,p.y-s.y,nx,ny)};
  }).sort((a,b)=>towardContact?b.depth-a.depth:a.depth-b.depth).map(x=>x.m);
}
function damageResistance(m){
  if(m.ram)return m.ramResistance??.42;
  if(m.type==='armor')return .72;
  return 1;
}
function attackMultiplier(m){return m?.ram?(m.ramDamage||1.7):m?.type==='armor'?1.08:1;}
function crushShip(b,attacker,target,energyHp,nx,ny){
  let energy=energyHp;
  const attackFace=impactSequence(attacker,nx,ny)[0];
  energy*=attackMultiplier(attackFace);
  const seq=impactSequence(target,-nx,-ny);
  for(const m of seq){
    if(energy<=0)break;
    const resist=damageResistance(m);
    const capacity=(m.hp||0)/Math.max(.08,resist);
    const spent=Math.min(energy,capacity);
    const hpLoss=spent*resist;
    m.hp=Math.max(0,m.hp-hpLoss);
    energy-=spent;
    if(m.hp<=0)b.log(`${target.name}: ${m.id} crushed in collision with ${attacker.name}.`);
  }
  if(energy>0){
    const keel=target.modules.find(m=>m.id==='keel');
    if(keel)keel.hp=Math.max(0,keel.hp-energy*.22);
  }
}
function pairKey(a,b){return[a.uid||a.name,b.uid||b.name].sort().join('|')}
function resolvePair(b,a,c){
  if(a.dead||c.dead||a.team===c.team)return;
  const dx=c.x-a.x,dy=c.y-a.y,d=Math.hypot(dx,dy)||1;
  const contact=Math.max(3,(a.radius||1)+(c.radius||1));
  if(d>contact)return;
  if(!a.ramIntent&&!c.ramIntent){
    // Both captains avoid in the third dimension; separate only enough to stop
    // repeated geometric overlap in our 2-D projection.
    const nx=dx/d,ny=dy/d,overlap=contact-d+1;
    a.x-=nx*overlap*.5;a.y-=ny*overlap*.5;c.x+=nx*overlap*.5;c.y+=ny*overlap*.5;
    return;
  }
  b._collisionCooldown??=new Map();const key=pairKey(a,c),until=b._collisionCooldown.get(key)||0;if(until>b.t)return;
  b._collisionCooldown.set(key,b.t+.8);
  const nx=dx/d,ny=dy/d;
  const rvx=c.vx-a.vx,rvy=c.vy-a.vy;
  const closing=-dot(rvx,rvy,nx,ny);
  if(closing<=5)return;

  // Centre-of-mass collision energy from the normal relative velocity.
  const reduced=(a.mass*c.mass)/(a.mass+c.mass);
  const collisionEnergy=.5*reduced*closing*closing; // joules
  // Convert joules to game structural HP. Scaling preserves v^2 and reduced-mass physics.
  const energyHp=collisionEnergy/2.4e8;

  // Low-restitution rigid-body impulse. Contact is intentionally offset a little
  // when ships are not perfectly nose-to-nose, generating angular momentum.
  const tx=-ny,ty=nx;
  const lateral=clamp(dot(dx,dy,tx,ty)/(contact||1),-.35,.35)*Math.min(a.width||10,c.width||10)*.35;
  const rax=nx*(a.radius||1)+tx*lateral,ray=ny*(a.radius||1)+ty*lateral;
  const rcx=-nx*(c.radius||1)+tx*lateral,rcy=-ny*(c.radius||1)+ty*lateral;
  const e=.12;
  const raCrossN=cross(rax,ray,nx,ny),rcCrossN=cross(rcx,rcy,nx,ny);
  const denom=1/a.mass+1/c.mass+(raCrossN*raCrossN)/(a.inertia||1)+(rcCrossN*rcCrossN)/(c.inertia||1);
  const j=(1+e)*closing/Math.max(1e-12,denom);
  a.vx-=nx*j/a.mass;a.vy-=ny*j/a.mass;c.vx+=nx*j/c.mass;c.vy+=ny*j/c.mass;
  a.omega-=raCrossN*j/(a.inertia||1);c.omega+=rcCrossN*j/(c.inertia||1);

  // Both structures absorb the same collision-energy pool; their contact material
  // changes how efficiently that energy destroys the opposing side and survives it.
  const aFace=impactSequence(a,nx,ny)[0],cFace=impactSequence(c,-nx,-ny)[0];
  const aSelf=aFace?.ram?(aFace.ramResistance||.42):aFace?.type==='armor'?.72:1;
  const cSelf=cFace?.ram?(cFace.ramResistance||.42):cFace?.type==='armor'?.72:1;
  crushShip(b,a,c,energyHp*cSelf,nx,ny);
  crushShip(b,c,a,energyHp*aSelf,-nx,-ny);
  recalc(a);recalc(c);
  b.log(`${a.name} collides with ${c.name} at ${closing.toFixed(0)} m/s relative speed.`);

  const overlap=contact-d+2;a.x-=nx*overlap*.5;a.y-=ny*overlap*.5;c.x+=nx*overlap*.5;c.y+=ny*overlap*.5;
}
function resolveShipCollisions(b){for(let i=0;i<b.ships.length;i++)for(let k=i+1;k<b.ships.length;k++)resolvePair(b,b.ships[i],b.ships[k]);}

Battle.prototype.step=function(dt){
  const out=baseStep.call(this,dt);
  if(!this.winner){resolveShipCollisions(this);this.checkDeaths();}
  return out;
};
