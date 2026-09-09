import {setFighterReserve,launchSensorDrone,recallCraft,craftInventory} from './ordnance.js';

function battle(){return window.__fleetBattle||null}
function selectedShips(){const b=battle(),who=document.querySelector('#orderShips')?.value||'all';if(!b)return[];return b.ships.filter(s=>s.team==='P'&&!s.dead&&(who==='all'||s.uid===who))}
function focusedShip(){const b=battle(),uid=document.querySelector('#focusShip')?.value;if(!b)return null;return b.ships.find(s=>s.uid===uid)||b.ships.find(s=>s.team==='P'&&!s.dead)||null}
function hangars(s){return (s?.modules||[]).filter(m=>m.type==='hangar'&&m.hp>0&&!m.disabled)}
function bays(s){return (s?.modules||[]).filter(m=>m.type==='launchBay'&&m.hp>0&&!m.disabled)}
function reserveLabel(v){if(v>=.99)return'Hold all';if(v>=.49)return'Keep half';if(v>=.24)return'Keep 25%';return'Launch all'}
function pct(v){return `${Math.max(0,Math.min(100,Math.round(v*100)))}%`}
function craftLabel(k){return k==='fighter'?'Fighter':k==='sensorDrone'?'Sensor drone':k}

function install(){
 const orders=document.querySelector('.orders');if(!orders||document.querySelector('#flightOpsControls'))return;
 const box=document.createElement('div');box.id='flightOpsControls';box.className='flightOpsControls';box.innerHTML=`<h3>Flight operations</h3><label>Fighter reserve<select id="fighterReserve"><option value="1">Hold all</option><option value=".5">Keep half</option><option value=".25" selected>Keep 25%</option><option value="0">Launch all</option></select></label><div class="flightButtons"><button id="launchDrone">Launch sensor drone</button><button id="recallFighters">Recall fighters</button><button id="recallDrones">Recall drones</button></div><div id="flightOpsStatus"></div>`;orders.append(box);
 document.querySelector('#fighterReserve').onchange=e=>{for(const s of selectedShips())setFighterReserve(s,Number(e.target.value));};
 document.querySelector('#launchDrone').onclick=()=>{const b=battle();if(!b)return;let n=0;for(const s of selectedShips())if(launchSensorDrone(b,s))n++;if(!n)b.log('Flight ops: no ready sensor drone, hangar, or launch slot available.');};
 document.querySelector('#recallFighters').onclick=()=>{const b=battle();if(b)for(const s of selectedShips())recallCraft(s,b,'fighter')};
 document.querySelector('#recallDrones').onclick=()=>{const b=battle();if(b)for(const s of selectedShips())recallCraft(s,b,'sensorDrone')};
}

