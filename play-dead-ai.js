import {Battle} from './sim.js';

const BASE_FIRE=Battle.prototype.fireWeapons;

function contact(b,s,t){return typeof window!=='undefined'?window.__sensorGetContact?.(b,s.team,t.uid):null}

// Offensive fire normally ignores contacts assessed as combat-ineffective. This does not
// suppress point defence: incoming missiles, fighters and boarding craft remain threats.
Battle.prototype.fireWeapons=function(s,e,powerBudget){
 const hidden=[];
 if(!s.finishDisabledTargets){
   for(const t of this.ships||[]){
     if(t.dead||t.team===s.team)continue;
     const c=contact(this,s,t);
     if(c?.apparentlyDisabled&&c.quality>=.25){hidden.push([t,t.dead]);t.dead=true;}
   }
 }
 try{return BASE_FIRE.call(this,s,e,powerBudget)}finally{for(const[t,d]of hidden)t.dead=d}
};
