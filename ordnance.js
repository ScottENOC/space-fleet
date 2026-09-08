import {Battle} from './sim.js';

const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rot=(x,y,a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const BASE_FIRE=Battle.prototype.fireWeapons;
const BASE_UPDATE=Battle.prototype.updateProjectiles;
const BASE_HIT=Battle.prototype.hitRay;
const GROUP=m=>['gun','laser','missile','fighterBay'].includes(m.type)?'weapons':m.type;

function worldPoint(s,m){const [x,y]=rot(m.x,m.y,s.angle);return{x:s.x+x,y:s.y+y}}
function aliveEnemies(b,s){return b.ships.filter(o=>!o.dead&&o.team!==s.team)}
function chosenEnemy(b,s){const es=aliveEnemies(b,s);return es.find(e=>e.uid===s.commandTargetId)||es.sort((a,c)=>dist(a,s)-dist(c,s))[0]||null}
function chosenModule(attacker,target){
 const alive=target.modules.filter(m=>m.hp>0&&!m.disabled);
 for(const p of attacker.targetPriority||[]){const m=alive.find(x=>GROUP(x)===p);if(m)return m}
 return alive.find(m=>m.type!=='hull')||alive[0];
}
function launchMissile(b,s,m,target,targetOrdnance=null){
 b.ordnance??=[];
 const p=worldPoint(s,m),a=s.angle+(m.mountDir||0),speed=170;
 b.ordnance.push({kind:'missile',team:s.team,owner:s,x:p.x,y:p.y,vx:s.vx+Math.cos(a)*speed,vy:s.vy+Math.sin(a)*speed,angle:a,hp:m.missileHp||24,maxHp:m.missileHp||24,damage:m.damage||100,fuel:m.missileFuel||9,accel:Math.max(120,(m.missileThrust||85000)/320),turnRate:1.9,target,targetOrdnance,r:1.3,ttl:42});
 m.ammo--;m.cooldownLeft=m.cooldown||4;
}
function launchFighter(b,s,bay,target){
 b.ordnance??=[];if(bay.fightersRemaining==null)bay.fightersRemaining=bay.fighters||0;if(bay.fightersRemaining<=0)return;
 const p=worldPoint(s,bay),a=s.angle+(bay.mountDir||0),n=(bay.fighters||4)-bay.fightersRemaining+1;
 b.ordnance.push({kind:'fighter',team:s.team,owner:s,name:`${s.name} fighter ${n}`,x:p.x,y:p.y,vx:s.vx+Math.cos(a)*95,vy:s.vy+Math.sin(a)*95,angle:a,hp:44,maxHp:44,accel:115,turnRate:3.4,target,r:2.1,ttl:150,shotCooldown:.4,fuel:95});
 bay.fightersRemaining--;bay.cooldownLeft=bay.launchCooldown||3.5;
}

// Lasers are exceptionally easy for shields to absorb: one point of shield charge
// cancels three points of laser damage. Once the shield is exhausted the beam uses
// the normal physical grid traversal and its relatively low penetration.
Battle.prototype.hitRay=function(attacker,target,damage,kind,ray){
 if(kind==='laser'){
   const sh=target.modules.find(m=>m.type==='shield'&&m.hp>0&&!m.disabled&&(m.charge||0)>0);
   if(sh){const absorbed=Math.min(damage,sh.charge*3);sh.charge-=absorbed/3;attacker.damageDone+=absorbed*.05;damage-=absorbed;if(damage<=0)return;}
 }
 return BASE_HIT.call(this,attacker,target,damage,kind,ray);
};

// Guns and lasers retain the normal ship-fire logic. Missile batteries and fighter
// bays add their own launches afterwards. Missile launchers need roughly +/-15 deg.
Battle.prototype.fireWeapons=function(s,e,powerBudget){
 const result=BASE_FIRE.call(this,s,e,powerBudget);
 e=e&&!e.dead?e:chosenEnemy(this,s);if(!e)return result;
 const bearing=Math.atan2(e.y-s.y,e.x-s.x);
 for(const m of s.modules){
   if(m.hp<=0||m.disabled||(m.cooldownLeft||0)>0)continue;
   if(m.type==='missile'&&(m.ammo||0)>0){
     const aim=wrap(s.angle+(m.mountDir||0)),arc=m.arc||Math.PI/12;
     if(Math.abs(wrap(bearing-aim))<=arc)launchMissile(this,s,m,e);
   }else if(m.type==='fighterBay'){
     launchFighter(this,s,m,e);
   }
 }
 return result;
};

function steer(o,target,dt){
 if(!target)return;
 const wanted=Math.atan2(target.y-o.y,target.x-o.x),err=wrap(wanted-o.angle),turn=clamp(err,-o.turnRate*dt,o.turnRate*dt);o.angle=wrap(o.angle+turn);
 if(o.fuel>0){o.vx+=Math.cos(o.angle)*o.accel*dt;o.vy+=Math.sin(o.angle)*o.accel*dt;o.fuel=Math.max(0,o.fuel-dt)}
}
function damageOrdnance(o,damage){o.hp-=damage;return o.hp<=0}
function pointDefence(b,dt){
 for(const s of b.ships){if(s.dead)continue;const hostiles=b.ordnance.filter(o=>o.team!==s.team&&o.hp>0&&dist(o,s)<2600);if(!hostiles.length)continue;
   hostiles.sort((a,c)=>dist(a,s)-dist(c,s));
   for(const w of s.modules){if(w.hp<=0||w.disabled||(w.cooldownLeft||0)>0)continue;if(!['gun','laser','missile'].includes(w.type))continue;
     const o=hostiles.find(x=>x.hp>0);if(!o)break;const bearing=Math.atan2(o.y-s.y,o.x-s.x),aim=wrap(s.angle+(w.mountDir||0)),arc=(w.arc||Math.PI/12)*1.4;if(Math.abs(wrap(bearing-aim))>arc)continue;
     const d=dist(o,s);if(w.type==='laser'&&d<Math.min(w.range||9000,3500)){damageOrdnance(o,(w.damage||20)*1.8);w.cooldownLeft=w.cooldown||.8;s.shots++;}
     else if(w.type==='gun'&&(w.ammo||0)>0&&d<2300){damageOrdnance(o,(w.damage||40)*.9);w.ammo--;w.cooldownLeft=w.cooldown||1.3;s.shots++;}
     else if(w.type==='missile'&&(w.ammo||0)>0&&d<5000){launchMissile(b,s,w,null,o);}
   }
 }
}
function fighterAttack(b,f,dt){
 f.shotCooldown=Math.max(0,f.shotCooldown-dt);const hostileOrdnance=b.ordnance.filter(o=>o!==f&&o.team!==f.team&&o.hp>0&&dist(o,f)<900).sort((a,c)=>dist(a,f)-dist(c,f))[0];
 if(hostileOrdnance&&f.shotCooldown<=0){damageOrdnance(hostileOrdnance,24);f.shotCooldown=.45;return}
 let target=f.target;if(!target||target.dead)target=aliveEnemies(b,f.owner)[0];f.target=target;if(!target)return;
 if(dist(f,target)<720&&f.shotCooldown<=0){const m=chosenModule(f.owner,target);if(m){const [rx,ry]=rot(m.x,m.y,target.angle),tx=target.x+rx,ty=target.y+ry;b.hitRay(f.owner,target,18,'fighter',{x:f.x,y:f.y,dx:tx-f.x,dy:ty-f.y,penetration:.85});f.shotCooldown=.38;}}
}
function updateOrdnance(b,dt){
 b.ordnance??=[];pointDefence(b,dt);
 for(const o of b.ordnance){if(o.hp<=0)continue;o.ttl-=dt;
   if(o.kind==='missile'){
     const t=o.targetOrdnance&&o.targetOrdnance.hp>0?o.targetOrdnance:(!o.target?.dead?o.target:null);steer(o,t,dt);o.x+=o.vx*dt;o.y+=o.vy*dt;
     if(t&&dist(o,t)<(t.r||t.radius||8)+4){if(o.targetOrdnance){damageOrdnance(t,o.damage*.8)}else{b.hitRay(o.owner,t,o.damage,'missile',{x:o.x,y:o.y,dx:o.vx-t.vx,dy:o.vy-t.vy,penetration:1.3})}o.hp=0;}
   }else if(o.kind==='fighter'){
     let t=o.target;if(!t||t.dead)t=aliveEnemies(b,o.owner)[0];o.target=t;if(t)steer(o,t,dt);o.x+=o.vx*dt;o.y+=o.vy*dt;fighterAttack(b,o,dt);
   }
 }
 b.ordnance=b.ordnance.filter(o=>o.hp>0&&o.ttl>0);
}
Battle.prototype.updateProjectiles=function(dt){BASE_UPDATE.call(this,dt);updateOrdnance(this,dt)};
