const $=s=>document.querySelector(s);
const mobile=()=>matchMedia('(max-width:760px)').matches;
let selected=null;

function battle(){return window.__fleetBattle}
function focusShip(){const b=battle(),uid=$('#focusShip')?.value;return b?.ships?.find(s=>s.uid===uid)||b?.ships?.find(s=>s.team==='P'&&!s.dead)||null}
function cameraState(){
 const b=battle(),canvas=$('#space');if(!b||!canvas)return null;
 const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return null;
 const fleetMode=$('#fleetView')?.classList.contains('active');
 if(!fleetMode){const s=focusShip();if(!s)return null;return{x:s.x,y:s.y,scale:Math.max(.02,Math.min((w*.20)/Math.max(s.length,1),(h*.20)/Math.max(s.width,1))),w,h}}
 const ships=b.ships.filter(s=>!s.dead);if(!ships.length)return null;
 const minX=Math.min(...ships.map(s=>s.x-s.radius)),maxX=Math.max(...ships.map(s=>s.x+s.radius)),minY=Math.min(...ships.map(s=>s.y-s.radius)),maxY=Math.max(...ships.map(s=>s.y+s.radius)),spanX=Math.max(120,maxX-minX),spanY=Math.max(120,maxY-minY),pad=.16;
 return{x:(minX+maxX)/2,y:(minY+maxY)/2,scale:Math.max(.001,Math.min(w/(spanX*(1+pad*2)),h/(spanY*(1+pad*2)))),w,h};
}
function toScreen(x,y,c){return[c.w/2+(x-c.x)*c.scale,c.h/2+(y-c.y)*c.scale]}
function tapRadius(obj,c){if(obj.uid)return Math.max(22,Math.min(48,(obj.radius||10)*c.scale+15));return obj.kind==='missile'?22:obj.kind==='fighter'?24:20}
function nearestAt(clientX,clientY){
 const b=battle(),canvas=$('#space'),c=cameraState();if(!b||!canvas||!c)return null;const r=canvas.getBoundingClientRect(),x=clientX-r.left,y=clientY-r.top;let best=null,bestD=Infinity;
 const candidates=[...b.ships.filter(s=>!s.dead),...(b.ordnance||[]).filter(o=>o.hp>0)];
 for(const o of candidates){const [sx,sy]=toScreen(o.x,o.y,c),d=Math.hypot(x-sx,y-sy),hit=tapRadius(o,c);if(d<=hit&&d<bestD){best=o;bestD=d}}
 return best;
}
function setFocus(s){const sel=$('#focusShip');if(!sel||!s?.uid)return;sel.value=s.uid;sel.dispatchEvent(new Event('change',{bubbles:true}))}
function healthFraction(s){const ms=(s.modules||[]).filter(m=>(m.maxHp||m.hp)>0),max=ms.reduce((n,m)=>n+(m.maxHp||m.hp||0),0)||1;return Math.max(0,Math.min(1,ms.reduce((n,m)=>n+Math.max(0,m.hp||0),0)/max))}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function shipContext(s){
 const hp=Math.round(healthFraction(s)*100),speed=Math.hypot(s.vx||0,s.vy||0).toFixed(0),target=s.commandTargetId?battle()?.ships?.find(x=>x.uid===s.commandTargetId)?.name:null;
 return `<div class="contextHead"><div><b>${esc(s.name)}</b><small>${s.team==='P'?'FRIENDLY':'HOSTILE'} · ${esc(s.shipClass||'SHIP')}</small></div><button data-close-context>×</button></div><div class="contextSummary"><span>Hull <b>${hp}%</b></span><span>Speed <b>${speed} m/s</b></span></div><div class="contextStatus">${esc(s.order||target&&`Targeting ${target}`||'Underway')}</div>${s.team==='P'?'<div class="contextActions"><button data-orders>Orders</button><button data-fleet>Fleet</button></div>':'<div class="contextActions"><button data-target>Target with…</button><button data-contacts>Contacts</button></div>'}`;
}
function ordnanceContext(o){
 const speed=Math.hypot(o.vx||0,o.vy||0).toFixed(0),owner=o.owner?.name||'Unknown launcher',target=o.target?.name||o.targetOrdnance?.kind||'No current target',fuel=Number.isFinite(o.fuel)?`${Math.max(0,o.fuel).toFixed(1)} s`:'—';
 const label=o.kind==='sensorDrone'?'Sensor drone':o.kind==='decoy'?'Decoy':o.kind==='fighter'?'Fighter':o.kind==='missile'?'Missile':(o.kind||'Ordnance');
 return `<div class="contextHead"><div><b>${esc(label)}</b><small>${o.team==='P'?'FRIENDLY':'HOSTILE'} ORDNANCE</small></div><button data-close-context>×</button></div><div class="contextSummary"><span>Speed <b>${speed} m/s</b></span><span>Fuel <b>${fuel}</b></span></div><div class="contextStatus">From ${esc(owner)} · ${esc(target)}</div>`;
}
function showContext(o){
 selected=o;const sheet=$('#battleContextSheet');if(!sheet)return;
 if(o?.uid)setFocus(o);
 sheet.innerHTML=o?.uid?shipContext(o):ordnanceContext(o);sheet.classList.add('open');
 sheet.querySelector('[data-close-context]')?.addEventListener('click',closeContext);
 sheet.querySelector('[data-orders]')?.addEventListener('click',()=>{$('#hudOrdersWrap .hudToggle')?.click()});
 sheet.querySelector('[data-fleet]')?.addEventListener('click',()=>{$('#mobileFleetButton')?.click()});
 sheet.querySelector('[data-contacts]')?.addEventListener('click',()=>{$('#mobileContactsButton')?.click()});
 sheet.querySelector('[data-target]')?.addEventListener('click',()=>{const target=$('#orderTarget');if(target&&o?.uid){target.value=o.uid;$('#hudOrdersWrap .hudToggle')?.click()}});
}
function closeContext(){selected=null;$('#battleContextSheet')?.classList.remove('open');$('#mobileSelectionRing')?.classList.remove('show')}
function install(){
 const canvas=$('#space'),hud=$('.battleHud');if(!canvas||!hud||$('#battleContextSheet'))return;
 const sheet=document.createElement('section');sheet.id='battleContextSheet';sheet.className='hudPanel';document.body.append(sheet);
 const ring=document.createElement('div');ring.id='mobileSelectionRing';document.body.append(ring);
 let down=null;
 canvas.addEventListener('pointerdown',e=>{if(!mobile())return;down={x:e.clientX,y:e.clientY,t:performance.now()}});
 canvas.addEventListener('pointerup',e=>{if(!mobile()||!down)return;const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y),elapsed=performance.now()-down.t;down=null;if(moved>12||elapsed>550)return;const o=nearestAt(e.clientX,e.clientY);if(o)showContext(o);else closeContext()});
}
function refreshSelection(){
 if(!mobile()||!selected)return;const b=battle(),c=cameraState(),ring=$('#mobileSelectionRing');if(!b||!c||!ring)return;
 const live=selected.uid?b.ships.includes(selected)&&!selected.dead:(b.ordnance||[]).includes(selected)&&selected.hp>0;if(!live){closeContext();return}
 const [x,y]=toScreen(selected.x,selected.y,c),size=selected.uid?Math.max(30,Math.min(82,(selected.radius||12)*c.scale*2+18)):34;
 ring.style.left=`${x}px`;ring.style.top=`${y}px`;ring.style.width=`${size}px`;ring.style.height=`${size}px`;ring.classList.add('show');
}
install();setInterval(()=>{install();refreshSelection()},100);
