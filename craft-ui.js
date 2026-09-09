import {setFighterReserve,launchSensorDrone,recallCraft,craftInventory} from './ordnance.js';

function battle(){return window.__fleetBattle||null}
function selectedShips(){const b=battle(),who=document.querySelector('#orderShips')?.value||'all';if(!b)return[];return b.ships.filter(s=>s.team==='P'&&!s.dead&&(who==='all'||s.uid===who))}
function install(){const orders=document.querySelector('.orders');if(!orders||document.querySelector('#flightOpsControls'))return;const box=document.createElement('div');box.id='flightOpsControls';box.className='flightOpsControls';box.innerHTML=`<h3>Flight operations</h3><label>Fighter reserve<select id="fighterReserve"><option value="1">Hold all</option><option value=".5">Keep half</option><option value=".25" selected>Keep 25%</option><option value="0">Launch all</option></select></label><div class="flightButtons"><button id="launchDrone">Launch sensor drone</button><button id="recallFighters">Recall fighters</button><button id="recallDrones">Recall drones</button></div><div id="flightOpsStatus"></div>`;orders.append(box);
 document.querySelector('#fighterReserve').onchange=e=>{for(const s of selectedShips())setFighterReserve(s,Number(e.target.value));};
 document.querySelector('#launchDrone').onclick=()=>{const b=battle();if(!b)return;let n=0;for(const s of selectedShips())if(launchSensorDrone(b,s))n++;if(!n)b.log('Flight ops: no ready sensor drone, hangar, or launch slot available.');};
 document.querySelector('#recallFighters').onclick=()=>{const b=battle();if(b)for(const s of selectedShips())recallCraft(s,b,'fighter')};
 document.querySelector('#recallDrones').onclick=()=>{const b=battle();if(b)for(const s of selectedShips())recallCraft(s,b,'sensorDrone')};
}
function refresh(){const host=document.querySelector('#flightOpsStatus'),b=battle();if(!host||!b)return;const ships=selectedShips();host.innerHTML=ships.map(s=>{const x=craftInventory(s),air=(b.ordnance||[]).filter(o=>o.owner===s&&['fighter','sensorDrone'].includes(o.kind)&&o.hp>0);const f=air.filter(o=>o.kind==='fighter').length,d=air.filter(o=>o.kind==='sensorDrone').length;return `<div><b>${s.name}</b> · hangar F ${x.fighter} / D ${x.sensorDrone} · airborne F ${f} / D ${d}${x.servicing?` · servicing ${x.servicing}`:''}</div>`}).join('')||'<small>No selected flight-capable ships.</small>'}
install();setInterval(refresh,300);
