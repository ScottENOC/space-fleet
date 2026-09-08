import {Battle,G} from './sim.js';
import {HULLS,MODULES,blueprintToShip,designStats,footprint,canPlace,placeModule,removeAt,presetBroadside,presetPursuit} from './shipyard.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const canvas=$('#space'),ctx=canvas.getContext('2d'),logEl=$('#log'),statsEl=$('#stats'),speedEl=$('#speed'),pauseBtn=$('#pause');
let designs={A:presetBroadside(),B:presetPursuit()},activeSlot='A',selected='gun',rotation=0,erase=false;
let battle,paused=false,simSpeed=1,last=performance.now();
let cameraMode='focus',focusTeam='A',camera={x:0,y:0,scale:1};

function current(){return designs[activeSlot]}
function reset(seed=Math.floor(Math.random()*1e9)){battle=new Battle(blueprintToShip(designs.A,'A'),blueprintToShip(designs.B,'B'),seed);logEl.innerHTML='';syncFocusOptions();cameraMode='focus';setCameraButtons();}
reset(7);

function initShipyard(){
  $('#hull').innerHTML=Object.values(HULLS).map(h=>`<option value="${h.id}">${h.name} — ${h.role}</option>`).join('');
  $('#palette').innerHTML=Object.entries(MODULES).map(([id,m])=>`<button class="module" data-module="${id}"><span class="swatch" style="background:${m.colour}"></span><b>${m.name}</b><small>${m.size[0]}×${m.size[1]} · ${m.mass} t${m.directional?' · directional':''}</small></button>`).join('');
  bindYard();syncYard();
}
function bindYard(){
  $$('.slotpick button').forEach(b=>b.onclick=()=>{activeSlot=b.dataset.slot;$$('.slotpick button').forEach(x=>x.classList.toggle('active',x===b));syncYard()});
  $$('.module').forEach(b=>b.onclick=()=>{selected=b.dataset.module;erase=false;$$('.module').forEach(x=>x.classList.toggle('active',x===b));$('#erase').classList.remove('active');renderGrid()});
  $('#rotate').onclick=()=>{rotation=(rotation+1)%4;updateOrientation();renderGrid()};
  $('#erase').onclick=()=>{erase=!erase;$('#erase').classList.toggle('active',erase);renderGrid()};
  $('#hull').onchange=e=>{const b=current();b.hullId=e.target.value;b.ai=HULLS[b.hullId].ai;b.placements=[];$('#doctrine').value=b.ai;renderGrid()};
  $('#shipName').oninput=e=>current().name=e.target.value;
  $('#doctrine').onchange=e=>current().ai=e.target.value;
  $('#presetBroadside').onclick=()=>{designs[activeSlot]=presetBroadside();syncYard()};
  $('#presetPursuit').onclick=()=>{designs[activeSlot]=presetPursuit();syncYard()};
}
function syncYard(){const b=current();$('#hull').value=b.hullId;$('#shipName').value=b.name;$('#doctrine').value=b.ai;renderGrid();updateOrientation()}
function updateOrientation(){const arrows=['→','↓','←','↑'];$('#orientation').textContent=`Facing ${arrows[rotation]}`}
function renderGrid(){
  const b=current(),h=HULLS[b.hullId],grid=$('#grid');grid.style.setProperty('--cols',h.width);grid.style.setProperty('--rows',h.height);grid.innerHTML='';
  const valid=new Set(h.cells.map(c=>c.join(','))),cellToPlacement=new Map();b.placements.forEach((p,i)=>footprint(p).forEach(c=>cellToPlacement.set(c.join(','),i)));
  for(let y=0;y<h.height;y++)for(let x=0;x<h.width;x++){
    const cell=document.createElement('button');cell.className='cell';cell.dataset.x=x;cell.dataset.y=y;
    if(!valid.has(`${x},${y}`)){cell.classList.add('void');cell.disabled=true}else{
      const i=cellToPlacement.get(`${x},${y}`);
      if(i!==undefined){const p=b.placements[i],m=MODULES[p.moduleId];cell.classList.add('occupied');cell.style.background=m.colour;cell.title=m.name;if(footprint(p)[0][0]===x&&footprint(p)[0][1]===y)cell.textContent=m.directional?['→','↓','←','↑'][p.rot||0]:m.name[0];}
      cell.onclick=()=>{if(erase||cellToPlacement.has(`${x},${y}`))removeAt(b,x,y);else placeModule(b,selected,x,y,rotation);renderGrid()};
      if(!erase&&!cellToPlacement.has(`${x},${y}`)&&canPlace(b,selected,x,y,rotation))cell.classList.add('placeable');
    }
    grid.appendChild(cell);
  }
  const st=designStats(b);$('#designStats').innerHTML=`<b>${b.name}</b> · ${h.name}<br>${st.cellsUsed}/${st.cellsTotal} cells · ${st.mass.toFixed(0)} t · ${(st.power/1e6).toFixed(0)} MW generation · ${(st.maxPowerUse/1e6).toFixed(1)} MW theoretical load · ${(st.thrust/1e6).toFixed(2)} MN installed thrust · ${st.weapons} weapons`;
}

