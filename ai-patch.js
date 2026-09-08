import {Battle} from './sim.js';

const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const dot=(ax,ay,bx,by)=>ax*bx+ay*by;

// Temporary controller layer kept separate while combat physics remains under active development.
// Broadside ships choose a side once per engagement instead of flipping sides whenever the
// target crosses the bow, which previously created 180-degree desired-heading jumps.
Battle.prototype.ai=function(s,e){
  if(!e||e.dead)return;
  const dx=e.x-s.x,dy=e.y-s.y,d=Math.hypot(dx,dy),bearing=Math.atan2(dy,dx);
  const rvx=e.vx-s.vx,rvy=e.vy-s.vy,closing=dot(rvx,rvy,dx/(d||1),dy/(d||1));
  if(s.ai==='broadside'){
    if(s.preferredBroadsideSide==null)s.preferredBroadsideSide=wrap(bearing-s.angle)>=0?1:-1;
    s.desiredAngle=wrap(bearing-s.preferredBroadsideSide*Math.PI/2);
    s.throttle=d>2300?.78:d<1100?-.25:.18;
    s.order=d>2300?'Close to gunnery range':d<1100?'Open the range':`Hold ${s.preferredBroadsideSide>0?'starboard':'port'} broadside`;
  }else{
    s.desiredAngle=bearing;
    s.throttle=d>1900?1:d<650?-.55:.34;
    s.order=d<650?'Brake and avoid overshoot':Math.abs(closing)>900?'Match vector':'Keep bow on target';
  }
};
