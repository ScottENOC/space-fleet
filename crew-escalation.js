import {registerBattleHook} from './battle-hooks.js';
import {applyDoctrine} from './doctrine-system.js';

function captainOf(s){return s?.crew?.captain||{title:'Captain',name:'Captain'}}
function followupText(r,s){
 const q=r.request||{};
 if(q.type==='fallBack')return `We are being cut to pieces. I need permission to break off now; if I hear nothing, I will preserve the ship and withdraw.`;
 if(q.type==='doctrine'&&q.value==='codeRed')return `Missiles are still inbound. We cannot wait on this. I need Code Red now; absent orders, I will take defensive action.`;
 if(q.type==='powerEngines')return `Propulsion is still starved of power. Give me engines now or I will reallocate power locally.`;
 if(q.type==='formationDiscipline')return `We cannot hold station in this condition. Release us from formation or I will manoeuvre independently.`;
 if(q.type==='defenceFirst')return `Our remaining craft are being squandered. I need authority to preserve the reserve or I will pull them back myself.`;
 if(q.type==='laserReserve')return `Battery state is deteriorating. Unless countermanded, I am going to conserve offensive beams.`;
 return `This situation is worsening. I need a decision now; if no order arrives, I will act to preserve ${s?.name||'the ship'}.`;
}
function applyAutonomous(s,q){
 if(!s||!q)return false;
 if(q.type==='formationDiscipline'){s.formationDiscipline=q.value;return true}
 if(q.type==='powerEngines'){const base=s.powerPriority||['shieldMaintain','engines','shieldRecharge','weapons','storageRecharge'];s.powerPriority=['shieldMaintain','engines',...base.filter(x=>!['shieldMaintain','engines'].includes(x))];return true}
 if(q.type==='doctrine'){applyDoctrine(s,q.value);return true}
 if(q.type==='fallBack'){s.fallBackRequested=true;return true}
 if(q.type==='laserReserve'){s.laserMinStorageFraction=q.value;return true}
 if(q.type==='defenceFirst'){s.defencePriority=['missile','fighter'];s.reserveDefenceMW=Math.max(s.reserveDefenceMW||0,18e6);s.fighterReserveFraction=Math.max(s.fighterReserveFraction??.25,.5);return true}
 return false;
}
function escalate(b){
 const now=b.t||0;
 for(const r of b.crewInbox||[]){
  if(!r.request||r.status!=='open')continue;
  const s=b.ships?.find(x=>x.uid===r.shipUid);if(!s||s.dead)continue;
  const age=now-(r.t||0);
  if((r.severity||0)>=4&&age>=7&&!r.followedUpAt){
   const c=captainOf(s);r.followedUpAt=now;r.severity=Math.max(5,r.severity||0);r.role='captain';r.title=c.title||'Captain';r.officer=c.name||'Captain';r.text=followupText(r,s);b.log(`${s.name} ${r.title}: ${r.text}`);
  }
  if((r.severity||0)>=5&&age>=15&&!r.autonomousAt){
   r.autonomousAt=now;
   if(applyAutonomous(s,r.request)){r.status='acted';const c=captainOf(s);b.log(`${s.name} ${c.title}: No reply received. I am acting on my authority: ${r.request.label||'emergency action'}.`)}
  }
 }
}

registerBattleHook('afterStep','crew-unanswered-escalation',({battle})=>escalate(battle),-20);