function resize(){const r=canvas.getBoundingClientRect(),d=devicePixelRatio||1;canvas.width=Math.max(1,r.width*d);canvas.height=Math.max(1,r.height*d);ctx.setTransform(d,0,0,d,0,0)}
addEventListener('resize',resize);resize();

function livingShips(){return battle.ships.filter(s=>!s.dead)}
function focusShip(){return battle.ships.find(s=>s.team===focusTeam&&!s.dead)||livingShips()[0]||battle.ships[0]}
function syncFocusOptions(){if(!battle)return;const sel=$('#focusShip');sel.innerHTML=battle.ships.map(s=>`<option value="${s.team}">${s.name}</option>`).join('');if(!battle.ships.some(s=>s.team===focusTeam))focusTeam=battle.ships[0]?.team||'A';sel.value=focusTeam;}
function setCameraButtons(){$('#focusView').classList.toggle('active',cameraMode==='focus');$('#fleetView').classList.toggle('active',cameraMode==='fleet');$('#focusLabel').style.display=cameraMode==='focus'?'flex':'none';}
$('#focusView').onclick=()=>{cameraMode='focus';setCameraButtons()};
$('#fleetView').onclick=()=>{cameraMode='fleet';setCameraButtons()};
$('#focusShip').onchange=e=>{focusTeam=e.target.value;cameraMode='focus';setCameraButtons()};

function updateCamera(){
  const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
  if(cameraMode==='focus'){
    const s=focusShip();if(!s)return;
    camera.x=s.x;camera.y=s.y;
    const targetPixels=Math.min(w,h)*0.20;
    camera.scale=Math.max(0.03,targetPixels/Math.max(s.length,s.width,1));
    $('#cameraReadout').textContent=`Focus · ${s.name} · ${(camera.scale).toFixed(2)} px/m`;
  }else{
    const ships=livingShips();if(!ships.length)return;
    let minX=Math.min(...ships.map(s=>s.x-s.radius)),maxX=Math.max(...ships.map(s=>s.x+s.radius)),minY=Math.min(...ships.map(s=>s.y-s.radius)),maxY=Math.max(...ships.map(s=>s.y+s.radius));
    const spanX=Math.max(120,maxX-minX),spanY=Math.max(120,maxY-minY),pad=0.16;
    camera.x=(minX+maxX)/2;camera.y=(minY+maxY)/2;
    camera.scale=Math.max(0.001,Math.min(w/(spanX*(1+pad*2)),h/(spanY*(1+pad*2))));
    $('#cameraReadout').textContent=`Fleet · ${(spanX/1000).toFixed(1)} × ${(spanY/1000).toFixed(1)} km spread`;
  }
}
function worldToScreen(x,y){return [canvas.clientWidth/2+(x-camera.x)*camera.scale,canvas.clientHeight/2+(y-camera.y)*camera.scale]}