function craftCounts(s,b){
 const inv=craftInventory(s),air=(b.ordnance||[]).filter(o=>o.owner===s&&['fighter','sensorDrone'].includes(o.kind)&&o.hp>0),fighters=air.filter(o=>o.kind==='fighter'),drones=air.filter(o=>o.kind==='sensorDrone');
 const returning=air.filter(o=>o.returning),returnF=returning.filter(o=>o.kind==='fighter').length,returnD=returning.filter(o=>o.kind==='sensorDrone').length;
 const service=hangars(s).flatMap(h=>h.craftService||[]),serviceF=service.filter(x=>x.kind==='fighter').length,serviceD=service.filter(x=>x.kind==='sensorDrone').length;
 return{inv,air,fighters,drones,returning,returnF,returnD,service,serviceF,serviceD};
}
function hangarRows(s,b){return hangars(s).map((h,i)=>{const inv=h.craftInventory||h.defaultCraft||{},service=h.craftService||[],spaces=h.hangarSpaces||0,used=(inv.fighter||0)+(inv.sensorDrone||0)*.5+service.reduce((n,x)=>n+(x.kind==='sensorDrone'?.5:1),0),next=service.length?Math.max(0,Math.min(...service.map(x=>x.readyAt))-b.t):0;return `<div class="flightRow"><span>Hangar ${i+1}</span><b>${inv.fighter||0} F · ${inv.sensorDrone||0} D</b><small>${used.toFixed(1)}/${spaces} spaces${service.length?` · ${service.length} servicing · next ${next.toFixed(1)}s`:''}</small></div>`}).join('')}
function bayRows(s,b){return bays(s).map((bay,i)=>{const slots=bay._slotUntil||Array(bay.launchSlots||1).fill(0),busy=slots.filter(x=>x>b.t),soon=busy.length?Math.max(0,Math.min(...busy)-b.t):0,util=slots.length?busy.length/slots.length:0,maxCycle=Math.max(bay.launchCycle||2,bay.recoveryCycle||3),progress=busy.length?1-Math.min(1,soon/Math.max(.1,maxCycle)):0;return `<div class="flightRow bayRow"><span>Bay ${i+1}</span><b>${busy.length}/${slots.length} slots busy</b><small>${busy.length?`processing · next clear ${soon.toFixed(1)}s`:'ready'} · ${pct(util)} occupied</small><div class="flightMiniTrack"><i style="width:${pct(busy.length?Math.max(.08,progress):0)}"></i></div></div>`}).join('')}
function serviceRows(c,b){if(!c.service.length)return'';const next=[...c.service].sort((a,z)=>a.readyAt-z.readyAt).slice(0,4);return `<div class="recoveryQueue"><b>Servicing</b>${next.map(x=>`<span>${craftLabel(x.kind)} · ready in ${Math.max(0,x.readyAt-b.t).toFixed(1)}s</span>`).join('')}${c.service.length>4?`<span>+${c.service.length-4} more</span>`:''}</div>`}
function renderFocusedFlightOps(){
 const b=battle(),s=focusedShip(),host=document.querySelector('#hudShipInfo');if(!b||!s||!host)return;
 host.querySelector('.focusedFlightOps')?.remove();
 if(s.team!=='P'||(!hangars(s).length&&!bays(s).length))return;
 const c=craftCounts(s,b),initialF=hangars(s).reduce((n,h)=>n+(h.initialCraft?.fighter??h.defaultCraft?.fighter??0),0),initialD=hangars(s).reduce((n,h)=>n+(h.initialCraft?.sensorDrone??h.defaultCraft?.sensorDrone??0),0),knownF=c.inv.fighter+c.fighters.length+c.serviceF,knownD=c.inv.sensorDrone+c.drones.length+c.serviceD,lostF=Math.max(0,initialF-knownF),lostD=Math.max(0,initialD-knownD);
 const wrap=document.createElement('section');wrap.className='focusedFlightOps';wrap.innerHTML=`<div class="flightFocusHead"><b>FLIGHT OPERATIONS</b><span>${reserveLabel(s.fighterReserveFraction??.25)}</span></div><div class="flightSummary"><div><span>Fighters</span><b>${c.inv.fighter} ready · ${c.fighters.length} airborne</b><small>${c.returnF} returning · ${c.serviceF} servicing${lostF?` · ${lostF} lost`:''}</small></div><div><span>Drones</span><b>${c.inv.sensorDrone} ready · ${c.drones.length} airborne</b><small>${c.returnD} returning · ${c.serviceD} servicing${lostD?` · ${lostD} lost`:''}</small></div></div>${hangarRows(s,b)}${bayRows(s,b)}${c.returning.length?`<div class="recoveryQueue"><b>Recovery queue</b>${c.returning.slice(0,5).map(o=>`<span>${o.kind==='fighter'?'F':'D'} · ${o.name}${o.recoveryShip&&o.recoveryShip!==o.homeShip?` → divert ${o.recoveryShip.name}`:''} · fuel ${Math.round((o.fuel/o.maxFuel)*100)}%</span>`).join('')}${c.returning.length>5?`<span>+${c.returning.length-5} more</span>`:''}</div>`:''}${serviceRows(c,b)}`;host.append(wrap);
}
function refresh(){
 const host=document.querySelector('#flightOpsStatus'),b=battle();if(host&&b){const ships=selectedShips();host.innerHTML=ships.map(s=>{const x=craftInventory(s),air=(b.ordnance||[]).filter(o=>o.owner===s&&['fighter','sensorDrone'].includes(o.kind)&&o.hp>0);const f=air.filter(o=>o.kind==='fighter').length,d=air.filter(o=>o.kind==='sensorDrone').length;return `<div><b>${s.name}</b> · hangar F ${x.fighter} / D ${x.sensorDrone} · airborne F ${f} / D ${d}${x.servicing?` · servicing ${x.servicing}`:''}</div>`}).join('')||'<small>No selected flight-capable ships.</small>'}
 renderFocusedFlightOps();
}
install();setInterval(refresh,180);
