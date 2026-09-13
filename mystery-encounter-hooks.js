import {campaign} from './campaign-core.js';
import {addEvidence,investigationState} from './mystery-system.js?v=73';

let seen=(campaign.log||[]).length;
function inspectNewLogEntries(){
 const log=campaign.log||[];if(log.length<seen)seen=0;
 const fresh=log.slice(seen);seen=log.length;if(campaign.location!=='Nadir')return;
 for(const line of fresh){
  if(/surveyed the uncharted signal/i.test(line)&&Math.random()<.45)addEvidence('pirateAvoidance','An outer-system survey also confirmed that experienced traffic avoids the same unmarked volume.');
  if(/salvaged the derelict/i.test(line)&&Math.random()<.35){const s=investigationState();addEvidence(s.truth==='gateEcho'?'clockDrift':'cutHull','Recovered during an otherwise routine salvage operation in Nadir.');}
 }
}
setInterval(inspectNewLogEntries,500);