function drawShip(s){
  const [sx,sy]=worldToScreen(s.x,s.y);ctx.save();ctx.translate(sx,sy);ctx.rotate(s.angle);ctx.globalAlpha=s.dead?.35:1;ctx.strokeStyle=s.team==='A'?'#d7b96d':'#79b8ff';ctx.lineWidth=2;ctx.strokeRect(-s.length*camera.scale/2,-s.width*camera.scale/2,s.length*camera.scale,s.width*camera.scale);
  for(const m of s.modules){if(m.type==='hull')continue;const x=m.x*camera.scale,y=m.y*camera.scale,w=Math.max(3,7*camera.scale/0.14),hh=Math.max(2,5*camera.scale/0.14);ctx.globalAlpha=m.hp>0?1:.2;if(m.type==='engine'){ctx.strokeStyle='#56b6ff';ctx.strokeRect(x-w/2,y-hh/2,w,hh);const a=m.dir||0;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*Math.max(4,w*.7),y+Math.sin(a)*Math.max(4,w*.7));ctx.lineTo(x+Math.cos(a+2.5)*3,y+Math.sin(a+2.5)*3);ctx.moveTo(x+Math.cos(a)*Math.max(4,w*.7),y+Math.sin(a)*Math.max(4,w*.7));ctx.lineTo(x+Math.cos(a-2.5)*3,y+Math.sin(a-2.5)*3);ctx.stroke();if(m.active){ctx.beginPath();ctx.moveTo(x-Math.cos(a)*4,y-Math.sin(a)*4);ctx.lineTo(x-Math.cos(a)*12*(m.output||1),y-Math.sin(a)*12*(m.output||1));ctx.stroke();}}
    else{ctx.fillStyle=m.type==='gun'?'#ddd':m.type==='armor'?'#777':m.type==='reactor'?'#f4cf63':m.type==='shield'?'#79e0ff':m.type==='laser'?'#ff7c7c':m.type==='missile'?'#d88962':'#aaa';ctx.fillRect(x-w/2,y-hh/2,w,hh);if(['gun','laser','missile'].includes(m.type)){const a=m.mountDir||0;ctx.strokeStyle='#fff';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*Math.max(6,w),y+Math.sin(a)*Math.max(6,w));ctx.stroke()}}}
  ctx.restore();ctx.globalAlpha=1;
  if(cameraMode==='fleet'&&Math.max(s.length,s.width)*camera.scale<12){ctx.fillStyle=s.team==='A'?'#d7b96d':'#79b8ff';ctx.beginPath();ctx.arc(sx,sy,5,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle='#ddd';ctx.font='12px system-ui';ctx.fillText(s.name,sx-55,sy-Math.max(10,s.width*camera.scale/2+8));
}

function drawRadarContacts(){
  if(cameraMode!=='focus')return;const own=focusShip();if(!own)return;const w=canvas.clientWidth,h=canvas.clientHeight,margin=34;
  for(const s of battle.ships){if(s===own||s.dead)continue;const [sx,sy]=worldToScreen(s.x,s.y);if(sx>margin&&sx<w-margin&&sy>margin&&sy<h-margin)continue;
    const dx=sx-w/2,dy=sy-h/2,ang=Math.atan2(dy,dx);const rx=w/2-margin,ry=h/2-margin;const t=Math.min(Math.abs(rx/(Math.cos(ang)||1e-6)),Math.abs(ry/(Math.sin(ang)||1e-6)));const ex=w/2+Math.cos(ang)*t,ey=h/2+Math.sin(ang)*t;
    const range=Math.hypot(s.x-own.x,s.y-own.y),rvx=s.vx-own.vx,rvy=s.vy-own.vy,nx=(s.x-own.x)/(range||1),ny=(s.y-own.y)/(range||1),radial=rvx*nx+rvy*ny;
    ctx.save();ctx.translate(ex,ey);ctx.rotate(ang);ctx.fillStyle=s.team==='A'?'#d7b96d':'#79b8ff';ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(-7,-6);ctx.lineTo(-7,6);ctx.closePath();ctx.fill();ctx.restore();
    ctx.fillStyle='#e8edf4';ctx.font='11px system-ui';const label=`${s.name} ${(range/1000).toFixed(1)} km · ${radial<0?'closing':'opening'} ${Math.abs(radial).toFixed(0)} m/s`;const tw=ctx.measureText(label).width;let tx=ex+10,ty=ey-10;if(tx+tw>w-4)tx=ex-tw-12;if(ty<12)ty=ey+18;ctx.fillText(label,tx,ty);
    ctx.strokeStyle=s.team==='A'?'#d7b96d':'#79b8ff';ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(ex+Math.cos(s.angle)*18,ey+Math.sin(s.angle)*18);ctx.stroke();
  }
}

function render(){
  updateCamera();ctx.fillStyle='#080d14';ctx.fillRect(0,0,canvas.clientWidth,canvas.clientHeight);
  ctx.strokeStyle='#132033';ctx.lineWidth=1;const grid=250*camera.scale;if(grid>24){for(let x=((canvas.clientWidth/2-camera.x*camera.scale)%grid+grid)%grid;x<canvas.clientWidth;x+=grid){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.clientHeight);ctx.stroke()}for(let y=((canvas.clientHeight/2-camera.y*camera.scale)%grid+grid)%grid;y<canvas.clientHeight;y+=grid){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.clientWidth,y);ctx.stroke()}}
  for(const p of battle.projectiles){const [x,y]=worldToScreen(p.x,p.y);if(x<0||x>canvas.clientWidth||y<0||y>canvas.clientHeight)continue;ctx.fillStyle='#ffe7a2';ctx.beginPath();ctx.arc(x,y,1.6,0,Math.PI*2);ctx.fill()}
  battle.ships.forEach(drawShip);drawRadarContacts();
  const sum=battle.summary();statsEl.innerHTML=sum.ships.map(s=>`<div class="shipstat"><b>${s.name}</b><br>mass ${(s.mass/1000).toFixed(0)} t · speed ${s.speed.toFixed(1)} m/s<br>shots ${s.shots} · hits ${s.hits}<br>${s.modules.filter(m=>m.hp>0).length}/${s.modules.length} modules functional<br><small>${battle.ships.find(x=>x.name===s.name).order}</small></div>`).join('')+`<div><b>T+${sum.time.toFixed(1)} s</b>${sum.winner?` · winner: ${sum.winner}`:''}</div>`;
  logEl.innerHTML=battle.events.slice(-8).reverse().map(e=>`<div><span>${e.t.toFixed(1)}s</span> ${e.text}</div>`).join('');
}
function loop(now){const elapsed=Math.min(.1,(now-last)/1000);last=now;if(!paused&&!battle.winner){let steps=Math.max(1,Math.round(simSpeed*elapsed/G.dt));for(let i=0;i<steps;i++)battle.step(G.dt)}render();requestAnimationFrame(loop)}requestAnimationFrame(loop);

pauseBtn.onclick=()=>{paused=!paused;pauseBtn.textContent=paused?'Resume':'Pause'};
$('#reset').onclick=()=>{reset();showTab('battle')};speedEl.oninput=()=>simSpeed=Number(speedEl.value);
$('#batch').onclick=()=>{let A=0,B=0,D=0,t=0;for(let i=1;i<=100;i++){const b=new Battle(blueprintToShip(designs.A,'A'),blueprintToShip(designs.B,'B'),i);for(let j=0;j<6000&&!b.winner;j++)b.step();const r=b.summary();if(r.winner==='A')A++;else if(r.winner==='B')B++;else D++;t+=r.time}alert(`100 battles\nDesign A: ${A}\nDesign B: ${B}\nDraws: ${D}\nMean duration: ${(t/100).toFixed(1)} s`)};
function showTab(id){$$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===id));$$('.tabpane').forEach(p=>p.classList.toggle('active',p.id===id));if(id==='battle'){resize();syncFocusOptions()}}
$$('.tab').forEach(t=>t.onclick=()=>showTab(t.dataset.tab));
initShipyard();syncFocusOptions();setCameraButtons();