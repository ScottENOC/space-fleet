const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
let gameMode='campaign',lastBattle=null,resultShownFor=null;
const flashState=new Map();

function activateScreen(id){
  const tab=$(`[data-tab="${id}"]`);if(tab){tab.click();return;}
  $$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===id));
  $$('.tabpane').forEach(p=>p.classList.toggle('active',p.id===id));
}
function healthFraction(s){const mods=(s.modules||[]).filter(m=>(m.maxHp||m.hp)>0),max=mods.reduce((n,m)=>n+(m.maxHp||m.hp||0),0)||1;return Math.max(0,Math.min(1,mods.reduce((n,m)=>n+Math.max(0,m.hp||0),0)/max));}
function shieldFraction(s){const xs=(s.modules||[]).filter(m=>m.type==='shield'&&m.hp>0),cap=xs.reduce((n,m)=>n+(m.capacity||0),0);return cap?Math.max(0,Math.min(1,xs.reduce((n,m)=>n+(m.charge||0),0)/cap)):0;}
function silhouette(s,enemy=false){
 const cells=s.grid?.validCells||[];const fill=enemy?'rgba(223,113,113,.74)':'rgba(132,193,226,.72)';
 if(!cells.length)return `<svg class="fleetSilhouette" viewBox="0 0 40 40"><path d="M20 3L35 33L20 27L5 33Z" fill="${fill}"/></svg>`;
 const w=s.grid.width||1,h=s.grid.height||1,scale=Math.min(34/w,34/h),ox=(40-w*scale)/2,oy=(40-h*scale)/2;
 const rects=cells.map(([x,y])=>`<rect x="${(ox+x*scale).toFixed(2)}" y="${(oy+y*scale).toFixed(2)}" width="${Math.max(1,scale-.45).toFixed(2)}" height="${Math.max(1,scale-.45).toFixed(2)}" rx=".6"/>`).join('');
 return `<svg class="fleetSilhouette" viewBox="0 0 40 40" aria-hidden="true"><g fill="${fill}">${rects}</g></svg>`;
}
function installTitle(){
 const el=document.createElement('div');el.id='titleScreen';el.className='open';el.innerHTML=`<div class="titleCard"><div class="titleMark">Independent Fleet Command</div><h1>FRONTIER COMMAND</h1><div class="titleActions"><button id="titleCampaign">Campaign</button><button id="titleSkirmish">Skirmish</button></div></div>`;document.body.append(el);document.body.classList.add('ui-title');
 $('#titleCampaign').onclick=()=>{gameMode='campaign';window.__gameMode=gameMode;el.classList.remove('open');document.body.classList.remove('ui-title');activateScreen('campaign');syncNonBattleUI()};
 $('#titleSkirmish').onclick=()=>{gameMode='skirmish';window.__gameMode=gameMode;el.classList.remove('open');document.body.classList.remove('ui-title');activateScreen('shipyard');syncNonBattleUI()};
}
function installMenu(){
 const btn=document.createElement('button');btn.id='globalMenuButton';btn.className='hudIconButton';btn.textContent='☰';btn.title='Menu';document.body.append(btn);
 const back=document.createElement('div');back.id='gameMenuBackdrop';back.innerHTML=`<div class="menuCard"><h2>Menu</h2><div class="menuActions"><button id="menuResume">Resume</button><button id="menuOutOfCombat">Return to command</button><button id="menuCrew">Crew & appointments</button><button id="menuDoctrine">Doctrine editor</button><button id="menuTitle">Return to title screen</button></div></div>`;document.body.append(back);
 const roster=document.createElement('div');roster.id='crewRosterBackdrop';roster.innerHTML=`<div class="crewRosterCard"><h2>Crew & appointments</h2><div id="crewRosterHome"></div><button id="crewRosterClose">Close</button></div>`;document.body.append(roster);
 const close=()=>back.classList.remove('open');btn.onclick=()=>back.classList.add('open');$('#menuResume').onclick=close;
 $('#menuOutOfCombat').onclick=()=>{close();activateScreen(gameMode==='campaign'?'campaign':'shipyard')};
 $('#menuCrew').onclick=()=>{close();const details=$('.crewRosterWrap');if(details){details.open=true;$('#crewRosterHome').append(details)}roster.classList.add('open')};
 $('#crewRosterClose').onclick=()=>roster.classList.remove('open');roster.onclick=e=>{if(e.target===roster)roster.classList.remove('open')};
 $('#menuDoctrine').onclick=()=>{close();activateScreen('doctrine')};
 $('#menuTitle').onclick=()=>{close();activateScreen('shipyard');$('#titleScreen').classList.add('open');document.body.classList.add('ui-title');syncNonBattleUI()};
 back.onclick=e=>{if(e.target===back)close()};
}
function installSkirmishLaunch(){const yard=$('#shipyard');if(!yard)return;const b=document.createElement('button');b.id='skirmishLaunch';b.textContent='Launch skirmish';b.onclick=()=>{$('#reset')?.click();activateScreen('battle')};yard.append(b);}
function installBattleHud(){
 const hud=document.createElement('div');hud.className='battleHud';hud.innerHTML=`
  <div id="hudTopLeft"><button id="battleMenu" class="hudIconButton">☰</button><button id="hudFleetView" class="hudIconButton">Fleet view</button><div id="hudOrdersWrap"><button class="hudToggle">Orders</button><div class="hudPopover hudPanel"></div></div></div>
  <div id="hudTopRight"><div id="hudDoctrineWrap"><button class="hudToggle">Doctrine</button><div class="hudPopover hudPanel"></div></div></div>
  <section id="hudEnemyStrip" class="hudPanel"></section><section id="hudShipInfo" class="hudPanel"></section><section id="hudTraffic" class="hudPanel"></section><section id="hudFleetStrip" class="hudPanel"></section>`;
 document.body.append(hud);
 $('#battleMenu').onclick=()=>$('#gameMenuBackdrop')?.classList.add('open');$('#hudFleetView').onclick=()=>$('#fleetView')?.click();
 for(const wrap of ['#hudOrdersWrap','#hudDoctrineWrap']){const w=$(wrap),t=w?.querySelector('.hudToggle'),p=w?.querySelector('.hudPopover');if(t&&p)t.onclick=()=>{const will=!p.classList.contains('open');$$('.hudPopover').forEach(x=>x.classList.remove('open'));p.classList.toggle('open',will)}}
 const orders=$('#battle .orders'),doctrine=orders?.querySelector('.doctrineControls');if(doctrine)$('#hudDoctrineWrap .hudPopover').append(doctrine);if(orders)$('#hudOrdersWrap .hudPopover').append(orders);
 const traffic=$('.crewPanel');if(traffic)$('#hudTraffic').append(traffic);
}
function focusedShip(b){const uid=$('#focusShip')?.value;return b?.ships?.find(s=>s.uid===uid)||b?.ships?.find(s=>s.team==='P'&&!s.dead)||b?.ships?.[0];}
function weaponStatus(s){const ws=(s.modules||[]).filter(m=>['gun','laser','missile','fighterBay'].includes(m.type)&&m.hp>0&&!m.disabled);if(!ws.length)return'No operational weapons';if(s.weaponStatus?.label)return s.weaponStatus.label;if(ws.every(w=>Number.isFinite(w.ammo)&&w.ammo<=0))return'Ammunition depleted';return s.order||'Executing captain doctrine';}
function observableEnemyActivity(s){const firing=(s.modules||[]).some(m=>['gun','laser','missile','fighterBay'].includes(m.type)&&(m.cooldownLeft||0)>0),engines=(s.modules||[]).filter(m=>m.type==='engine'&&m.hp>0&&m.active).length;const bits=[];if(firing)bits.push('weapons active');if(engines)bits.push(`${engines} drive plume${engines===1?'':'s'} visible`);if(!bits.length)bits.push('no major emissions observed');return bits.join(' · ');}
function renderFocused(b){
 const s=focusedShip(b),host=$('#hudShipInfo');if(!s||!host)return;const hp=healthFraction(s),sh=shieldFraction(s),alive=(s.modules||[]).filter(m=>m.hp>0).length,total=(s.modules||[]).length,destroyed=Math.max(0,total-alive);
 const bars=`<div class="focusBars"><div class="focusBar"><span>Hull</span><div class="barTrack"><div class="barFill ${hp<.35?'healthLow':''}" style="width:${(hp*100).toFixed(1)}%"></div></div><b>${Math.round(hp*100)}%</b></div>${sh>0?`<div class="focusBar"><span>Shield</span><div class="barTrack"><div class="barFill" style="width:${(sh*100).toFixed(1)}%"></div></div><b>${Math.round(sh*100)}%</b></div>`:''}</div>`;
 if(s.team==='E'){
   host.classList.add('enemyFocus');host.innerHTML=`<div class="focusName"><b>${esc(s.name)}</b><span>HOSTILE CONTACT · ${esc(s.shipClass||'unknown class')}</span></div>${bars}<div class="focusGrid"><div><span>Speed</span> ${Math.hypot(s.vx||0,s.vy||0).toFixed(0)} m/s</div><div><span>Turn</span> ${((s.omega||0)*180/Math.PI).toFixed(1)}°/s</div><div><span>Components</span> ${alive} operational</div><div><span>Destroyed</span> ${destroyed} observed</div><div class="focusStatus">${esc(observableEnemyActivity(s))}</div></div>`;return;
 }
 host.classList.remove('enemyFocus');const p=s.powerState||{},stored=p.maxMWh>0?`${Math.round((p.storageFraction||0)*100)}%`:'—';host.innerHTML=`<div class="focusName"><b>${esc(s.name)}</b><span>${s.isFlagship?'FLAGSHIP · ':''}${s.shipClass||''}</span></div>${bars}<div class="focusGrid"><div><span>Speed</span> ${Math.hypot(s.vx||0,s.vy||0).toFixed(0)} m/s</div><div><span>Turn</span> ${((s.omega||0)*180/Math.PI).toFixed(1)}°/s</div><div><span>Power</span> ${((p.generationMW||0)/1e6).toFixed(1)} MW</div><div><span>Battery</span> ${stored}</div><div><span>Fire</span> ${s.shots||0} / ${s.hits||0} hits</div><div><span>Modules</span> ${alive}/${total}</div><div class="focusStatus">${esc(weaponStatus(s))}</div></div>`;
}
function focusUid(uid){const sel=$('#focusShip');if(!sel)return;sel.value=uid;sel.dispatchEvent(new Event('change',{bubbles:true}));}
function renderFleetStrip(b){const host=$('#hudFleetStrip');if(!host)return;const focus=$('#focusShip')?.value,players=(b?.ships||[]).filter(s=>s.team==='P'),now=performance.now();host.innerHTML=players.map(s=>{const hp=healthFraction(s),f=flashState.get(s.uid)||{},classes=['fleetChip'];if(s.uid===focus)classes.push('focused');if(s.dead)classes.push('dead');if(f.hitUntil>now)classes.push('flashHit');if(f.fireUntil>now)classes.push('flashFire');return `<button class="${classes.join(' ')}" data-focusuid="${s.uid}">${silhouette(s)}<div class="fleetChipText"><b>${esc(s.name)}</b>${s.isFlagship?'★ Admiral':''}</div><div class="fleetMiniBar"><i style="width:${(hp*100).toFixed(1)}%"></i></div></button>`}).join('')+`<button class="fleetChip fleetViewChip" data-allview>ALL<br>SHIPS</button>`;host.querySelectorAll('[data-focusuid]').forEach(x=>x.onclick=()=>focusUid(x.dataset.focusuid));host.querySelector('[data-allview]')?.addEventListener('click',()=>$('#fleetView')?.click());}
function renderEnemyStrip(b){const host=$('#hudEnemyStrip');if(!host)return;const focus=$('#focusShip')?.value,enemies=(b?.ships||[]).filter(s=>s.team==='E'),now=performance.now();host.innerHTML=enemies.map(s=>{const hp=healthFraction(s),f=flashState.get(s.uid)||{},classes=['fleetChip','enemyChip'];if(s.uid===focus)classes.push('focused');if(s.dead)classes.push('dead');if(f.hitUntil>now)classes.push('flashHit');if(f.fireUntil>now)classes.push('flashFire');return `<button class="${classes.join(' ')}" data-enemyfocus="${s.uid}">${silhouette(s,true)}<div class="fleetChipText"><b>${esc(s.name)}</b><span>${Math.round(hp*100)}% contact</span></div><div class="fleetMiniBar"><i style="width:${(hp*100).toFixed(1)}%"></i></div></button>`}).join('');host.querySelectorAll('[data-enemyfocus]').forEach(x=>x.onclick=()=>focusUid(x.dataset.enemyfocus));}
function watchFlashes(b){for(const s of (b?.ships||[])){const hp=(s.modules||[]).reduce((n,m)=>n+Math.max(0,m.hp||0),0),shots=s.shots||0,old=flashState.get(s.uid)||{hp,shots};if(hp<old.hp-.01)old.hitUntil=performance.now()+330;if(shots>old.shots)old.fireUntil=performance.now()+220;old.hp=hp;old.shots=shots;flashState.set(s.uid,old)}}
function installResult(){const e=document.createElement('div');e.id='battleResultBackdrop';e.innerHTML=`<div class="resultCard"><h2 id="resultTitle"></h2><div id="resultSummary" class="resultSummary"></div><div id="resultEvents" class="resultEvents"></div><div class="resultActions"><button id="resultReturn"></button><button id="resultAgain">Fight another skirmish</button></div></div>`;document.body.append(e);$('#resultReturn').onclick=()=>{e.classList.remove('open');activateScreen(lastBattle?.campaignBattle?'campaign':'shipyard')};$('#resultAgain').onclick=()=>{e.classList.remove('open');gameMode='skirmish';$('#reset')?.click();activateScreen('battle')};}
function showResult(b){if(!b?.winner||resultShownFor===b)return;resultShownFor=b;lastBattle=b;const playerWin=b.winner==='P',draw=b.winner==='draw';$('#resultTitle').textContent=draw?'Action concluded':playerWin?'Victory':'Fleet action lost';const own=b.ships.filter(s=>s.team==='P'),surv=own.filter(s=>!s.dead&&s.outcome!=='captured').length;$('#resultSummary').innerHTML=`T+${(b.t||0).toFixed(1)} s · ${surv}/${own.length} player ships still effective${b.campaignBattle?'<br>Damage, ammunition and crew consequences will persist.':''}`;$('#resultEvents').innerHTML=(b.events||[]).slice(-10).map(x=>`<div>${x.t.toFixed(1)}s · ${esc(x.text)}</div>`).join('');$('#resultReturn').textContent=b.campaignBattle?'Return to fleet command':'Return to shipyard';$('#resultAgain').style.display=b.campaignBattle?'none':'block';$('#battleResultBackdrop').classList.add('open');}
function syncNonBattleUI(){const battle=$('#battle')?.classList.contains('active');$('.battleHud')?.classList.toggle('active',!!battle);const menu=$('#globalMenuButton');if(menu){menu.classList.toggle('nonBattleMenu',!battle&&!$('#titleScreen')?.classList.contains('open'));menu.style.display=battle?'none':''}const launch=$('#skirmishLaunch');if(launch)launch.style.display=gameMode==='skirmish'&&$('#shipyard')?.classList.contains('active')?'block':'none';}
function refresh(){const b=window.__fleetBattle;syncNonBattleUI();if($('#battle')?.classList.contains('active')&&b){if(b!==lastBattle){lastBattle=b;resultShownFor=null;flashState.clear()}watchFlashes(b);renderFocused(b);renderFleetStrip(b);renderEnemyStrip(b);showResult(b)}}
installTitle();installMenu();installSkirmishLaunch();installBattleHud();installResult();syncNonBattleUI();setInterval(refresh,120);
