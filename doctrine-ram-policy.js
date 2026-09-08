import {Battle} from './sim.js';

const baseAI=Battle.prototype.ai;
function enemyFor(b,s,e){if(e&&!e.dead)return e;return b.ships.filter(o=>!o.dead&&o.team!==s.team).sort((a,c)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(c.x-s.x,c.y-s.y))[0]||null;}
Battle.prototype.ai=function(s,e){
  baseAI.call(this,s,e);
  const policy=s.ramPolicy||'discretion';
  if(policy==='avoid'){s.ramIntent=false;return;}
  if(policy!=='ram')return;
  const target=enemyFor(this,s,e);if(!target){s.ramIntent=false;return;}
  s.ramIntent=true;s.commandTargetId=target.uid;
  s.desiredAngle=Math.atan2(target.y-s.y,target.x-s.x);s.throttle=1;s.order=`RAM ${target.name}`;
};
