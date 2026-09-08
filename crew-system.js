import {Battle} from './sim.js';
import {applyDoctrine} from './doctrine-system.js';

const ROLES={
 captain:'Captain',helm:'Helmsman',engineer:'Chief Engineer',weapons:'Chief Gunner',tactical:'Tactical Officer',damage:'Damage Control Officer',xo:'Executive Officer',cag:'CAG'
};
const FIRST=['Mara','Ilya','Chen','Sato','Avery','Singh','Vega','Okafor','Nakamura','Hale','Rossi','Khan','Nguyen','Morgan','Silva','Parker'];
const LAST=['Vale','Mercer','Navarro','Ishikawa','Reyes','Bennett','Stone','Armitage','Das','Kovacs','Hart','Zhou','Price','Mori','Ellis','Ward'];
const hash=s=>[...String(s)].reduce((n,c)=>(n*33+c.charCodeAt(0))>>>0,5381);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function crewName(seed,role){const h=hash(seed+role);return `${FIRST[h%FIRST.length]} ${LAST[(h>>>5)%LAST.length]}`;}
export function ensureCrew(ship){
 if(ship.crew)return ship.crew;
 const roles=['captain','helm','engineer','weapons','tactical','damage','xo'];
 if(ship.modules?.some(m=>m.type==='fighterBay'))roles.push('cag');
 ship.crew=Object.fromEntries(roles.map(r=>[r,{role:r,title:ROLES[r],name:crewName(ship.uid||ship.name,r),skill:.75+(hash((ship.uid||ship.name)+r+'skill')%21)/100,stress:0}]));
 ship.crewReports=[];ship.crewReportCooldowns={};
 return ship.crew;
}
function maxHpFraction(s){const ms=s.modules.filter(m=>(m.maxHp||m.hp)>0);const max=ms.reduce((n,m)=>n+(m.maxHp||m.hp||0),0)||1;return ms.reduce((n,m)=>n+Math.max(0,m.hp||0),0)/max;}
function engineFraction(s){const es=s.modules.filter(m=>m.type==='engine');if(!es.length)return 0;const max=es.reduce((n,m)=>n+(m.maxHp||m.hp||0),0)||1;return es.reduce((n,m)=>n+Math.max(0,m.hp||0),0)/max;}
function shieldFraction(s){const sh=s.modules.filter(m=>m.type==='shield'&&m.hp>0);if(!sh.length)return 1;const cap=sh.reduce((n,m)=>n+(m.capacity||0),0)||1;return sh.reduce((n,m)=>n+(m.charge||0),0)/cap;}
function batteryFraction(s){const p=s.powerState;if(!p?.maxMWh)return 1;return clamp(p.storedMWh/p.maxMWh,0,1);}
function incoming(b,s,kind=null,range=2400){return (b.ordnance||[]).filter(o=>o.team!==s.team&&o.hp>0&&(!kind||o.kind===kind)&&Math.hypot(o.x-s.x,o.y-s.y)<range);}
function liveWeapons(s){return s.modules.filter(m=>['gun','laser','missile'].includes(m.type)&&m.hp>0&&!m.disabled);}
function fighterState(s){const bays=s.modules.filter(m=>m.type==='fighterBay'&&m.hp>0);if(!bays.length)return null;const total=bays.reduce((n,m)=>n+(m.fighters||0),0),remaining=bays.reduce((n,m)=>n+(m.fightersRemaining??m.fighters??0),0);return{total,remaining};}

function report(b,s,role,key,severity,text,request=null){
 ensureCrew(s);const now=b.t,cool=s.crewReportCooldowns[key]||-999;if(now-cool<9)return;
 s.crewReportCooldowns[key]=now;
 const officer=s.crew[role]||s.crew.xo;
 const item={id:`${s.uid}:${key}:${Math.floor(now*10)}`,t:now,shipUid:s.uid,shipName:s.name,role,officer:officer?.name||ROLES[role],title:officer?.title||ROLES[role],severity,text,request,status:'open'};
 s.crewReports.push(item);if(s.crewReports.length>20)s.crewReports.shift();
 b.crewInbox??=[];b.crewInbox.push(item);if(b.crewInbox.length>80)b.crewInbox.splice(0,b.crewInbox.length-80);
 b.log(`${s.name} ${item.title}: ${text}`);
}

