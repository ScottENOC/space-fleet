import {Battle} from './sim.js';
import {MODULES} from './shipyard.js';

// Cooling is expressed as MW of heat rejected at nominal operating temperature.
if(MODULES.radiator_1){MODULES.radiator_1.coolingMW??=4.0;MODULES.radiator_1.heatCapacityMJ??=35;}
if(MODULES.radiator_2){MODULES.radiator_2.coolingMW??=13.5;MODULES.radiator_2.heatCapacityMJ??=95;}
if(MODULES.radiator_3){MODULES.radiator_3.coolingMW??=40.0;MODULES.radiator_3.heatCapacityMJ??=260;}

// Fraction of electrical/system power that remains aboard as waste heat.
// Energy deliberately expelled as beam energy, exhaust kinetic energy, etc. is not counted.
const HEAT_FRACTION={
 reactorWasteRatio:.75, // ~57% electrical conversion efficiency: 1 MW electric -> ~0.75 MW rejected heat
 engine:.14,           // most propulsion energy leaves in the exhaust
 laser:.34,            // beam energy leaves; inefficiency/power electronics heat the ship
 gun:.55,              // feed motors, breech, barrel and electronics; projectile energy leaves
 missile:.30,          // launch hardware/electronics; missile propulsion leaves with the missile
 shield:.28,
 sensor:.45,
 storageCharge:.07,
 launchBay:.88,
 misc:.55
};

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const alive=(s,t)=>s.modules.filter(m=>m.type===t&&m.hp>0&&!m.disabled);
const health=m=>m.hp/Math.max(1,m.maxHp||m.hp);
const BASE_APPLY=Battle.prototype.applySystems;

const POLICIES={
 conservative:{laserCut:.72,engineCut:.86,damage:.98,label:'Conservative'},
 balanced:{laserCut:.82,engineCut:.94,damage:1.03,label:'Balanced'},
 aggressive:{laserCut:.92,engineCut:1.00,damage:1.08,label:'Aggressive'},
 emergency:{laserCut:1.00,engineCut:1.06,damage:1.13,label:'Emergency output'}
};

function capacityMJ(s){
 const tonnes=Math.max(1,(s.mass||1000)/1000);
 const radiatorBuffer=alive(s,'radiator').reduce((n,m)=>n+(m.heatCapacityMJ||0)*health(m),0);
 return Math.max(180,tonnes*10+radiatorBuffer);
}
function hullCoolingMW(s){const tonnes=Math.max(1,(s.mass||1000)/1000);return .12*Math.sqrt(tonnes);}
function radiatorCoolingMW(s){return alive(s,'radiator').reduce((n,m)=>n+(m.coolingMW||0)*health(m),0);}
function justFired(m,dt){const cd=m.cooldown||0,left=m.cooldownLeft||0;return cd>0&&left>Math.max(0,cd-dt*1.6);}
function weaponHeatMW(s,dt){
 let watts=0;
 for(const m of s.modules){
   if(m.hp<=0||m.disabled||!justFired(m,dt))continue;
   if(m.type==='laser')watts+=(m.powerUse||0)*HEAT_FRACTION.laser;
   else if(m.type==='gun')watts+=(m.powerUse||0)*HEAT_FRACTION.gun;
   else if(m.type==='missile')watts+=(m.powerUse||0)*HEAT_FRACTION.missile;
 }
 return watts/1e6;
}
function launchBayHeatMW(s){
 return s.modules.filter(m=>m.type==='launchBay'&&m.hp>0&&m._powerPaidBus===s.powerBus).reduce((n,m)=>n+(m.powerUse||0)*HEAT_FRACTION.launchBay,0)/1e6;
}
function wasteHeatMW(s,dt){
 const p=s.powerState||{},g=p.groups||{};
 // Reactor plant only needs to produce what the ship actually draws from generation.
 // Battery discharge is not counted as reactor output.
 const reactorElectricMW=Math.max(0,Math.min(p.generationMW||0,(p.demandMW||0)-Math.max(0,p.storageMW||0)))/1e6;
 const reactor=reactorElectricMW*HEAT_FRACTION.reactorWasteRatio;
 const engines=(g.engines?.supplied||0)/1e6*HEAT_FRACTION.engine;
 const shields=((g.shieldMaintain?.supplied||0)+(g.shieldRecharge?.supplied||0))/1e6*HEAT_FRACTION.shield;
 const sensors=(g.sensors?.supplied||0)/1e6*HEAT_FRACTION.sensor;
 const storage=(g.storageRecharge?.supplied||0)/1e6*HEAT_FRACTION.storageCharge;
 const weapons=weaponHeatMW(s,dt);
 const launch=launchBayHeatMW(s);
 const accountedW=(g.engines?.supplied||0)+(g.shieldMaintain?.supplied||0)+(g.shieldRecharge?.supplied||0)+(g.weapons?.supplied||0)+(g.sensors?.supplied||0)+(g.storageRecharge?.supplied||0)+(g.offence?.supplied||0);
 const misc=Math.max(0,(p.demandMW||0)-accountedW)/1e6*HEAT_FRACTION.misc;
 return reactor+engines+shields+sensors+storage+weapons+launch+misc;
}
function policyFor(s){return POLICIES[s.thermalPolicy]||POLICIES.balanced;}
function initialise(s){if(!Number.isFinite(s.heatMJ))s.heatMJ=capacityMJ(s)*.18;return s.heatMJ;}
function applyOverheatDamage(s,dt,fraction,threshold){
 if(fraction<=threshold)return;
 const vulnerable=s.modules.filter(m=>m.hp>0&&!m.disabled&&['reactor','engine','laser','storage','shield','sensor'].includes(m.type));
 if(!vulnerable.length)return;
 const severity=(fraction-threshold)/(Math.max(.03,1.22-threshold));
 const totalDamage=Math.max(0,severity)*7*dt;
 const each=totalDamage/vulnerable.length;
 for(const m of vulnerable)m.hp=Math.max(0,m.hp-each);
}

