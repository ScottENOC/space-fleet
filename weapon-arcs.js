import {Battle} from './sim.js';

const BASE_FIRE=Battle.prototype.fireWeapons;
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

// Normal fixed weapons may train +/-15 degrees from their mounted direction.
// Individual modules can override `arc` later for specialist turrets or spinal guns.
Battle.prototype.fireWeapons=function(s,e,powerBudget){
 if(!e||e.dead)return BASE_FIRE.call(this,s,e,powerBudget);
 const bearing=Math.atan2(e.y-s.y,e.x-s.x),restore=[];
 for(const w of s.modules){
   if(!['gun','laser'].includes(w.type)||w.hp<=0||w.disabled)continue;
   const arc=w.arc??Math.PI/12,aim=wrap(s.angle+(w.mountDir||0));
   if(Math.abs(wrap(bearing-aim))>arc){restore.push(w);w.disabled=true;}
 }
 try{return BASE_FIRE.call(this,s,e,powerBudget)}finally{for(const w of restore)w.disabled=false}
};
