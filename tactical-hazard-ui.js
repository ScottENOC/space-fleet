function ensurePanel(){
 const orders=document.querySelector('.orders');if(!orders)return null;let p=document.querySelector('#hazardTacticalPanel');if(!p){p=document.createElement('div');p.id='hazardTacticalPanel';p.className='hazardTacticalPanel';orders.append(p)}return p;
}
function render(){
 const b=window.__fleetBattle,p=ensurePanel();if(!p)return;
 if(!b||b.nonCombatScenario!=='meteorEscort'){p.hidden=true;return}
 p.hidden=false;const h=window.__hazardSummary?.();if(!h){p.innerHTML='<h2>Hazard transit</h2><p>Initialising sensor picture…</p>';return}
 p.innerHTML=`<h2>Hazard transit // meteor swarm</h2>
 <div class="hazardReadout"><span>Convoy</span><b>${h.convoySurvivors}/${h.initialConvoy}</b><span>Time to clear</span><b>${h.timeRemaining.toFixed(0)} s</b><span>Sensor rating</span><b>${h.sensorRating.toFixed(1)}</b><span>Tracked incoming</span><b>${h.trackedMeteors}</b><span>Meteors destroyed</span><b>${h.destroyed}</b><span>Impacts</span><b>${h.impacts}</b></div>
 <p>Unresolved rocks are not available to point defence. Once the fleet sensor net establishes a track, merchant captains receive it over datalink and begin evasive manoeuvres while all friendly defensive weapons may engage.</p>`;
}
setInterval(render,150);render();
