import {Battle} from './sim.js';
import {CRAFT,craftSpace} from './craft-catalog.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const rot=(x,y,a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
const BASE_UPDATE=Battle.prototype.updateProjectiles;
const BASE_STEP=Battle.prototype.step;

export const BOARDING_DOCTRINES={
 never:{label:'Never board',maxSorties:0,threshold:0},
 opportunistic:{label:'Opportunistic',maxSorties:1,threshold:.72},
 capture:{label:'Capture if practical',maxSorties:2,threshold:.52},
 aggressive:{label:'Aggressive capture',maxSorties:3,threshold:.30}
};
export const BOARDING_OBJECTIVES={capture:'Capture ship',bridge:'Seize bridge',engine:'Disable engines',reactor:'Sabotage reactor'};

function aliveModules(s,type){return (s.modules||[]).filter(m=>m.type===type&&m.hp>0&&!m.disabled)}
function hullCells(s){return s.grid?.validCells?.length||Math.max(8,Math.round((s.length||18)*(s.width||10)/12))}
function moduleFraction(s,types){const ms=(s.modules||[]).filter(m=>types.includes(m.type));if(!ms.length)return 0;const max=ms.reduce((n,m)=>n+(m.maxHp||m.hp||1),0)||1;return ms.reduce((n,m)=>n+Math.max(0,m.hp||0),0)/max}
function shipHealth(s){const ms=s.modules||[],max=ms.reduce((n,m)=>n+(m.maxHp||m.hp||0),0)||1;return ms.reduce((n,m)=>n+Math.max(0,m.hp||0),0)/max}
function baseSecurity(s){return 3+Math.ceil(Math.sqrt(hullCells(s))*.8)}
function marineCapacity(s){return aliveModules(s,'marineBerth').reduce((n,m)=>n+(m.marineCapacity||0)*(m.hp/Math.max(1,m.maxHp||m.hp)),0)}
function securityBonus(s){return aliveModules(s,'marineBerth').reduce((n,m)=>n+(m.securityBonus||0)*(m.hp/Math.max(1,m.maxHp||m.hp)),0)}
export function ensureBoardingState(s){
 if(!s.boardingState){const trained=Math.round(marineCapacity(s));s.boardingState={baseSecurity:baseSecurity(s),personnelAvailable:Math.max(4,baseSecurity(s)+trained),personnelInitial:Math.max(4,baseSecurity(s)+trained),defenderStrength:Math.max(4,baseSecurity(s)+trained+Math.round(securityBonus(s))),casualties:0,fronts:[],capturedSystems:{}}}
 s.boardingDoctrine??='opportunistic';s.boardingObjective??='capture';return s.boardingState;
}
function hangars(s){return aliveModules(s,'hangar')}
function bays(s){return aliveModules(s,'launchBay')}
function initHangar(h){h.craftInventory??={...(h.defaultCraft||{})};h.craftService??=[];return h}
function used(h){initHangar(h);let n=0;for(const[k,v]of Object.entries(h.craftInventory||{}))n+=v*craftSpace(k);for(const x of h.craftService||[])n+=craftSpace(x.kind);return n}
function sourceHangar(s){return hangars(s).map(initHangar).find(h=>(h.craftInventory?.boardingShuttle||0)>0)||null}
function freeHangar(s){return hangars(s).map(initHangar).find(h=>(h.hangarSpaces||0)-used(h)>=craftSpace('boardingShuttle')-.001)||null}
function baySlot(s,t,recovery=false){for(const bay of bays(s)){bay._slotUntil??=[];while(bay._slotUntil.length<(bay.launchSlots||1))bay._slotUntil.push(0);const i=bay._slotUntil.findIndex(x=>x<=t);if(i<0)continue;const factor=recovery?(CRAFT.boardingShuttle.recoveryTime||1):(CRAFT.boardingShuttle.launchTime||1),cycle=(recovery?(bay.recoveryCycle||3):(bay.launchCycle||2))*factor;return{bay,i,cycle}}return null}
function worldPoint(s,m){const [x,y]=rot(m.x||0,m.y||0,s.angle||0);return{x:s.x+x,y:s.y+y}}
function steer(o,target,dt){if(!target||o.fuel<=0)return;const wanted=Math.atan2(target.y-o.y,target.x-o.x),err=wrap(wanted-o.angle),turn=clamp(err,-o.turnRate*dt,o.turnRate*dt);o.angle=wrap(o.angle+turn);o.vx+=Math.cos(o.angle)*o.accel*dt;o.vy+=Math.sin(o.angle)*o.accel*dt;o.fuel=Math.max(0,o.fuel-dt)}

