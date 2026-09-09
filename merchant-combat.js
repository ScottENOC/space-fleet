import {Battle} from './sim.js';

// Trading Hulks are cheap volume, not naval architecture. Their frames lack the
// compartmentalisation, redundant services and hardened internal structure assumed
// by purpose-built combat hulls. Shields/armour still work normally; damage that gets
// through to the ship is amplified.
const baseHitRay=Battle.prototype.hitRay;
Battle.prototype.hitRay=function(attacker,target,damage,kind,ray){
  const mult=target?.civilianHull?(target.structuralDamageMultiplier||1):1;
  return baseHitRay.call(this,attacker,target,damage*mult,kind,ray);
};
