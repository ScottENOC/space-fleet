import {Battle} from './sim.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const BASE_APPLY=Battle.prototype.applySystems;
const BASE_STEP=Battle.prototype.step;

export const PLAY_DEAD_MODES={off:{label:'Normal operations'},armed:{label:'Play damaged systems dead'}};
const RECENT_DAMAGE_WINDOW=9.0;
const POST_HIT_GRACE=1.25;

function alive(s,t){return (s.modules||[]).filter(m=>m.type===t&&m.hp>0&&!m.disabled)}
function combatModule(m){return ['engine','gun','laser','missile','shield','reactor','jammer','sensor','launchBay'].includes(m.type)}
function trueReadiness(s){
 const engines=alive(s,'engine').length,reactors=alive(s,'reactor').length,weapons=(s.modules||[]).filter(m=>['gun','laser','missile'].includes(m.type)&&m.hp>0&&!m.disabled).length,bridges=alive(s,'bridge').length;
 const total=(s.modules||[]).filter(m=>m.type!=='hull').length||1,healthy=(s.modules||[]).filter(m=>m.type!=='hull'&&m.hp>0&&!m.disabled).length;
 return clamp((healthy/total)*.35+(engines?1:0)*.20+(reactors?1:0)*.20+(weapons?1:0)*.20+(bridges?1:0)*.05,0,1);
}
function damageCredibility(s){
 const ms=(s.modules||[]).filter(m=>m.type!=='hull'),max=ms.reduce((n,m)=>n+(m.maxHp||m.hp||1),0)||1,hp=ms.reduce((n,m)=>n+Math.max(0,m.hp||0),0),destroyed=ms.filter(m=>m.hp<=0).length;
 return clamp((1-hp/max)*.72+destroyed/Math.max(1,ms.length)*.55,0,1);
}
function maskedModules(s){const ids=new Set(s.playDeadMask||[]);return(s.modules||[]).filter(m=>ids.has(m.id));}
function moduleEligibleForDeception(s,m,now){
 if(!combatModule(m)||m.hp<=0||!Number.isFinite(m._pdLastDamageAt))return false;
 const age=now-m._pdLastDamageAt;if(age<0||age>RECENT_DAMAGE_WINDOW)return false;
 const lastOp=m._pdLastOperateAt??-Infinity;
 return lastOp<=m._pdLastDamageAt+POST_HIT_GRACE;
}
function refreshMask(ship){const now=ship._simTime||0;ship.playDeadMask=(ship.modules||[]).filter(m=>moduleEligibleForDeception(ship,m,now)).map(m=>m.id);return ship.playDeadMask;}
export function playDeadCredibility(s){
 if(!s.playDead)return 0;
 const genuine=damageCredibility(s),masked=maskedModules(s),eligibleWeight=masked.reduce((n,m)=>n+(1-(m.hp/Math.max(1,m.maxHp||m.hp))),0),heat=s.heatState?.fraction||0,hotPenalty=Math.max(0,heat-.55)*.35;
 return clamp(.18+genuine*.48+Math.min(.34,eligibleWeight*.22)-hotPenalty,0,1);
}
export function apparentReadiness(s,sensorQuality=.5){
 const actual=trueReadiness(s);if(!s.playDead)return actual;
 const mask=maskedModules(s);if(!mask.length)return actual;
 const weighted=mask.reduce((n,m)=>n+(['engine','reactor'].includes(m.type)?1.25:['gun','laser','missile','shield'].includes(m.type)?1:.55),0),all=(s.modules||[]).filter(combatModule).length||1;
 const credibility=playDeadCredibility(s),deception=clamp(credibility*(1-sensorQuality*.62)*(weighted/all*2.2),0,.88);
 return clamp(actual*(1-deception),0,1);
}
export function setPlayDead(ship,on=true){
 ship.playDead=!!on;ship.playDeadArmed=!!on;
 if(on){ship.runSilent=false;ship.playDeadSince=ship._simTime||0;ship.playDeadSprung=false;ship.playDeadKillZone=ship.playDeadKillZone||2100;refreshMask(ship);}
 else ship.playDeadMask=[];
 return ship.playDead;
}
export function revealPlayDeadSystems(ship,ids=[],reason='opportunity'){
 if(!ship?.playDead)return 0;const reveal=new Set(ids),before=ship.playDeadMask||[],after=before.filter(id=>!reveal.has(id)),count=before.length-after.length;if(!count)return 0;
 ship.playDeadMask=after;ship.playDeadSprung=true;ship.playDeadSpringReason=reason;ship.playDeadSpringAt=ship._simTime||0;
 if(!after.length){ship.playDead=false;ship.playDeadArmed=false;}
 return count;
}
export function springPlayDead(ship,reason='contact'){if(!ship?.playDead)return false;const ids=[...(ship.playDeadMask||[])];revealPlayDeadSystems(ship,ids,reason);return true;}

