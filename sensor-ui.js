const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function contact(b,s){return window.__sensorGetContact?.(b,'P',s.uid)||{quality:1,level:'resolved',signal:1};}
function focusUid(uid){const sel=$('#focusShip');if(!sel)return;sel.value=uid;sel.dispatchEvent(new Event('change',{bubbles:true}));}
function silhouette(s,known){
 if(!known)return '<div class="sensorBlip">◆</div>';
 const cells=s.grid?.validCells||[];if(!cells.length)return '<div class="sensorBlip">◆</div>';
 const w=s.grid.width||1,h=s.grid.height||1,scale=Math.min(34/w,34/h),ox=(40-w*scale)/2,oy=(40-h*scale)/2;
 const rects=cells.map(([x,y])=>`<rect x="${(ox+x*scale).toFixed(2)}" y="${(oy+y*scale).toFixed(2)}" width="${Math.max(1,scale-.45).toFixed(2)}" height="${Math.max(1,scale-.45).toFixed(2)}" rx=".6"/>`).join('');
 return `<svg class="fleetSilhouette" viewBox="0 0 40 40"><g fill="rgba(223,113,113,.74)">${rects}</g></svg>`;
}
function renderEnemyContacts(){
 const b=window.__fleetBattle,host=$('#hudEnemyStrip');if(!b||!host)return;
 const focus=$('#focusShip')?.value,enemies=b.ships.filter(s=>s.team==='E'&&!s.dead).map(s=>({s,c:contact(b,s)})).filter(x=>x.c.quality>=.08);
 host.innerHTML=enemies.map(({s,c})=>{
   const classified=c.quality>=.57,resolved=c.quality>=.82,track=c.quality>=.30;
   const label=classified?esc(s.name):track?'Hostile track':'Unknown contact';
   const sub=resolved?`${Math.round(c.quality*100)}% resolved`:classified?`probable ${esc(s.shipClass||'vessel')}`:track?'vector established':'bearing only';
   return `<button class="fleetChip enemyChip sensorContact ${s.uid===focus?'focused':''}" data-sensorfocus="${s.uid}">${silhouette(s,classified)}<div class="fleetChipText"><b>${label}</b><span>${sub}</span></div><div class="sensorQuality"><i style="width:${Math.round(c.quality*100)}%"></i></div></button>`;
 }).join('')||'<div class="noContacts">NO HOSTILE CONTACTS</div>';
 host.querySelectorAll('[data-sensorfocus]').forEach(x=>x.onclick=()=>focusUid(x.dataset.sensorfocus));
}
function renderEnemyFocus(){
 const b=window.__fleetBattle,sel=$('#focusShip'),host=$('#hudShipInfo');if(!b||!sel||!host)return;const s=b.ships.find(x=>x.uid===sel.value);if(!s||s.team!=='E')return;
 const c=contact(b,s);if(c.quality<.08){host.innerHTML='<div class="focusName"><b>Contact lost</b><span>SENSORS</span></div><div class="focusStatus">Last track is no longer reliable.</div>';return;}
 const speed=Math.hypot(s.vx||0,s.vy||0),track=c.quality>=.30,classified=c.quality>=.57,resolved=c.quality>=.82;
 const alive=s.modules.filter(m=>m.hp>0).length,total=s.modules.length,destroyed=Math.max(0,total-alive);
 const shields=s.modules.filter(m=>m.type==='shield'&&m.hp>0),cap=shields.reduce((n,m)=>n+(m.capacity||0),0),charge=shields.reduce((n,m)=>n+(m.charge||0),0),shieldPct=cap?Math.round(charge/cap*100):0;
 const activity=[];if(s.modules.some(m=>m.type==='engine'&&m.active))activity.push('drive plume');if(s.modules.some(m=>['gun','laser','missile','fighterBay'].includes(m.type)&&(m.cooldownLeft||0)>0))activity.push('weapons emission');if(s.runSilent)activity.push('very low emissions');
 const name=classified?s.name:'Hostile contact';const cls=classified?(s.shipClass||'unknown class'):'classification uncertain';
 host.classList.add('enemyFocus');host.innerHTML=`<div class="focusName"><b>${esc(name)}</b><span>${esc(cls)} · ${c.level.toUpperCase()}</span></div><div class="focusGrid sensorFocusGrid">${track?`<div><span>Speed</span> ${speed.toFixed(0)} m/s</div><div><span>Turn</span> ${((s.omega||0)*180/Math.PI).toFixed(1)}°/s</div>`:'<div class="focusStatus">Position uncertain · bearing/range estimate only</div>'}${resolved?`<div><span>Components</span> ${alive} observed operational</div><div><span>Destroyed</span> ${destroyed} observed</div>${cap?`<div><span>Shield</span> ~${shieldPct}%</div>`:''}`:''}<div class="focusStatus">Track quality ${Math.round(c.quality*100)}%${activity.length?` · ${esc(activity.join(' · '))}`:''}</div></div>`;
}
function selectedPlayerShips(){const b=window.__fleetBattle;if(!b)return[];const who=$('#orderShips')?.value||'all';return b.ships.filter(s=>s.team==='P'&&!s.dead&&(who==='all'||s.uid===who));}
function installSilentControls(){
 const orders=$('#hudOrdersWrap .orders');if(!orders||$('#silentRunningControls'))return;
 const box=document.createElement('div');box.id='silentRunningControls';box.className='silentControls';box.innerHTML='<div class="silentLabel">EMISSIONS</div><div class="silentButtons"><button id="runSilentOn">Run silent</button><button id="runSilentOff">Light ship</button></div><small>Silent running shuts down reactors, propulsion and weapons. The ship coasts on stored energy and becomes much harder to track.</small>';
 orders.append(box);
 $('#runSilentOn').onclick=()=>{for(const s of selectedPlayerShips())window.__setRunSilent?.(s,true)};
 $('#runSilentOff').onclick=()=>{for(const s of selectedPlayerShips())window.__setRunSilent?.(s,false)};
}
function markFriendlySilent(){const b=window.__fleetBattle;if(!b)return;for(const chip of document.querySelectorAll('#hudFleetStrip [data-focusuid]')){const s=b.ships.find(x=>x.uid===chip.dataset.focusuid);chip.classList.toggle('runningSilent',!!s?.runSilent)}}
function refresh(){installSilentControls();renderEnemyContacts();renderEnemyFocus();markFriendlySilent();}
setInterval(refresh,90);