function evaluateShip(b,s){
 ensureCrew(s);if(s.dead)return;
 const health=maxHpFraction(s),eng=engineFraction(s),shield=shieldFraction(s),bat=batteryFraction(s),p=s.powerState||{};
 const station=s.formationDistance||0;
 if(station>320&&eng<.62){
   const accel=s.modules.filter(m=>m.type==='engine'&&m.hp>0).reduce((n,m)=>n+(m.force||0)*(m.hp/(m.maxHp||m.hp)),0)/Math.max(1,s.mass);
   report(b,s,'helm','station_engine',3,`We are ${station.toFixed(0)} m out of station; damaged propulsion limits acceleration to ${accel.toFixed(2)} m/s². Request permission to break formation.`,{type:'formationDiscipline',value:'independent',label:'Permit break formation'});
 }
 if((p.unmetMW||0)>5e6&&eng<.85){
   report(b,s,'engineer','power_engines',4,`Power deficit ${(p.unmetMW/1e6).toFixed(1)} MW. Propulsion is being throttled. Request engines ahead of shield recharge.`,{type:'powerEngines',label:'Prioritise engines'});
 }
 if(incoming(b,s,'missile',2200).length>=1&&s.doctrineId!=='codeRed'){
   report(b,s,'tactical','missiles_inbound',5,`${incoming(b,s,'missile',2200).length} missile contact${incoming(b,s,'missile',2200).length>1?'s':''} inbound. Recommend Code Red immediately.`,{type:'doctrine',value:'codeRed',label:'Order Code Red'});
 }
 if(health<.34&&!s.fallBackRequested){
   report(b,s,'damage','critical_damage',5,`Structural condition ${Math.round(health*100)}%. Continued exposure risks loss of the ship. Request fall-back behind flagship.`,{type:'fallBack',value:true,label:'Fall back'});
 }
 if(shield<.22&&health>.45&&s.doctrineId!=='codeRed'){
   report(b,s,'captain','shield_failure',4,`Shields at ${Math.round(shield*100)}%. I recommend defensive power allocation until we recover.`,{type:'doctrine',value:'codeRed',label:'Approve defensive posture'});
 }
 const lasers=liveWeapons(s).filter(m=>m.type==='laser');
 if(lasers.length&&bat<.18&&s.doctrineId!=='codeRed'){
   report(b,s,'weapons','low_battery_lasers',2,`Battery reserve ${Math.round(bat*100)}%. Laser fire is competing with manoeuvre and shields. Recommend conserving offensive beams.`,{type:'laserReserve',value:.85,label:'Conserve laser fire'});
 }
 const fs=fighterState(s);if(fs&&fs.total>0&&fs.remaining/fs.total<.35){
   report(b,s,'cag','fighter_losses',3,`Only ${fs.remaining} of ${fs.total} fighters remain aboard. Recommend preserving the remaining air group for missile defence.`,{type:'defenceFirst',label:'Prioritise fighter defence'});
 }
 if(liveWeapons(s).length===0&&health>.2){
   report(b,s,'weapons','weapons_lost',4,`All primary ship weapons are offline. We can still contribute sensors, screening and manoeuvre support.`,null);
 }
}

export function answerCrewRequest(b,id,approve){
 const r=(b.crewInbox||[]).find(x=>x.id===id);if(!r||r.status!=='open')return false;
 r.status=approve?'approved':'denied';const s=b.ships.find(x=>x.uid===r.shipUid);if(!s)return true;
 if(approve&&r.request){
   const q=r.request;
   if(q.type==='formationDiscipline')s.formationDiscipline=q.value;
   else if(q.type==='powerEngines'){
     const base=s.powerPriority||['shieldMaintain','engines','shieldRecharge','weapons','storageRecharge'];
     s.powerPriority=['shieldMaintain','engines',...base.filter(x=>!['shieldMaintain','engines'].includes(x))];
   }else if(q.type==='doctrine')applyDoctrine(s,q.value);
   else if(q.type==='fallBack')s.fallBackRequested=true;
   else if(q.type==='laserReserve')s.laserMinStorageFraction=q.value;
   else if(q.type==='defenceFirst'){s.defencePriority=['missile','fighter'];s.reserveDefenceMW=Math.max(s.reserveDefenceMW||0,18e6);}
 }
 b.log(`Admiral ${approve?'approved':'denied'} ${r.shipName} ${r.title} request${r.request?`: ${r.request.label}`:''}.`);
 return true;
}

const baseStep=Battle.prototype.step;
Battle.prototype.step=function(dt){
 const out=baseStep.call(this,dt);this._crewEval=(this._crewEval||0)+dt;
 if(this._crewEval>=.75){this._crewEval=0;for(const s of this.ships)evaluateShip(this,s)}
 return out;
};
