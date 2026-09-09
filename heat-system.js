import {Battle} from './sim.js';
import {MODULES} from './shipyard.js';

// Cooling is expressed as MW of heat rejected at nominal operating temperature.
if(MODULES.radiator_1){MODULES.radiator_1.coolingMW??=1.8;MODULES.radiator_1.heatCapacityMJ??=35;}
if(MODULES.radiator_2){MODULES.radiator_2.coolingMW??=5.2;MODULES.radiator_2.heatCapacityMJ??=95;}
if(MODULES.radiator_3){MODULES.radiator_3.coolingMW??=14.5;MODULES.radiator_3.heatCapacityMJ??=260;}

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
function hullCoolingMW(s){const tonnes=Math.max(1,(s.mass||1000)/1000);return .07*Math.sqrt(tonnes);}
function radiatorCoolingMW(s){return alive(s,'radiator').reduce((n,m)=>n+(m.coolingMW||0)*health(m),0);}
function wasteHeatMW(s){
 const p=s.powerState||{},g=p.groups||{};
 const reactor=(p.generationMW||0)*.12;
 const engines=(g.engines?.supplied||0)*.20;
 const shields=((g.shieldMaintain?.supplied||0)+(g.shieldRecharge?.supplied||0))*.24;
 const weapons=(g.weapons?.supplied||0)*.55;
 const sensors=(g.sensors?.supplied||0)*.30;
 const storage=(g.storageRecharge?.supplied||0)*.08;
 const misc=Math.max(0,(p.demandMW||0)-((g.engines?.supplied||0)+(g.shieldMaintain?.supplied||0)+(g.shieldRecharge?.supplied||0)+(g.weapons?.supplied||0)+(g.sensors?.supplied||0)+(g.storageRecharge?.supplied||0)))*.10;
 return (reactor+engines+shields+weapons+sensors+storage+misc)/1e6;
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

 const cap=capacityMJ(s),generated=wasteHeatMW(s),radiators=radiatorCoolingMW(s),silentFactor=s.runSilent?.055:1;
 const passive=hullCoolingMW(s),rejected=passive+radiators*silentFactor;
 s.heatMJ=Math.max(0,s.heatMJ+(generated-rejected)*dt);
 const fraction=s.heatMJ/cap;
 applyOverheatDamage(s,dt,fraction,policy.damage);
 s.heatState={
   heatMJ:s.heatMJ,capacityMJ:cap,fraction,generatedMW:generated,rejectedMW:rejected,
   radiatorMW:radiators*silentFactor,installedRadiatorMW:radiators,passiveMW:passive,
   policy:s.thermalPolicy||'balanced',policyLabel:policy.label,throttle:s.thermalThrottle||'',runSilent:!!s.runSilent
 };
 if(fraction>.68&&s.runSilent)s.silentHeatWarning=true;else if(fraction<.55)s.silentHeatWarning=false;
};

export function setThermalPolicy(ship,id='balanced'){if(POLICIES[id])ship.thermalPolicy=id;return ship.thermalPolicy||'balanced';}
export function getHeatState(ship){return ship.heatState||{heatMJ:ship.heatMJ||0,capacityMJ:capacityMJ(ship),fraction:0,generatedMW:0,rejectedMW:0,radiatorMW:0,installedRadiatorMW:radiatorCoolingMW(ship),policy:ship.thermalPolicy||'balanced',policyLabel:policyFor(ship).label,throttle:''};}
export {POLICIES};
if(typeof window!=='undefined'){window.__getHeatState=getHeatState;window.__setThermalPolicy=setThermalPolicy;}
