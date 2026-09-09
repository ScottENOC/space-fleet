import {Battle} from './sim.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const BASE_APPLY=Battle.prototype.applySystems;
const BASE_STEP=Battle.prototype.step;

export const PLAY_DEAD_MODES={off:{label:'Normal operations'},armed:{label:'Play dead'}};

function alive(s,t){return (s.modules||[]).filter(m=>m.type===t&&m.hp>0&&!m.disabled)}
function trueReadiness(s){
 const engines=alive(s,'engine').length,reactors=alive(s,'reactor').length,weapons=(s.modules||[]).filter(m=>['gun','laser','missile'].includes(m.type)&&m.hp>0&&!m.disabled).length,bridges=alive(s,'bridge').length;
 const total=(s.modules||[]).filter(m=>m.type!=='hull').length||1,healthy=(s.modules||[]).filter(m=>m.type!=='hull'&&m.hp>0&&!m.disabled).length;
 return clamp((healthy/total)*.35+(engines?1:0)*.20+(reactors?1:0)*.20+(weapons?1:0)*.20+(bridges?1:0)*.05,0,1);
}
function damageCredibility(s){
 const ms=(s.modules||[]).filter(m=>m.type!=='hull'),max=ms.reduce((n,m)=>n+(m.maxHp||m.hp||1),0)||1,hp=ms.reduce((n,m)=>n+Math.max(0,m.hp||0),0),destroyed=ms.filter(m=>m.hp<=0).length;
 return clamp((1-hp/max)*.72+destroyed/Math.max(1,ms.length)*.55,0,1);
}
export function playDeadCredibility(s){
 if(!s.playDead)return 0;
 const genuine=damageCredibility(s),heat=s.heatState?.fraction||0,hotPenalty=Math.max(0,heat-.55)*.45;
 return clamp(.32+genuine*.62-hotPenalty,0,1);
}
export function apparentReadiness(s,sensorQuality=.5){
 const actual=trueReadiness(s);if(!s.playDead)return actual;
 const credibility=playDeadCredibility(s),deception=clamp(credibility*(1-sensorQuality*.62),0,.92);
 return clamp(actual*(1-deception)*.42+(1-credibility)*.12,0,1);
}
export function setPlayDead(ship,on=true){
 ship.playDead=!!on;ship.playDeadArmed=!!on;
 if(on){ship.runSilent=false;ship.playDeadSince=typeof performance!=='undefined'&&performance.now?performance.now():Date.now();ship.playDeadSprung=false;ship.playDeadKillZone=ship.playDeadKillZone||2100;}
 return ship.playDead;
}
export function springPlayDead(ship,reason='contact'){if(!ship?.playDead)return false;ship.playDead=false;ship.playDeadArmed=false;ship.playDeadSprung=true;ship.playDeadSpringReason=reason;ship.playDeadSpringAt=Date.now();return true;}

function inboundBoardingCraft(b,s){
 return (b.ordnance||[]).filter(o=>o.kind==='boardingShuttle'&&o.hp>0&&o.team!==s.team&&o.target===s&&o.state==='approach').map(o=>{
   const dx=s.x-o.x,dy=s.y-o.y,d=Math.hypot(dx,dy),rvx=(o.vx||0)-(s.vx||0),rvy=(o.vy||0)-(s.vy||0),closing=d>0?(rvx*dx+rvy*dy)/d:0;
   return{o,d,closing};
 }).filter(x=>x.closing>0).sort((a,c)=>a.d-c.d);
}
function maybeSpringBoardingTrap(b,s){
 if(!s.playDead||!s.playDeadArmed)return;
 const q=inboundBoardingCraft(b,s),nearest=q[0];if(!nearest)return;
 const credibility=playDeadCredibility(s),weapons=(s.modules||[]).filter(m=>['gun','laser','missile'].includes(m.type)&&m.hp>0&&!m.disabled);
 if(!weapons.length)return;
 const base=s.playDeadKillZone||2100,killZone=clamp(base*(.82+credibility*.22),1450,2550);
 if(nearest.d>killZone)return;
 springPlayDead(s,'boarding craft entered kill zone');
 s.playDeadTrapTargetUid=nearest.o.uid;s.playDeadTrapUntil=(b.t||0)+4.5;
 b.log(`${s.name}: PLAY-DEAD TRAP SPRUNG — ${nearest.o.name} entered the kill zone. Concealed systems light and defensive batteries open fire.`);
}

Battle.prototype.applySystems=function(s,dt){
 if(!s.playDead)return BASE_APPLY.call(this,s,dt);
 const engines=alive(s,'engine'),weapons=(s.modules||[]).filter(m=>['gun','laser','missile'].includes(m.type)&&m.hp>0&&!m.disabled),shields=alive(s,'shield'),jammers=alive(s,'jammer'),saved={throttle:s.throttle,disabled:[...engines,...weapons,...jammers].map(m=>[m,m.disabled]),shieldDisabled:shields.map(m=>[m,m.disabled]),reactorPower:alive(s,'reactor').map(m=>[m,m.power])};
 try{
   s.throttle=0;
   for(const [m] of saved.disabled)m.disabled=true;
   for(const [m] of saved.shieldDisabled)m.disabled=true;
   for(const [m,p] of saved.reactorPower)m.power=p*.055;
   s.weaponStatus='playing dead';s.playDeadState={credibility:playDeadCredibility(s),apparent:true};
   return BASE_APPLY.call(this,s,dt);
 } finally {
   s.throttle=saved.throttle;
   for(const [m,d] of saved.disabled)m.disabled=d;
   for(const [m,d] of saved.shieldDisabled)m.disabled=d;
   for(const [m,p] of saved.reactorPower)m.power=p;
 }
};

Battle.prototype.step=function(dt){for(const s of this.ships||[])if(!s.dead)maybeSpringBoardingTrap(this,s);return BASE_STEP.call(this,dt)};

// Fallback only: if the shuttle somehow survives the kill zone and reaches the hull,
// defenders still exploit the deception during the breach rather than forgetting the trap existed.
export function boardingAmbush(b,target,shuttle){
 if(!target?.playDeadArmed||!target.playDead)return null;
 springPlayDead(target,'boarding craft reached hull');
 const marines=Math.max(1,shuttle.marines||1),lost=Math.max(1,Math.round(marines*.35));shuttle.marines=Math.max(0,marines-lost);
 b?.log?.(`${target.name}: concealed security teams ambush the surviving boarders at the breach. ${lost}/${marines} boarders lost.`);
 return{lost,survivors:shuttle.marines,credibility:playDeadCredibility(target)};
}

if(typeof window!=='undefined'){
 window.__setPlayDead=setPlayDead;window.__springPlayDead=springPlayDead;window.__playDeadApparentReadiness=apparentReadiness;window.__playDeadCredibility=playDeadCredibility;window.__playDeadBoardingAmbush=boardingAmbush;
}
