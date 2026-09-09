import {G} from './sim.js';
import {registerBattleHook} from './battle-hooks.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const rot=(x,y,a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
const cross=(ax,ay,bx,by)=>ax*by-ay*bx;

const PROFILES={
 gun:{light:{tracking:1.55,ideal:'small',shieldHardness:.55,armorPen:.75},medium:{tracking:.95,ideal:'medium',shieldHardness:.85,armorPen:1.05},heavy:{tracking:.48,ideal:'large',shieldHardness:1.35,armorPen:1.55}},
 laser:{light:{tracking:2.15,ideal:'small',shieldHardness:1.20,armorPen:.35},medium:{tracking:1.25,ideal:'medium',shieldHardness:1.55,armorPen:.48},heavy:{tracking:.62,ideal:'large',shieldHardness:2.05,armorPen:.62}},
 missile:{light:{tracking:1.45,ideal:'small',shieldHardness:.95,armorPen:1.0},medium:{tracking:1.0,ideal:'medium',shieldHardness:1.25,armorPen:1.2},heavy:{tracking:.68,ideal:'large',shieldHardness:1.75,armorPen:1.45}}
};
function sizeClass(w){const d=w.damage||0;if(w.type==='gun')return d<60?'light':d<150?'medium':'heavy';if(w.type==='laser')return d<35?'light':d<80?'medium':'heavy';if(w.type==='missile')return d<140?'light':d<250?'medium':'heavy';return'medium'}
function profile(w){return PROFILES[w.type]?.[sizeClass(w)]||PROFILES.gun.medium}
function targetScale(t){const cells=t.grid?.validCells?.length||20;return cells<55?'small':cells<220?'medium':'large'}
function aliveShield(t){return (t.modules||[]).filter(m=>m.type==='shield'&&m.hp>0&&!m.disabled&&(m.charge||0)>0)}
function shieldState(t){const ss=aliveShield(t),charge=ss.reduce((n,m)=>n+(m.charge||0),0),cap=ss.reduce((n,m)=>n+(m.capacity||0),0),regen=ss.reduce((n,m)=>n+(m.recharge||0),0),hard=ss.reduce((n,m)=>n+(m.shieldHardening||0),0);return{charge,cap,regen,hard,frac:cap?charge/cap:0}}
function armourFactor(t){const as=(t.modules||[]).filter(m=>m.type==='armor'&&m.hp>0&&!m.disabled);if(!as.length)return 0;return as.reduce((n,m)=>n+(m.absorb||.68),0)/as.length}
function angularRate(s,t){const dx=t.x-s.x,dy=t.y-s.y,r2=Math.max(1,dx*dx+dy*dy),rvx=(t.vx||0)-(s.vx||0),rvy=(t.vy||0)-(s.vy||0);return Math.abs(cross(dx,dy,rvx,rvy)/r2)+(Math.abs(t.omega||0)*.35)}
function inArc(s,w,t){const bearing=Math.atan2(t.y-s.y,t.x-s.x),aim=wrap(s.angle+(w.mountDir||0)),arc=w.arc||Math.PI/12;return Math.abs(wrap(bearing-aim))<=arc}
function inRange(s,w,t){const d=dist(s,t);if(w.type==='laser')return d<=(w.range||9000);if(w.type==='gun')return d<=Math.max(3500,(w.muzzle||1250)*5.2);if(w.type==='missile')return d<=Math.max(5000,(w.missileFuel||9)*(Math.max(120,(w.missileThrust||85000)/320))*1.55);return false}
function sensorQuality(b,s,t){return window.__sensorGetContact?.(b,s.team,t.uid)?.quality??1}
function mainTarget(b,s){const enemies=b.ships.filter(t=>!t.dead&&t.team!==s.team);return enemies.find(t=>t.uid===s.commandTargetId)||b.enemy(s)||null}
function targetValue(b,s,w,t,main){if(t.dead||t.team===s.team||!inArc(s,w,t)||!inRange(s,w,t))return-Infinity;const q=sensorQuality(b,s,t);if(q<.08)return-Infinity;const p=profile(w),scale=targetScale(t),ang=angularRate(s,t),trackScore=clamp(1-ang/Math.max(.05,p.tracking),0,1),sh=shieldState(t),arm=armourFactor(t);let score=1;if(t===main)score+=2.6;if(scale===p.ideal)score+=.65;else if((scale==='small'&&p.ideal==='large')||(scale==='large'&&p.ideal==='small'))score-=.9;score+=trackScore*1.4-(1-trackScore)*1.8;score+=q*.45;const d=dist(s,t);score+=clamp(1-d/Math.max(1,w.range||12000),0,.45);if(sh.charge>0){const effective=(w.damage||0)*p.shieldHardness,perHitFloor=sh.hard||Math.max(0,sh.regen*.10);if(effective<=perHitFloor*1.05)score-=4.5;else if(effective<perHitFloor*1.7)score-=1.4;if(w.type==='laser')score+=.7}if(arm>.70&&p.armorPen<.8)score-=2.6;if(w.type==='missile'){if((w.ammo||0)<=2)score-=.9;if(scale==='small'&&sizeClass(w)==='heavy')score-=1.1}if(t!==main&&d<1800&&sh.charge<=0)score+=1.35;return score}
function chooseTarget(b,s,w,main){let best=null,bestScore=-Infinity;for(const t of b.ships){const score=targetValue(b,s,w,t,main);if(score>bestScore){bestScore=score;best=t}}return bestScore>=.15?best:null}
function chooseModule(s,t){const alive=(t.modules||[]).filter(m=>m.hp>0&&!m.disabled);for(const p of s.targetPriority||[]){const type=p==='weapons'?['gun','laser','missile']:[p],m=alive.find(x=>type.includes(x.type));if(m)return m}return alive.find(m=>m.type!=='hull')||alive[0]||null}
function worldPoint(s,m){const [x,y]=rot(m.x||0,m.y||0,s.angle);return{x:s.x+x,y:s.y+y}}
function pay(s,w,kind='offence'){if(!s.requestPower||!(w.powerUse>0))return true;const ok=s.requestPower(w.powerUse,kind);if(ok)w._powerPaidBus=s.powerBus;return ok}
function launchMissile(b,s,w,t){if((w.ammo||0)<=0||!pay(s,w))return false;const p=worldPoint(s,w),a=Math.atan2(t.y-s.y,t.x-s.x),speed=170;b.ordnance??=[];b.ordnance.push({kind:'missile',team:s.team,owner:s,x:p.x,y:p.y,vx:s.vx+Math.cos(a)*speed,vy:s.vy+Math.sin(a)*speed,angle:a,hp:w.missileHp||24,maxHp:w.missileHp||24,damage:w.damage||100,fuel:w.missileFuel||9,accel:Math.max(120,(w.missileThrust||85000)/320),turnRate:1.9,target:t,targetOrdnance:null,r:1.3,ttl:42,penetration:profile(w).armorPen,shieldHardness:profile(w).shieldHardness});w.ammo--;w.cooldownLeft=w.cooldown||4;s.shots++;return true}
function fireLaser(b,s,w,t){if(!pay(s,w))return false;const m=chooseModule(s,t);if(!m)return false;const p=worldPoint(t,m);b.hitRay(s,t,w.damage,'laser',{x:s.x,y:s.y,dx:p.x-s.x,dy:p.y-s.y,penetration:w.penetration||profile(w).armorPen,shieldHardness:profile(w).shieldHardness});w.cooldownLeft=w.cooldown||.8;s.shots++;s.hits++;return true}
function fireGun(b,s,w,t){if((w.ammo||0)<=0||!pay(s,w))return false;const m=chooseModule(s,t),tp=m?worldPoint(t,m):{x:t.x,y:t.y},dx=tp.x-s.x,dy=tp.y-s.y,d=Math.hypot(dx,dy),flight=d/Math.max(1,w.muzzle||1250),tx=tp.x+((t.vx||0)-(s.vx||0))*flight,ty=tp.y+((t.vy||0)-(s.vy||0))*flight,ang=Math.atan2(ty-s.y,tx-s.x),aim=wrap(s.angle+(w.mountDir||0)),arc=w.arc||Math.PI/12;if(Math.abs(wrap(ang-aim))>arc)return false;const p=worldPoint(s,w),rvx=Math.cos(ang)*(w.muzzle||1250),rvy=Math.sin(ang)*(w.muzzle||1250),mass=w.projectileMass||8;b.projectiles.push({team:s.team,owner:s,x:p.x,y:p.y,vx:s.vx+rvx,vy:s.vy+rvy,mass,damage:w.damage,penetration:w.penetration||profile(w).armorPen,shieldHardness:profile(w).shieldHardness,r:1.2,ttl:G.projectileTTL,targetId:m?.id});const ix=-mass*rvx,iy=-mass*rvy;s.vx+=ix/s.mass;s.vy+=iy/s.mass;w.ammo--;w.cooldownLeft=w.cooldown||1.2;s.shots++;return true}

registerBattleHook('beforeFireWeapons','weapon-employment',(ctx)=>{const b=ctx.battle,s=ctx.ship,main=mainTarget(b,s);ctx.handled=true;if(!main)return;const report=[];for(const w of (s.modules||[]).filter(m=>['gun','laser','missile'].includes(m.type)&&m.hp>0&&!m.disabled&&(m.cooldownLeft||0)<=0)){const t=chooseTarget(b,s,w,main);if(!t)continue;let fired=false;if(w.type==='gun')fired=fireGun(b,s,w,t);else if(w.type==='laser')fired=fireLaser(b,s,w,t);else fired=launchMissile(b,s,w,t);if(fired)report.push({weapon:w.id||w.name,target:t.uid,main:t===main})}s.weaponEmployment=report;},0);

if(typeof window!=='undefined')window.__weaponProfile=profile;
