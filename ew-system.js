import './ew-catalog.js';
import {registerBattleHook} from './battle-hooks.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const alive=(s,t)=>(s.modules||[]).filter(m=>m.type===t&&m.hp>0&&!m.disabled);

export const JAMMING_POSTURES={off:{label:'Jamming off',mode:'off'},defensive:{label:'Defensive jamming',mode:'defensive'},aggressive:{label:'Aggressive jamming',mode:'aggressive'}};
export const DECOY_POSTURES={conserve:{label:'Conserve decoys',trigger:2,cooldown:10},standard:{label:'Automatic decoys',trigger:1,cooldown:6},liberal:{label:'Liberal decoys',trigger:1,cooldown:3}};
function hostileThreatNearby(b,s){return (b.ordnance||[]).some(o=>o.team!==s.team&&o.kind==='missile'&&o.hp>0&&dist(o,s)<5200)}
function jammerPower(s){return alive(s,'jammer').reduce((n,m)=>n+(m.powerUse||0),0)}
function jammerStrength(s){return alive(s,'jammer').reduce((n,m)=>n+(m.jamStrength||0)*(m.hp/Math.max(1,m.maxHp||m.hp)),0)}
function jammerRange(s){return alive(s,'jammer').reduce((n,m)=>Math.max(n,m.jamRange||0),0)}
function shouldJam(b,s){const p=s.jammingPosture||'off';if(p==='aggressive')return !!alive(s,'jammer').length&&!s.runSilent;if(p==='defensive')return hostileThreatNearby(b,s)&&!s.runSilent;return false}
function applyJamming(b,s){s.ewJammingActive=false;s.ewJamStrength=0;s.ewJamRange=0;if(!shouldJam(b,s))return;const need=jammerPower(s),before=s.powerBus?.usedMW||0,ok=!s.requestPower||s.requestPower(need,'ew'),supplied=s.powerBus?Math.max(0,(s.powerBus.usedMW||0)-before):need,frac=need>0?clamp(supplied/need,0,1):(ok?1:0);if(frac>.15){s.ewJammingActive=true;s.ewJamStrength=jammerStrength(s)*frac;s.ewJamRange=jammerRange(s)}if(s.powerState&&s.powerBus){s.powerState.demandMW=s.powerBus.usedMW;s.powerState.requestedMW=s.powerBus.requestedMW;s.powerState.unmetMW=s.powerBus.unmetMW;s.powerState.groups=s.powerBus.groups}}
function decoyLaunchers(s){return alive(s,'decoy').filter(m=>(m.ammo||0)>0&&(m.cooldownLeft||0)<=0)}
function incomingMissiles(b,s){return (b.ordnance||[]).filter(o=>o.kind==='missile'&&o.team!==s.team&&o.hp>0&&o.target===s).sort((a,c)=>dist(a,s)-dist(c,s))}
function launchDecoy(b,s,m){if((m.ammo||0)<=0)return false;m.ammo--;m.cooldownLeft=m.cooldown||5.5;b.ordnance??=[];const a=(s.angle||0)+(Math.random()-.5)*1.6,speed=35+Math.random()*30,id=`decoy:${s.uid}:${Math.round(b.t*10)}:${Math.random().toString(36).slice(2,5)}`;b.ordnance.push({kind:'decoy',uid:id,team:s.team,owner:s,x:s.x,y:s.y,vx:s.vx+Math.cos(a)*speed,vy:s.vy+Math.sin(a)*speed,hp:12,maxHp:12,r:1.2,ttl:9+Math.random()*5,decoyStrength:m.decoyStrength||1,emission:18+(m.decoyStrength||1)*18});b.log(`${s.name}: decoy deployed.`);return true}
function maybeAutoDecoys(b,s){if(s.runSilent)return;const posture=DECOY_POSTURES[s.decoyPosture||'standard']||DECOY_POSTURES.standard,missiles=incomingMissiles(b,s);if(missiles.length<posture.trigger)return;s._decoyClock??=0;if(b.t<s._decoyClock)return;const launcher=decoyLaunchers(s)[0];if(launcher&&launchDecoy(b,s,launcher))s._decoyClock=b.t+posture.cooldown}
function seductionScore(m,d){const range=Math.max(80,dist(m,d)),strength=d.decoyStrength||1,angleBias=1/(1+range/2500);return strength*angleBias*(.75+Math.random()*.55)}
function maybeSeduceMissile(b,m){if(m.kind!=='missile'||m.hp<=0||m.targetOrdnance)return;const target=m.target;if(!target||target.dead)return;const decoys=(b.ordnance||[]).filter(o=>o.kind==='decoy'&&o.team===target.team&&o.hp>0&&dist(o,m)<4200);if(!decoys.length)return;const best=decoys.map(d=>({d,s:seductionScore(m,d)})).sort((a,c)=>c.s-a.s)[0],targetLock=.85+((target.sensorPowerFraction||1)*.3);if(best.s>targetLock){m.targetOrdnance=best.d;m.target=null;m.decoyed=true;b.log(`${m.owner?.name||'Missile'}: guidance diverted by decoy.`)}}
function updateDecoys(b,dt){for(const d of b.ordnance||[])if(d.kind==='decoy'&&d.hp>0){d.x+=d.vx*dt;d.y+=d.vy*dt;d.vx*=.999;d.vy*=.999}}

registerBattleHook('afterApplySystems','ew-jamming',({battle,ship})=>applyJamming(battle,ship),40);
registerBattleHook('beforeProjectiles','ew-missile-seduction',({battle})=>{for(const m of battle.ordnance||[])maybeSeduceMissile(battle,m)},40);
registerBattleHook('afterProjectiles','ew-decoy-motion',({battle,dt})=>updateDecoys(battle,dt),40);
registerBattleHook('beforeStep','ew-auto-decoys',({battle})=>{for(const s of battle.ships||[])if(!s.dead)maybeAutoDecoys(battle,s)},40);

export function setJammingPosture(s,id){if(JAMMING_POSTURES[id])s.jammingPosture=id;return s.jammingPosture||'off'}
export function setDecoyPosture(s,id){if(DECOY_POSTURES[id])s.decoyPosture=id;return s.decoyPosture||'standard'}
export function ewSummary(s){return{jammingActive:!!s.ewJammingActive,jammingPosture:s.jammingPosture||'off',jamStrength:s.ewJamStrength||0,jamRange:s.ewJamRange||0,decoyPosture:s.decoyPosture||'standard',decoys:alive(s,'decoy').reduce((n,m)=>n+(m.ammo||0),0)}}
if(typeof window!=='undefined'){window.__setJammingPosture=setJammingPosture;window.__setDecoyPosture=setDecoyPosture;window.__ewSummary=ewSummary}
