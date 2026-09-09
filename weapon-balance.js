import {Battle} from './sim.js';
import {MODULES} from './shipyard.js';

// Larger defensive systems are not just larger HP pools: they resist weak individual hits.
if(MODULES.shield_1)MODULES.shield_1.shieldHardening=6;
if(MODULES.shield_2)MODULES.shield_2.shieldHardening=24;
if(MODULES.shield_3)MODULES.shield_3.shieldHardening=58;
if(MODULES.armor_1)MODULES.armor_1.armorThreshold=.45;
if(MODULES.armor_2)MODULES.armor_2.armorThreshold=.80;
if(MODULES.armor_3)MODULES.armor_3.armorThreshold=1.22;

const BASE_HIT=Battle.prototype.hitRay;
function bestShield(t){return (t.modules||[]).filter(m=>m.type==='shield'&&m.hp>0&&!m.disabled&&(m.charge||0)>0).sort((a,b)=>(b.shieldHardening||0)-(a.shieldHardening||0))[0]||null}
function armourThreshold(t){const a=(t.modules||[]).filter(m=>m.type==='armor'&&m.hp>0&&!m.disabled);return a.reduce((mx,m)=>Math.max(mx,m.armorThreshold||0),0)}
Battle.prototype.hitRay=function(attacker,target,damage,kind,ray={}){
 let adjusted=damage;
 const sh=bestShield(target);
 if(sh){
   const hardness=sh.shieldHardening||0,attackFactor=ray.shieldHardness||1,usable=Math.max(0,damage*attackFactor-hardness);
   if(usable<=0){attacker.damageDone=(attacker.damageDone||0)+Math.min(damage*.02,1);return}
   // Convert back to ordinary damage units before the existing shield interaction.
   adjusted=Math.min(damage,usable/Math.max(.25,attackFactor));
 }
 const threshold=armourThreshold(target),pen=ray.penetration??1;
 if(!sh&&threshold>0&&pen<threshold){
   const ratio=Math.max(.05,pen/threshold);
   adjusted*=ratio*ratio;
   if(adjusted<1)return;
 }
 return BASE_HIT.call(this,attacker,target,adjusted,kind,ray);
};