export function launchBoardingShuttle(b,s,target,objective=s.boardingObjective||'capture'){
 if(!b||!s||!target||target.dead||s.runSilent)return false;const st=ensureBoardingState(s),h=sourceHangar(s),slot=baySlot(s,b.t,false);if(!h||!slot||st.personnelAvailable<=0)return false;
 const troops=Math.min(CRAFT.boardingShuttle.troopCapacity||8,st.personnelAvailable);if(troops<2)return false;
 h.craftInventory.boardingShuttle--;st.personnelAvailable-=troops;slot.bay._slotUntil[slot.i]=b.t+slot.cycle;
 const p=worldPoint(s,slot.bay),a=s.angle+(slot.bay.mountDir||0),serial=(s._boardingSerial=(s._boardingSerial||0)+1);
 b.ordnance??=[];b.ordnance.push({kind:'boardingShuttle',team:s.team,owner:s,homeShip:s,name:`${s.name} boarding shuttle ${serial}`,x:p.x,y:p.y,vx:s.vx+Math.cos(a)*70,vy:s.vy+Math.sin(a)*70,angle:a,hp:CRAFT.boardingShuttle.hp,maxHp:CRAFT.boardingShuttle.hp,accel:CRAFT.boardingShuttle.accel,turnRate:CRAFT.boardingShuttle.turnRate,r:CRAFT.boardingShuttle.r,fuel:CRAFT.boardingShuttle.maxFuel,maxFuel:CRAFT.boardingShuttle.maxFuel,returnFuel:CRAFT.boardingShuttle.returnFuel,target,objective,marines:troops,state:'approach',ttl:9999});
 b.log(`${s.name}: boarding shuttle launched toward ${target.name} (${BOARDING_OBJECTIVES[objective]||objective}).`);return true;
}
function targetVulnerability(t){const eng=moduleFraction(t,['engine']),weap=moduleFraction(t,['gun','laser','missile']),hp=shipHealth(t),surrender=t.outcome==='surrendered'||t.surrendered;return clamp((1-eng)*.36+(1-weap)*.34+(1-hp)*.20+(surrender?.35:0),0,1.4)}
function activeSorties(b,s){return (b.ordnance||[]).filter(o=>o.kind==='boardingShuttle'&&o.owner===s&&o.hp>0).length+b.ships.reduce((n,t)=>n+(ensureBoardingState(t).fronts||[]).filter(f=>f.sourceShipUid===s.uid&&f.attackers>0&&!f.resolved).length,0)}
function doctrineStep(b){for(const s of b.ships){if(s.dead)continue;const d=BOARDING_DOCTRINES[s.boardingDoctrine||'opportunistic'];if(!d||d.maxSorties<=0||activeSorties(b,s)>=d.maxSorties||!sourceHangar(s))continue;const targets=b.ships.filter(t=>!t.dead&&t.team!==s.team).map(t=>({t,v:targetVulnerability(t)})).filter(x=>x.v>=d.threshold).sort((a,c)=>c.v-a.v||dist(s,a.t)-dist(s,c.t));if(targets[0])launchBoardingShuttle(b,s,targets[0].t,s.boardingObjective||'capture')}}
function attach(b,o,t){const ts=ensureBoardingState(t),id=`breach:${o.owner.uid}:${Math.round(b.t*10)}:${Math.random().toString(36).slice(2,5)}`;ts.fronts.push({id,team:o.team,sourceShipUid:o.owner.uid,sourceName:o.owner.name,attackers:o.marines,initialAttackers:o.marines,objective:o.objective,phase:'breaching',breach:0,control:0,resolved:false,startedAt:b.t});o.hp=0;o.attached=true;b.log(`${o.name} has forced docking with ${t.name}; breaching underway.`)}
function updateShuttle(b,o,dt){const t=o.target;if(!t||t.dead){o.state='returning'}if(o.state==='approach'&&t&&!t.dead){steer(o,t,dt);o.x+=o.vx*dt;o.y+=o.vy*dt;const rv=Math.hypot(o.vx-t.vx,o.vy-t.vy);if(dist(o,t)<Math.max(32,(t.radius||15)+18)&&rv<=(CRAFT.boardingShuttle.dockRelativeSpeed||65))attach(b,o,t);else if(o.fuel<=o.returnFuel)o.state='returning';return}if(o.state==='returning'){const home=o.homeShip;if(!home||home.dead){o.hp=0;return}steer(o,home,dt);o.x+=o.vx*dt;o.y+=o.vy*dt;const rv=Math.hypot(o.vx-home.vx,o.vy-home.vy);if(dist(o,home)<Math.max(42,(home.radius||15)+24)&&rv<80){const h=freeHangar(home),slot=baySlot(home,b.t,true);if(h&&slot){slot.bay._slotUntil[slot.i]=b.t+slot.cycle;h.craftService.push({kind:'boardingShuttle',readyAt:b.t+slot.cycle+(CRAFT.boardingShuttle.serviceTime||18)});ensureBoardingState(home).personnelAvailable+=o.marines||0;o.hp=0;o.recovered=true;b.log(`${o.name} recovered aboard ${home.name}.`)}}}}
function objectiveModifier(t,obj){if(obj==='bridge')return moduleFraction(t,['bridge'])>.2?1:1.18;if(obj==='engine')return moduleFraction(t,['engine'])>.2?1:1.15;if(obj==='reactor')return moduleFraction(t,['reactor'])>.2?1:1.12;return 1}
function damageObjective(t,obj,amount){const types=obj==='bridge'?['bridge']:obj==='engine'?['engine']:obj==='reactor'?['reactor']:[];for(const m of t.modules.filter(m=>types.includes(m.type)&&m.hp>0)){m.hp=Math.max(0,m.hp-amount);break}}
function resolveFronts(b,t,dt){const st=ensureBoardingState(t),active=st.fronts.filter(f=>!f.resolved&&f.attackers>0);if(!active.length)return;const defenderPool=Math.max(0,st.defenderStrength-st.casualties),split=Math.max(1,active.length);for(const f of active){if(f.phase==='breaching'){const breachRate=(.10+.018*f.attackers)*objectiveModifier(t,f.objective);f.breach+=breachRate*dt;if(f.breach>=1){f.breach=1;f.phase='fighting';b.log(`${t.name}: breach established by ${f.sourceName}; defenders are splitting to contain ${active.length} incursion${active.length===1?'':'s'}.`)}continue}
 const defendersHere=defenderPool/split,attackPower=f.attackers*(.78+.10*Math.min(3,active.length)),defPower=defendersHere*.72;const pressure=(attackPower-defPower)/Math.max(4,attackPower+defPower);f.control=clamp(f.control+(.025+.055*pressure)*dt,0,1);const atkLoss=Math.max(0,.012+.020*(defPower/Math.max(1,attackPower)))*dt,defLoss=Math.max(0,.010+.023*(attackPower/Math.max(1,defPower||1)))*dt;f.attackers=Math.max(0,f.attackers-atkLoss);st.casualties=Math.min(st.defenderStrength,st.casualties+defLoss);
 if(f.objective!=='capture'&&f.control>.72)damageObjective(t,f.objective,5*dt);
 if(f.attackers<=.35){f.resolved=true;f.phase='repelled';b.log(`${t.name}: ${f.sourceName} boarding party repelled.`)}else if(f.control>=1){f.resolved=true;f.phase='success';if(f.objective==='capture'){t.outcome='captured';t.surrendered=true;t.throttle=0;t.boardedByTeam=f.team;b.log(`${t.name} captured by boarding action.`)}else{st.capturedSystems[f.objective]=true;b.log(`${t.name}: boarders secured ${BOARDING_OBJECTIVES[f.objective]||f.objective}.`)}}}
}

