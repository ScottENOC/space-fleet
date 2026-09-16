if(!document.querySelector('#hazardTacticalStyle')){const s=document.createElement('style');s.id='hazardTacticalStyle';s.textContent='.hazardTacticalPanel{margin-top:10px;padding:9px;border:1px solid #765f3d;background:rgba(24,18,10,.82)}.hazardTacticalPanel h2{margin:0 0 7px;color:#e8c88d;font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.08em}.hazardTacticalPanel p{margin:8px 0 0;color:#b9aa91;font-size:10px;line-height:1.4}.hazardReadout{display:grid;grid-template-columns:1fr auto;gap:4px 10px;font:10px ui-monospace,SFMono-Regular,Menlo,monospace}.hazardReadout span{color:#998b75}.hazardReadout b{color:#f0dfbd;text-align:right}';document.head.append(s)}
function ensurePanel(){
 const orders=document.querySelector('.orders');if(!orders)return null;let p=document.querySelector('#hazardTacticalPanel');if(!p){p=document.createElement('div');p.id='hazardTacticalPanel';p.className='hazardTacticalPanel';orders.append(p)}return p;
}
function setHazardControls(active){
 const orders=document.querySelector('.orders');if(!orders)return;const heading=orders.querySelector(':scope > h2');if(heading){if(!heading.dataset.normalText)heading.dataset.normalText=heading.textContent||'Player combat order';heading.textContent=active?'Convoy escort posture':heading.dataset.normalText}
 for(const id of ['orderShips','orderTarget','orderPriority','orderRam']){const el=document.getElementById(id),label=el?.closest('label');if(label)label.style.display=active?'none':''}
 const apply=document.getElementById('applyTargetOrder');if(apply)apply.style.display=active?'none':'';
}
function render(){
 const b=window.__fleetBattle,p=ensurePanel();if(!p)return;const active=!!b&&b.nonCombatScenario==='meteorEscort';setHazardControls(active);
 if(!active){p.hidden=true;return}
 p.hidden=false;const h=window.__hazardSummary?.();if(!h){p.innerHTML='<h2>Hazard transit</h2><p>Initialising sensor picture…</p>';return}
 p.innerHTML=`<h2>Hazard transit // meteor swarm</h2>
 <div class="hazardReadout"><span>Convoy</span><b>${h.convoySurvivors}/${h.initialConvoy}</b><span>Time to clear</span><b>${h.timeRemaining.toFixed(0)} s</b><span>Sensor rating</span><b>${h.sensorRating.toFixed(1)}</b><span>Tracked incoming</span><b>${h.trackedMeteors}</b><span>Meteors neutralised</span><b>${h.destroyed}</b><span>Impacts</span><b>${h.impacts}</b></div>
 <p>Your escorts hold a forward screen automatically. Undetected rocks are absent from the tactical plot and cannot be engaged. Once the fleet sensor net establishes a track, merchant captains receive it over datalink, evade predicted impacts, and all friendly defensive weapons may fire. An escort ship can also physically take a strike that would otherwise reach the convoy.</p>`;
}
setInterval(render,150);render();
