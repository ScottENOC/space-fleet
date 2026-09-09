import {MODULES} from './shipyard.js';
import {registerBattleHook} from './battle-hooks.js';

if(MODULES.shield_1)MODULES.shield_1.shieldHardening=6;
if(MODULES.shield_2)MODULES.shield_2.shieldHardening=24;
if(MODULES.shield_3)MODULES.shield_3.shieldHardening=58;
if(MODULES.armor_1)MODULES.armor_1.armorThreshold=.45;
if(MODULES.armor_2)MODULES.armor_2.armorThreshold=.80;
if(MODULES.armor_3)MODULES.armor_3.armorThreshold=1.22;

function inferredShieldHardening(m){if(Number.isFinite(m.shieldHardening))return m.shieldHardening;const c=m.capacity||0;return c>=1500?58:c>=500?24:6}
function inferredArmourThreshold(m){if(Number.isFinite(m.armorThreshold))return m.armorThreshold;const hp=m.maxHp||m.hp||0;return hp>=600?1.22:hp>=200?.80:.45}
function bestShield(t){return (t.modules||[]).filter(m=>m.type==='shield'&&m.hp>0&&!m.disabled&&(m.charge||0)>0).sort((a,b)=>inferredShieldHardening(b)-inferredShieldHardening(a))[0]||null}
function armourThreshold(t){const a=(t.modules||[]).filter(m=>m.type==='armor'&&m.hp>0&&!m.disabled);return a.reduce((mx,m)=>Math.max(mx,inferredArmourThreshold(m)),0)}
function inferredAttack(kind,damage,ray){if(ray.shieldHardness||ray.penetration)return{shield:ray.shieldHardness||1,pen:ray.penetration??1};if(kind==='shell')return damage<60?{shield:.55,pen:.75}:damage<150?{shield:.85,pen:1.05}:{shield:1.35,pen:1.55};if(kind==='missile')return damage<140?{shield:.95,pen:1.0}:damage<250?{shield:1.25,pen:1.2}:{shield:1.75,pen:1.45};if(kind==='laser')return damage<35?{shield:1.2,pen:.35}:damage<80?{shield:1.55,pen:.48}:{shield:2.05,pen:.62};return{shield:1,pen:ray.penetration??1}}

registerBattleHook('beforeHitRay','weapon-balance',(ctx)=>{
 let adjusted=ctx.damage;const atk=inferredAttack(ctx.kind,ctx.damage,ctx.ray),sh=bestShield(ctx.target);
 if(sh){const hardness=inferredShieldHardening(sh),usable=Math.max(0,ctx.damage*atk.shield-hardness);if(usable<=0){ctx.attacker.damageDone=(ctx.attacker.damageDone||0)+Math.min(ctx.damage*.02,1);ctx.cancel=true;return}adjusted=Math.min(ctx.damage,usable/Math.max(.25,atk.shield))}
 const threshold=armourThreshold(ctx.target),pen=atk.pen;
 if(!sh&&threshold>0&&pen<threshold){const ratio=Math.max(.05,pen/threshold);adjusted*=ratio*ratio;if(adjusted<1){ctx.cancel=true;return}}
 ctx.damage=adjusted;ctx.ray={...ctx.ray,penetration:pen,shieldHardness:atk.shield};
},50);