Battle.prototype.updateProjectiles=function(dt){const out=BASE_UPDATE.call(this,dt);for(const o of this.ordnance||[])if(o.kind==='boardingShuttle'&&o.hp>0)updateShuttle(this,o,dt);for(const s of this.ships)if(!s.dead)resolveFronts(this,s,dt);this.ordnance=(this.ordnance||[]).filter(o=>o.hp>0&&o.ttl>0);return out};
Battle.prototype.step=function(dt){const out=BASE_STEP.call(this,dt);this._boardingDoctrineClock=(this._boardingDoctrineClock||0)+dt;if(this._boardingDoctrineClock>=1){this._boardingDoctrineClock=0;doctrineStep(this)}return out};

export function setBoardingDoctrine(s,id){if(BOARDING_DOCTRINES[id])s.boardingDoctrine=id;return s.boardingDoctrine}
export function setBoardingObjective(s,id){if(BOARDING_OBJECTIVES[id])s.boardingObjective=id;return s.boardingObjective}
export function boardingSummary(s){const st=ensureBoardingState(s);return{...st,activeFronts:st.fronts.filter(f=>!f.resolved&&f.attackers>0)}}
if(typeof window!=='undefined'){window.__boardingSummary=boardingSummary;window.__launchBoardingShuttle=launchBoardingShuttle;}
