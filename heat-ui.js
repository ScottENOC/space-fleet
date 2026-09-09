import {getHeatState,setThermalPolicy,POLICIES} from './heat-system.js';

function battle(){return window.__fleetBattle||null}
function selectedShips(){const b=battle(),who=document.querySelector('#orderShips')?.value||'all';if(!b)return[];return b.ships.filter(s=>s.team==='P'&&!s.dead&&(who==='all'||s.uid===who))}
function focusedShip(){const b=battle(),uid=document.querySelector('#focusShip')?.value;if(!b)return null;return b.ships.find(s=>s.uid===uid)||null}
function pct(v){return Math.max(0,Math.min(100,Math.round(v*100)))}
function status(h){if(h.fraction>=1.05)return'CRITICAL';if(h.fraction>=.90)return'HOT';if(h.fraction>=.70)return'WARM';return'NOMINAL'}

function installControls(){
 const orders=document.querySelector('.orders');if(!orders||document.querySelector('#thermalControls'))return;
 const box=document.createElement('div');box.id='thermalControls';box.className='thermalControls';
 box.innerHTML=`<h3>Thermal control</h3><label>Heat doctrine<select id="thermalPolicy"><option value="conservative">Conservative</option><option value="balanced" selected>Balanced</option><option value="aggressive">Aggressive</option><option value="emergency">Emergency output</option></select></label><small>Captains automatically inhibit lasers and then propulsion before thermal damage, according to doctrine.</small>`;
 orders.append(box);
 document.querySelector('#thermalPolicy').onchange=e=>{for(const s of selectedShips())setThermalPolicy(s,e.target.value)};
}
function render(){
 const s=focusedShip(),host=document.querySelector('#hudShipInfo');if(!host)return;
 host.querySelector('.focusedHeat')?.remove();
 if(!s||s.team!=='P')return;
 const h=getHeatState(s),radiators=(s.modules||[]).filter(m=>m.type==='radiator'),alive=radiators.filter(m=>m.hp>0&&!m.disabled).length;
 const el=document.createElement('section');el.className=`focusedHeat heat-${status(h).toLowerCase()}`;
 const net=(h.generatedMW||0)-(h.rejectedMW||0),warning=s.silentHeatWarning?' · SILENT ENDURANCE LOW':'';
 const integrated=(h.installedIntegratedMW??h.integratedMW??0),dedicated=(h.installedRadiatorMW||0);
 const coolingLabel=dedicated>0?`${integrated.toFixed(1)} MW hull + ${dedicated.toFixed(1)} MW dedicated`:`${integrated.toFixed(1)} MW integrated hull cooling`;
 el.innerHTML=`<div class="heatHead"><b>THERMAL</b><span>${status(h)}${warning}</span></div><div class="heatTrack"><i style="width:${pct(h.fraction)}%"></i></div><div class="heatStats"><span>${pct(h.fraction)}% reservoir</span><span>${(h.generatedMW||0).toFixed(1)} MW waste</span><span>${(h.rejectedMW||0).toFixed(1)} MW rejected</span><span>${net>=0?'+':''}${net.toFixed(1)} MW net</span></div><div class="heatMeta"><span>${h.policyLabel||POLICIES[h.policy]?.label||'Balanced'} doctrine</span><span>${coolingLabel}${h.runSilent?' · suppressed':''}</span>${dedicated>0?`<span>Dedicated radiators ${alive}/${radiators.length}</span>`:''}</div>${h.throttle?`<div class="heatThrottle">AUTO: ${h.throttle}</div>`:''}`;
 host.append(el);
}
installControls();setInterval(render,220);