function recordState(s,now){
 for(const m of s.modules||[]){
   const prev=m._pdLastHp;if(Number.isFinite(prev)&&m.hp<prev-.001)m._pdLastDamageAt=now;m._pdLastHp=m.hp;
   let operated=false;
   if(m.type==='engine'&&m.active)operated=true;
   else if(['gun','laser','missile'].includes(m.type)&&(m.cooldownLeft||0)>0)operated=true;
   else if(m.type==='shield'&&m.hp>0&&!m.disabled&&(m.charge||0)>0)operated=true;
   else if(m.type==='jammer'&&s.ewJammingActive)operated=true;
   else if(m.type==='reactor'&&m.hp>0&&!m.disabled&&(s.powerState?.generationMW||0)>0)operated=true;
   if(operated)m._pdLastOperateAt=now;
 }
}
function inboundBoardingCraft(b,s){
 return (b.ordnance||[]).filter(o=>o.kind==='boardingShuttle'&&o.hp>0&&o.team!==s.team&&o.target===s&&o.state==='approach').map(o=>{const dx=s.x-o.x,dy=s.y-o.y,d=Math.hypot(dx,dy),rvx=(o.vx||0)-(s.vx||0),rvy=(o.vy||0)-(s.vy||0),closing=d>0?(rvx*dx+rvy*dy)/d:0;return{o,d,closing};}).filter(x=>x.closing>0).sort((a,c)=>a.d-c.d);
}
function weaponCanBear(s,w,t){const bearing=Math.atan2(t.y-s.y,t.x-s.x),aim=wrap((s.angle||0)+(w.mountDir||0)),arc=(w.arc||Math.PI/12)*1.15,d=Math.hypot(t.x-s.x,t.y-s.y);if(Math.abs(wrap(bearing-aim))>arc)return false;if(w.type==='laser')return d<=(w.range||9000);if(w.type==='gun')return d<=Math.max(3500,(w.muzzle||1250)*5.2);if(w.type==='missile')return d<12000;return false;}
function valuableTarget(t){const cls=(t.shipClass||'').toLowerCase();return cls==='carrier'||cls==='battleship'||cls==='cruiser'||(t.grid?.validCells?.length||0)>140;}
function maybeRevealForOpportunity(b,s){
 if(!s.playDead||!s.playDeadArmed)return;
 const masked=maskedModules(s),maskedWeapons=masked.filter(m=>['gun','laser','missile'].includes(m.type)&&m.hp>0&&!m.disabled);if(!maskedWeapons.length)return;
 const enemies=(b.ships||[]).filter(t=>!t.dead&&t.team!==s.team).sort((a,c)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(c.x-s.x,c.y-s.y));
 for(const t of enemies){const d=Math.hypot(t.x-s.x,t.y-s.y);if(d>2200||!valuableTarget(t))continue;const ready=maskedWeapons.filter(w=>weaponCanBear(s,w,t));if(!ready.length)continue;const n=revealPlayDeadSystems(s,ready.map(w=>w.id),`high-value target crossed concealed battery at ${Math.round(d)} m`);if(n)b.log(`${s.name}: LOCAL AMBUSH — ${t.name} crosses a concealed battery at close range. ${n} masked weapon system${n===1?'':'s'} open fire while other damage deception remains in place.`);return;}
}
function maybeSpringBoardingTrap(b,s){
 if(!s.playDead||!s.playDeadArmed)return;
 const nearest=inboundBoardingCraft(b,s)[0];if(!nearest)return;
 const maskedWeapons=maskedModules(s).filter(m=>['gun','laser','missile'].includes(m.type)&&m.hp>0&&!m.disabled),liveWeapons=(s.modules||[]).filter(m=>['gun','laser','missile'].includes(m.type)&&m.hp>0&&!m.disabled&&!s.playDeadMask?.includes(m.id));if(!maskedWeapons.length&&!liveWeapons.length)return;
 const credibility=playDeadCredibility(s),base=s.playDeadKillZone||2100,killZone=clamp(base*(.82+credibility*.22),1450,2550);if(nearest.d>killZone)return;
 if(maskedWeapons.length)revealPlayDeadSystems(s,maskedWeapons.map(m=>m.id),'boarding craft entered kill zone');
 s.playDeadTrapTargetUid=nearest.o.uid;s.playDeadTrapUntil=(b.t||0)+4.5;
 b.log(`${s.name}: BOARDING TRAP — ${nearest.o.name} entered the kill zone. Concealed defensive weapons come online; other masked damage may remain concealed.`);
}