Battle.prototype.applySystems=function(s,dt){
 initialise(s);
 const capBefore=capacityMJ(s),fracBefore=s.heatMJ/capBefore,policy=policyFor(s);
 const temporarilyDisabled=[],savedThrottle=s.throttle;
 if(fracBefore>=policy.laserCut){
   for(const m of s.modules)if(m.type==='laser'&&m.hp>0&&!m.disabled){m.disabled=true;temporarilyDisabled.push(m)}
   s.thermalThrottle='lasers inhibited';
 }else s.thermalThrottle='';
 if(fracBefore>=policy.engineCut){s.throttle=Math.min(s.throttle||0,.35);s.thermalThrottle=s.thermalThrottle?`${s.thermalThrottle}; propulsion limited`:'propulsion limited';}
 try{BASE_APPLY.call(this,s,dt)}finally{for(const m of temporarilyDisabled)m.disabled=false;s.throttle=savedThrottle;}

 const cap=capacityMJ(s),generated=wasteHeatMW(s,dt),radiators=radiatorCoolingMW(s),silentFactor=s.runSilent?.055:1;
 const passive=hullCoolingMW(s),rejected=passive+radiators*silentFactor;
 s.heatMJ=Math.max(0,s.heatMJ+(generated-rejected)*dt);
 const fraction=s.heatMJ/cap;
 applyOverheatDamage(s,dt,fraction,policy.damage);
 s.heatState={
   heatMJ:s.heatMJ,capacityMJ:cap,fraction,generatedMW:generated,rejectedMW:rejected,
   radiatorMW:radiators*silentFactor,installedRadiatorMW:radiators,passiveMW:passive,
   reactorElectricMW:Math.max(0,Math.min(s.powerState?.generationMW||0,(s.powerState?.demandMW||0)-Math.max(0,s.powerState?.storageMW||0)))/1e6,
   policy:s.thermalPolicy||'balanced',policyLabel:policy.label,throttle:s.thermalThrottle||'',runSilent:!!s.runSilent
 };
 if(fraction>.68&&s.runSilent)s.silentHeatWarning=true;else if(fraction<.55)s.silentHeatWarning=false;
};

export function setThermalPolicy(ship,id='balanced'){if(POLICIES[id])ship.thermalPolicy=id;return ship.thermalPolicy||'balanced';}
export function getHeatState(ship){return ship.heatState||{heatMJ:ship.heatMJ||0,capacityMJ:capacityMJ(ship),fraction:0,generatedMW:0,rejectedMW:0,radiatorMW:0,installedRadiatorMW:radiatorCoolingMW(ship),policy:ship.thermalPolicy||'balanced',policyLabel:policyFor(ship).label,throttle:''};}
export {POLICIES,HEAT_FRACTION};
if(typeof window!=='undefined'){window.__getHeatState=getHeatState;window.__setThermalPolicy=setThermalPolicy;}
