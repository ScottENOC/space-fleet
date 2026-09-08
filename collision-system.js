import {Battle,recalc} from './sim.js';
import {MODULES} from './shipyard.js';

// Ram components are armour in ordinary combat, but are purpose-built for impact.
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
function impactSequence(s,nx,ny,contactLateral=0){
  const tx=-ny,ty=nx;
  return s.modules.filter(m=>m.hp>0&&m.id!=='keel').map(m=>{
    const p=moduleWorld(s,m),rx=p.x-s.x,ry=p.y-s.y;
    const depth=dot(rx,ry,nx,ny),lateral=Math.abs(dot(rx,ry,tx,ty)-contactLateral);
    // Contact depth dominates, but nearby modules on the actual strike line are hit first.
    return{m,score:depth-lateral*.55};
  }).sort((a,b)=>b.score-a.score).map(x=>x.m);
}
function damageResistance(m){if(m.ram)return m.ramResistance??.42;if(m.type==='armor')return .72;return 1;}
function attackMultiplier(m){return m?.ram?(m.ramDamage||1.7):m?.type==='armor'?1.08:1;}
function crushShip(b,attacker,target,energyHp,nx,ny,contactLateral=0){
  let energy=energyHp;
  const attackFace=impactSequence(attacker,nx,ny,contactLateral)[0];
  energy*=attackMultiplier(attackFace);
  const seq=impactSequence(target,-nx,-ny,contactLateral);
  for(const m of seq){
    if(energy<=0)break;
    const resist=damageResistance(m),capacity=(m.hp||0)/Math.max(.08,resist),spent=Math.min(energy,capacity),hpLoss=spent*resist;
    m.hp=Math.max(0,m.hp-hpLoss);energy-=spent;
    if(m.hp<=0)b.log(`${target.name}: ${m.id} crushed in collision with ${attacker.name}.`);
  }
  if(energy>0){const keel=target.modules.find(m=>m.id==='keel');if(keel)keel.hp=Math.max(0,keel.hp-energy*.22);}
}
function pairKey(a,b){return[a.uid||a.name,b.uid||b.name].sort().join('|')}
function resolvePair(b,a,c){
  if(a.dead||c.dead||a.team===c.team)return;
  const dx=c.x-a.x,dy=c.y-a.y,d=Math.hypot(dx,dy)||1,contact=Math.max(3,(a.radius||1)+(c.radius||1));
  if(d>contact)return;
  if(!a.ramIntent&&!c.ramIntent){
    // Neither captain accepts the collision: one uses the third dimension to miss.
    const nx=dx/d,ny=dy/d,overlap=contact-d+1;
    a.x-=nx*overlap*.5;a.y-=ny*overlap*.5;c.x+=nx*overlap*.5;c.y+=ny*overlap*.5;
    return;
  }
  b._collisionCooldown??=new Map();const key=pairKey(a,c),until=b._collisionCooldown.get(key)||0;if(until>b.t)return;
  b._collisionCooldown.set(key,b.t+.8);
  const nx=dx/d,ny=dy/d,tx=-ny,ty=nx;
  const rvx=c.vx-a.vx,rvy=c.vy-a.vy,normalRel=dot(rvx,rvy,nx,ny),closing=-normalRel;
  if(closing<=5)return;

  // Kinetic energy available in the centre-of-mass frame for the closing motion:
  // E = 1/2 * reducedMass * relativeNormalSpeed^2.
  const reduced=(a.mass*c.mass)/(a.mass+c.mass);
  const collisionEnergy=.5*reduced*closing*closing;
  // HP is abstract; this conversion preserves the real reduced-mass and v^2 scaling.
  const energyHp=collisionEnergy/2.0e7;

  // Tangential relative motion gives a glancing strike an off-centre contact point.
  const tangential=dot(rvx,rvy,tx,ty),relSpeed=Math.hypot(rvx,rvy)||1;
  const lateral=clamp(tangential/relSpeed,-.65,.65)*Math.min(a.width||10,c.width||10)*.42;
  const rax=nx*(a.radius||1)+tx*lateral,ray=ny*(a.radius||1)+ty*lateral;
  const rcx=-nx*(c.radius||1)+tx*lateral,rcy=-ny*(c.radius||1)+ty*lateral;

  // Low-restitution rigid-body impulse conserves linear momentum and transfers
  // angular momentum when the contact is off-centre.
  const restitution=.12,raCrossN=cross(rax,ray,nx,ny),rcCrossN=cross(rcx,rcy,nx,ny);
  const denom=1/a.mass+1/c.mass+(raCrossN*raCrossN)/(a.inertia||1)+(rcCrossN*rcCrossN)/(c.inertia||1);
  const j=(1+restitution)*closing/Math.max(1e-12,denom);
  a.vx-=nx*j/a.mass;a.vy-=ny*j/a.mass;c.vx+=nx*j/c.mass;c.vy+=ny*j/c.mass;
  a.omega-=raCrossN*j/(a.inertia||1);c.omega+=rcCrossN*j/(c.inertia||1);

  const aFace=impactSequence(a,nx,ny,lateral)[0],cFace=impactSequence(c,-nx,-ny,lateral)[0];
  const aSelf=aFace?.ram?(aFace.ramResistance||.42):aFace?.type==='armor'?.72:1;
  const cSelf=cFace?.ram?(cFace.ramResistance||.42):cFace?.type==='armor'?.72:1;
  crushShip(b,a,c,energyHp*cSelf,nx,ny,lateral);
  crushShip(b,c,a,energyHp*aSelf,-nx,-ny,lateral);
  recalc(a);recalc(c);
  b.log(`${a.name} collides with ${c.name} at ${closing.toFixed(0)} m/s relative speed.`);

  const overlap=contact-d+2;a.x-=nx*overlap*.5;a.y-=ny*overlap*.5;c.x+=nx*overlap*.5;c.y+=ny*overlap*.5;
}
function resolveShipCollisions(b){for(let i=0;i<b.ships.length;i++)for(let k=i+1;k<b.ships.length;k++)resolvePair(b,b.ships[i],b.ships[k]);}

Battle.prototype.step=function(dt){const out=baseStep.call(this,dt);if(!this.winner){resolveShipCollisions(this);this.checkDeaths();}return out;};