Battle.prototype.applySystems=function(s,dt){
 s._simTime=this.t||s._simTime||0;if(!s.playDead)return BASE_APPLY.call(this,s,dt);
 const ids=new Set(s.playDeadMask||[]),suppressed=(s.modules||[]).filter(m=>ids.has(m.id)&&m.hp>0&&!m.disabled),savedDisabled=suppressed.map(m=>[m,m.disabled]),savedPower=suppressed.filter(m=>m.type==='reactor').map(m=>[m,m.power]);
 try{for(const[m]of savedDisabled)m.disabled=true;for(const[m,p]of savedPower){m.disabled=false;m.power=p*.07;}s.weaponStatus=ids.size?`playing ${ids.size} damaged system${ids.size===1?'':'s'} dead`:'no plausible damaged systems to mask';s.playDeadState={credibility:playDeadCredibility(s),apparent:true,masked:[...ids]};return BASE_APPLY.call(this,s,dt);}finally{for(const[m,d]of savedDisabled)m.disabled=d;for(const[m,p]of savedPower)m.power=p;}
};

Battle.prototype.step=function(dt){
 for(const s of this.ships||[]){s._simTime=this.t||0;if(!s.dead){maybeRevealForOpportunity(this,s);maybeSpringBoardingTrap(this,s)}}
 const out=BASE_STEP.call(this,dt);for(const s of this.ships||[]){s._simTime=this.t||0;recordState(s,s._simTime)}return out;
};

export function boardingAmbush(b,target,shuttle){
 if(!target?.playDeadArmed||!target.playDead)return null;
 const maskedWeapons=maskedModules(target).filter(m=>['gun','laser','missile'].includes(m.type));if(maskedWeapons.length)revealPlayDeadSystems(target,maskedWeapons.map(m=>m.id),'boarding craft reached hull');
 const marines=Math.max(1,shuttle.marines||1),lost=Math.max(1,Math.round(marines*.35));shuttle.marines=Math.max(0,marines-lost);
 b?.log?.(`${target.name}: concealed security teams ambush the surviving boarders at the breach. ${lost}/${marines} boarders lost.`);return{lost,survivors:shuttle.marines,credibility:playDeadCredibility(target)};
}

export function playDeadSummary(s){return{active:!!s.playDead,credibility:playDeadCredibility(s),masked:maskedModules(s).map(m=>({id:m.id,type:m.type,hp:m.hp,maxHp:m.maxHp,lastDamageAt:m._pdLastDamageAt,lastOperateAt:m._pdLastOperateAt}))};}
if(typeof window!=='undefined'){
 window.__setPlayDead=setPlayDead;window.__springPlayDead=springPlayDead;window.__revealPlayDeadSystems=revealPlayDeadSystems;window.__playDeadApparentReadiness=apparentReadiness;window.__playDeadCredibility=playDeadCredibility;window.__playDeadBoardingAmbush=boardingAmbush;window.__playDeadSummary=playDeadSummary;
}
