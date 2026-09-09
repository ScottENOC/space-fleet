import {Battle} from './sim.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const BASE_APPLY=Battle.prototype.applySystems;

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
 ship.playDead=!!on;
 ship.playDeadArmed=!!on;
 if(on){ship.runSilent=false;ship.playDeadSince=performance?.now?.()||Date.now();ship.playDeadSprung=false;}
 return ship.playDead;
}
export function springPlayDead(ship,reason='contact'){if(!ship?.playDead)return false;ship.playDead=false;ship.playDeadArmed=false;ship.playDeadSprung=true;ship.playDeadSpringReason=reason;ship.playDeadSpringAt=Date.now();return true;}

Battle.prototype.applySystems=function(s,dt){
 if(!s.playDead)return BASE_APPLY.call(this,s,dt);
 const engines=alive(s,'engine'),weapons=(s.modules||[]).filter(m=>['gun','laser','missile'].includes(m.type)&&m.hp>0&&!m.disabled),shields=alive(s,'shield'),jammers=alive(s,'jammer'),saved={throttle:s.throttle,disabled:[...engines,...weapons,...jammers].map(m=>[m,m.disabled]),shieldDisabled:shields.map(m=>[m,m.disabled]),reactorPower:alive(s,'reactor').map(m=>[m,m.power])};
 try{
   s.throttle=0;
   for(const [m] of saved.disabled)m.disabled=true;
   for(const [m] of saved.shieldDisabled)m.disabled=true;
   // Keep a very low hotel-load reactor signature rather than impossible zero-energy operation.
   for(const [m,p] of saved.reactorPower)m.power=p*.055;
   s.weaponStatus='playing dead';
   s.playDeadState={credibility:playDeadCredibility(s),apparent:true};
   return BASE_APPLY.call(this,s,dt);
 } finally {
   s.throttle=saved.throttle;
   for(const [m,d] of saved.disabled)m.disabled=d;
   for(const [m,d] of saved.shieldDisabled)m.disabled=d;
   for(const [m,p] of saved.reactorPower)m.power=p;
 }
};

export function boardingAmbush(b,target,shuttle){
 if(!target?.playDeadArmed||!target.playDead)return null;
 const credibility=playDeadCredibility(target),crew=target.boardingState,defenders=Math.max(3,(crew?.defenderStrength||6)-(crew?.casualties||0));
 const marines=Math.max(1,shuttle.marines||1),prepared=clamp(.46+credibility*.34+defenders/(defenders+marines)*.25,.35,.92),lossFraction=clamp(prepared*(.70+Math.random()*.22),.30,.94),lost=Math.min(marines,Math.max(1,Math.round(marines*lossFraction)));
 shuttle.marines=Math.max(0,marines-lost);
 springPlayDead(target,'boarding trap');
 b?.log?.(`${target.name}: PLAY-DEAD AMBUSH — concealed systems come alive as ${shuttle.name} commits. ${lost}/${marines} boarders lost before establishing a foothold.`);
 return{lost,survivors:shuttle.marines,credibility};
}

if(typeof window!=='undefined'){
 window.__setPlayDead=setPlayDead;window.__springPlayDead=springPlayDead;window.__playDeadApparentReadiness=apparentReadiness;window.__playDeadCredibility=playDeadCredibility;window.__playDeadBoardingAmbush=boardingAmbush;
}
