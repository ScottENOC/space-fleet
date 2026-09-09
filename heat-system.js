import {Battle} from './sim.js';
import {MODULES,HULLS} from './shipyard.js';

// Dedicated radiator modules are high-capacity additions. Every hull also has
// integrated coolant loops, heat exchangers and radiating surface.
if(MODULES.radiator_1){MODULES.radiator_1.coolingMW??=4.0;MODULES.radiator_1.heatCapacityMJ??=35;}
if(MODULES.radiator_2){MODULES.radiator_2.coolingMW??=13.5;MODULES.radiator_2.heatCapacityMJ??=95;}
if(MODULES.radiator_3){MODULES.radiator_3.coolingMW??=40.0;MODULES.radiator_3.heatCapacityMJ??=260;}

// Low-observable hulls deliberately trade some radiating area for a smaller
// passive signature. These are modifiers on the normal integrated hull cooling.
const HULL_COOLING_FACTOR={
 frigate_sparrow:.82,frigate_dart:.90,frigate_line:1.00,
 destroyer_rapier:.90,destroyer_guardian:1.06,destroyer_torpedo:1.00,
 cruiser_pathfinder:.92,cruiser_line:1.04,cruiser_missile:1.00,
 battleship_line:1.08,battleship_siege:1.12,battleship_fast:1.00,
 carrier_light:1.03,carrier_fleet:1.08,carrier_super:1.12,
 trader_mule:1.04,trader_caravan:1.08,trader_leviathan:1.12
};
for(const [id,f] of Object.entries(HULL_COOLING_FACTOR))if(HULLS[id])HULLS[id].integratedCoolingFactor=f;

// Fraction of electrical/system power that remains aboard as waste heat.
// Energy deliberately expelled as beam energy, exhaust kinetic energy, etc. is not counted.
const HEAT_FRACTION={
 reactorWasteRatio:.75,
 engine:.14,
 laser:.34,
 gun:.55,
 missile:.30,
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

function hullCells(s){return s.grid?.validCells?.length||HULLS[s.hullId]?.cellCount||Math.max(6,Math.round((s.length||20)*(s.width||12)/9));}
function capacityMJ(s){
 const tonnes=Math.max(1,(s.mass||1000)/1000);
 const cells=hullCells(s);
 const radiatorBuffer=alive(s,'radiator').reduce((n,m)=>n+(m.heatCapacityMJ||0)*health(m),0);
 // Small ships still have useful coolant/structure heat sinks even without a dedicated radiator.
 return Math.max(220,tonnes*10+cells*7+radiatorBuffer);
}
function integratedHullCoolingMW(s){
 const cells=hullCells(s),factor=HULLS[s.hullId]?.integratedCoolingFactor??1;
 // Surface-area-ish scaling: enough for normal cruise/combat support loads on a small ship,
 // but intentionally not enough for sustained high-output capital combat or laser spam.
 return (1.35*Math.sqrt(cells)+.55*Math.pow(cells,.6))*factor;
}
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
function launchBayHeatMW(s){return s.modules.filter(m=>m.type==='launchBay'&&m.hp>0&&m._powerPaidBus===s.powerBus).reduce((n,m)=>n+(m.powerUse||0)*HEAT_FRACTION.launchBay,0)/1e6;}
function wasteHeatMW(s,dt){
 const p=s.powerState||{},g=p.groups||{};
 const reactorElectricMW=Math.max(0,Math.min(p.generationMW||0,(p.demandMW||0)-Math.max(0,p.storageMW||0)))/1e6;
 const reactor=reactorElectricMW*HEAT_FRACTION.reactorWasteRatio;
 const engines=(g.engines?.supplied||0)/1e6*HEAT_FRACTION.engine;
 const shields=((g.shieldMaintain?.supplied||0)+(g.shieldRecharge?.supplied||0))/1e6*HEAT_FRACTION.shield;
 const sensors=(g.sensors?.supplied||0)/1e6*HEAT_FRACTION.sensor;
 const storage=(g.storageRecharge?.supplied||0)/1e6*HEAT_FRACTION.storageCharge;
 const weapons=weaponHeatMW(s,dt),launch=launchBayHeatMW(s);
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
 const totalDamage=Math.max(0,severity)*7*dt,each=totalDamage/vulnerable.length;
 for(const m of vulnerable)m.hp=Math.max(0,m.hp-each);
}

Battle.prototype.applySystems=function(s,dt){
 initialise(s);
 const capBefore=capacityMJ(s),fracBefore=s.heatMJ/capBefore,policy=policyFor(s),temporarilyDisabled=[],savedThrottle=s.throttle;
 if(fracBefore>=policy.laserCut){for(const m of s.modules)if(m.type==='laser'&&m.hp>0&&!m.disabled){m.disabled=true;temporarilyDisabled.push(m)}s.thermalThrottle='lasers inhibited';}else s.thermalThrottle='';
 if(fracBefore>=policy.engineCut){s.throttle=Math.min(s.throttle||0,.35);s.thermalThrottle=s.thermalThrottle?`${s.thermalThrottle}; propulsion limited`:'propulsion limited';}
 try{BASE_APPLY.call(this,s,dt)}finally{for(const m of temporarilyDisabled)m.disabled=false;s.throttle=savedThrottle;}

 const cap=capacityMJ(s),generated=wasteHeatMW(s,dt),integrated=integratedHullCoolingMW(s),radiators=radiatorCoolingMW(s),silentFactor=s.runSilent?.055:1;
 // Silent running suppresses both dedicated arrays and normal hull heat rejection.
 const integratedEffective=integrated*(s.runSilent?.08:1),radiatorEffective=radiators*silentFactor,rejected=integratedEffective+radiatorEffective;
 s.heatMJ=Math.max(0,s.heatMJ+(generated-rejected)*dt);
 const fraction=s.heatMJ/cap;
 applyOverheatDamage(s,dt,fraction,policy.damage);
 s.heatState={heatMJ:s.heatMJ,capacityMJ:cap,fraction,generatedMW:generated,rejectedMW:rejected,radiatorMW:radiatorEffective,installedRadiatorMW:radiators,integratedMW:integratedEffective,installedIntegratedMW:integrated,reactorElectricMW:Math.max(0,Math.min(s.powerState?.generationMW||0,(s.powerState?.demandMW||0)-Math.max(0,s.powerState?.storageMW||0)))/1e6,policy:s.thermalPolicy||'balanced',policyLabel:policy.label,throttle:s.thermalThrottle||'',runSilent:!!s.runSilent};
 if(fraction>.68&&s.runSilent)s.silentHeatWarning=true;else if(fraction<.55)s.silentHeatWarning=false;
};

export function setThermalPolicy(ship,id='balanced'){if(POLICIES[id])ship.thermalPolicy=id;return ship.thermalPolicy||'balanced';}
export function getHeatState(ship){return ship.heatState||{heatMJ:ship.heatMJ||0,capacityMJ:capacityMJ(ship),fraction:0,generatedMW:0,rejectedMW:0,radiatorMW:0,installedRadiatorMW:radiatorCoolingMW(ship),integratedMW:integratedHullCoolingMW(ship),installedIntegratedMW:integratedHullCoolingMW(ship),policy:ship.thermalPolicy||'balanced',policyLabel:policyFor(ship).label,throttle:''};}
export {POLICIES,HEAT_FRACTION};
if(typeof window!=='undefined'){window.__getHeatState=getHeatState;window.__setThermalPolicy=setThermalPolicy;}
