import {Battle,recalc} from './sim.js';
import {MODULES} from './shipyard.js';

// Energy storage: excellent instantaneous MW per cell, finite MWh endurance.
// `storageMW` is maximum charge/discharge power; `storageMWh` is usable capacity.
MODULES.storage_1 ??={name:'Pulse energy bank',type:'storage',size:[1,1],mass:4,hp:70,storageMW:18e6,storageMWh:.025,colour:'#78e3c2'};
MODULES.storage_2 ??={name:'Capacitor bank',type:'storage',size:[2,2],mass:12,hp:190,storageMW:100e6,storageMWh:.18,colour:'#69d9b7'};
MODULES.storage_3 ??={name:'Capital energy bank',type:'storage',size:[3,3],mass:24,hp:390,storageMW:280e6,storageMWh:.65,colour:'#5bcea9'};

// Lasers are burst loads. They consume nothing while idle, but a firing tick demands
// very high instantaneous power. Storage therefore enables low-generation sniper builds.
for(const [id,mw] of [['laser_1',24e6],['laser_2',90e6],['laser_3',260e6]])if(MODULES[id])MODULES[id].powerUse=mw;

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const cross=(ax,ay,bx,by)=>ax*by-ay*bx;
const dot=(ax,ay,bx,by)=>ax*bx+ay*by;
const rot=(x,y,a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
const alive=(s,type)=>s.modules.filter(m=>m.type===type&&m.hp>0&&!m.disabled);
const baseFire=Battle.prototype.fireWeapons;

function initialiseStorage(s){
  for(const m of alive(s,'storage')){
    if(m.maxHp==null)m.maxHp=m.hp;
    if(m.energyMWh==null)m.energyMWh=m.storageMWh||0; // battles begin charged
    m.energyMWh=Math.min(m.energyMWh,m.storageMWh||0);
  }
}
function storageState(s){
  initialiseStorage(s);
  const stores=alive(s,'storage');
  const maxMWh=stores.reduce((n,m)=>n+(m.storageMWh||0),0);
  const mwh=stores.reduce((n,m)=>n+(m.energyMWh||0),0);
  const dischargeMW=stores.reduce((n,m)=>n+(m.storageMW||0)*(m.hp/(m.maxHp||m.hp)),0);
  return{stores,maxMWh,mwh,dischargeMW};
}
function beginBus(s,dt){
  const generationMW=alive(s,'reactor').reduce((n,m)=>n+(m.power||0)*(m.hp/(m.maxHp||m.hp)),0);
  const st=storageState(s);
  return{s,dt,generationMW,genRemaining:generationMW,storagePowerRemaining:st.dischargeMW,storageMW:0,usedMW:0};
}
function drawStorage(bus,mw){
  let need=Math.min(mw,bus.storagePowerRemaining),drawn=0;
  for(const m of alive(bus.s,'storage')){
    if(need<=1e-6)break;
    const health=m.hp/(m.maxHp||m.hp),powerCap=(m.storageMW||0)*health;
    const energyCap=(m.energyMWh||0)*3600/bus.dt*1e6; // W available over this tick
    const take=Math.min(need,powerCap,energyCap);
    if(take<=0)continue;
    m.energyMWh-=take*bus.dt/3.6e9;
    need-=take;drawn+=take;
  }
  bus.storagePowerRemaining-=drawn;bus.storageMW+=drawn;
  return drawn;
}
function drawPower(bus,requestedMW){
  if(requestedMW<=0)return 1;
  let supplied=Math.min(requestedMW,bus.genRemaining);bus.genRemaining-=supplied;
  supplied+=drawStorage(bus,requestedMW-supplied);
  bus.usedMW+=supplied;
  return supplied/requestedMW;
}
function rechargeStorage(bus){
  let spare=bus.genRemaining;if(spare<=0)return;
  for(const m of alive(bus.s,'storage')){
    if(spare<=1e-6)break;
    const health=m.hp/(m.maxHp||m.hp),rate=Math.min(spare,(m.storageMW||0)*health);
    const room=Math.max(0,(m.storageMWh||0)-(m.energyMWh||0));
    const roomMW=room*3.6e9/bus.dt;
    const charge=Math.min(rate,roomMW);
    m.energyMWh=(m.energyMWh||0)+charge*bus.dt/3.6e9;
    spare-=charge;
  }
  bus.genRemaining=spare;
}
function weaponSnapshot(s){return new Map(s.modules.map(m=>[m,{cool:m.cooldownLeft||0,ammo:m.ammo,remaining:m.fightersRemaining}]));}
function weaponDemandAfter(s,before){
  let demand=0;
  for(const m of s.modules){
    const b=before.get(m);if(!b)continue;
    const fired=(m.cooldownLeft||0)>b.cool+1e-6||(Number.isFinite(b.ammo)&&Number.isFinite(m.ammo)&&m.ammo<b.ammo)||(Number.isFinite(b.remaining)&&Number.isFinite(m.fightersRemaining)&&m.fightersRemaining<b.remaining);
    if(fired)demand+=m.powerUse||0;
  }
  return demand;
}

// Full ship power controller. Systems may be deliberately over-subscribed: generation
// plus storage discharge sets the instantaneous ceiling, while finite MWh determines
// how long burst operation can continue.
Battle.prototype.applySystems=function(s,dt){
  recalc(s);initialiseStorage(s);
  for(const m of s.modules){m.active=false;m.output=0;m.cooldownLeft=Math.max(0,(m.cooldownLeft||0)-dt)}
  const bus=beginBus(s,dt);s.powerBus=bus;

  // Shields draw power only while actually recharging. Under shortage they recharge
  // proportionally more slowly rather than receiving free energy.
  for(const sh of alive(s,'shield')){
    if(sh.charge>=sh.capacity)continue;
    const fraction=drawPower(bus,sh.powerUse||0);
    sh.charge=Math.min(sh.capacity,sh.charge+sh.recharge*dt*fraction);
  }

  const angleErr=wrap(s.desiredAngle-s.angle),desiredOmega=clamp(angleErr*.72,-.42,.42),omegaErr=desiredOmega-s.omega,turnCmd=clamp(omegaErr*3.4,-1,1);
  s.desiredOmega=desiredOmega;s.angularControlDemand=turnCmd;

  // Only engines useful to the requested translation/rotation are energised. Engines
  // that would cancel the desired manoeuvre do not consume power merely because fitted.
  for(const eng of alive(s,'engine')){
    const [dx,dy]=rot(Math.cos(eng.dir),Math.sin(eng.dir),s.angle),[rx,ry]=rot(eng.x,eng.y,s.angle);
    const torqueSign=Math.sign(cross(rx,ry,dx,dy)),forwardness=dot(dx,dy,Math.cos(s.angle),Math.sin(s.angle));
    let translation=0;if(s.throttle>=0&&forwardness>.45)translation=s.throttle;if(s.throttle<0&&forwardness<-.45)translation=-s.throttle;
    if(Math.abs(torqueSign)>.1&&turnCmd*torqueSign<0&&Math.abs(turnCmd)>.12)translation*=1-Math.min(.9,Math.abs(turnCmd)*.9);
    let steering=0;if(Math.abs(torqueSign)>.1&&turnCmd*torqueSign>0)steering=Math.abs(turnCmd)*.92;
    let cmd=clamp(translation+steering,0,1);if(cmd<.025)continue;
    const fraction=drawPower(bus,(eng.powerUse||0)*cmd);cmd*=fraction;if(cmd<.01)continue;
    eng.active=true;eng.output=cmd;const F=eng.force*cmd*(.45+.55*eng.hp/eng.maxHp);
    s.vx+=dx*F/s.mass*dt;s.vy+=dy*F/s.mass*dt;s.omega+=cross(rx,ry,dx*F,dy*F)/s.inertia*dt;
  }

  s.x+=s.vx*dt;s.y+=s.vy*dt;s.angle=wrap(s.angle+s.omega*dt);

  // Let existing fire-control/ordnance logic decide what has a firing solution, but
  // cap it at physically available instantaneous MW. Then debit only weapons that fired.
  const before=weaponSnapshot(s),available=bus.genRemaining+bus.storagePowerRemaining;
  this.fireWeapons(s,this.enemy(s),available);
  const weaponMW=weaponDemandAfter(s,before);drawPower(bus,weaponMW);
  rechargeStorage(bus);

  const st=storageState(s);
  s.powerState={generationMW:bus.generationMW,demandMW:bus.usedMW,storageMW:bus.storageMW,storedMWh:st.mwh,maxMWh:st.maxMWh};
};

// Expose storage figures for UI/diagnostics without changing the underlying sim summary.
export function getPowerState(s){
  if(s.powerState)return s.powerState;
  const st=storageState(s);return{generationMW:0,demandMW:0,storageMW:0,storedMWh:st.mwh,maxMWh:st.maxMWh};
}
