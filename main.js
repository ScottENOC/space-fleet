import {Battle,G} from './sim.js';
import {HULLS,MODULES,blueprintToShip,designStats,footprint,canPlace,placeModule,removeAt,presetBroadside,presetPursuit} from './shipyard.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const canvas=$('#space'),ctx=canvas.getContext('2d'),logEl=$('#log'),statsEl=$('#stats'),speedEl=$('#speed'),pauseBtn=$('#pause');
let designs={A:presetBroadside(),B:presetPursuit()},activeSlot='A',selected='gun',rotation=0,erase=false;
let battle,paused=false,scale=0.14,simSpeed=1,last=performance.now();

function current(){return designs[activeSlot]}
function reset(seed=Math.floor(Math.random()*1e9)){battle=new Battle(blueprintToShip(designs.A,'A'),blueprintToShip(designs.B,'B'),seed);logEl.innerHTML='';}
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

function resize(){const r=canvas.getBoundingClientRect(),d=devicePixelRatio||1;canvas.width=r.width*d;canvas.height=r.height*d;ctx.setTransform(d,0,0,d,0,0)} addEventListener('resize',resize);resize();
function drawShip(s){ctx.save();ctx.translate(canvas.clientWidth/2+s.x*scale,canvas.clientHeight/2+s.y*scale);ctx.rotate(s.angle);ctx.globalAlpha=s.dead?.35:1;ctx.strokeStyle=s.team==='A'?'#d7b96d':'#79b8ff';ctx.lineWidth=2;ctx.strokeRect(-s.length*scale/2,-s.width*scale/2,s.length*scale,s.width*scale);
 for(const m of s.modules){if(m.type==='hull')continue;const x=m.x*scale,y=m.y*scale,w=7,h=5;ctx.globalAlpha=m.hp>0?1:.2;if(m.type==='engine'){ctx.strokeStyle='#56b6ff';ctx.strokeRect(x-w/2,y-h/2,w,h);const a=m.dir||0;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*5,y+Math.sin(a)*5);ctx.lineTo(x+Math.cos(a+2.5)*3,y+Math.sin(a+2.5)*3);ctx.moveTo(x+Math.cos(a)*5,y+Math.sin(a)*5);ctx.lineTo(x+Math.cos(a-2.5)*3,y+Math.sin(a-2.5)*3);ctx.stroke();if(m.active){ctx.beginPath();ctx.moveTo(x-Math.cos(a)*4,y-Math.sin(a)*4);ctx.lineTo(x-Math.cos(a)*12*(m.output||1),y-Math.sin(a)*12*(m.output||1));ctx.stroke();}}
 else {ctx.fillStyle=m.type==='gun'?'#ddd':m.type==='armor'?'#777':m.type==='reactor'?'#f4cf63':m.type==='shield'?'#79e0ff':m.type==='laser'?'#ff7c7c':m.type==='missile'?'#d88962':'#aaa';ctx.fillRect(x-w/2,y-h/2,w,h);if(['gun','laser','missile'].includes(m.type)){const a=m.mountDir||0;ctx.strokeStyle='#fff';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*7,y+Math.sin(a)*7);ctx.stroke()}}}
 ctx.restore();ctx.globalAlpha=1;ctx.fillStyle='#ddd';ctx.font='12px system-ui';ctx.fillText(s.name,canvas.clientWidth/2+s.x*scale-70,canvas.clientHeight/2+s.y*scale-18)}
function render(){ctx.fillStyle='#080d14';ctx.fillRect(0,0,canvas.clientWidth,canvas.clientHeight);for(const p of battle.projectiles){ctx.fillStyle='#ffe7a2';ctx.beginPath();ctx.arc(canvas.clientWidth/2+p.x*scale,canvas.clientHeight/2+p.y*scale,1.6,0,Math.PI*2);ctx.fill()}battle.ships.forEach(drawShip);
 const sum=battle.summary();statsEl.innerHTML=sum.ships.map(s=>`<div class="shipstat"><b>${s.name}</b><br>mass ${(s.mass/1000).toFixed(0)} t · speed ${s.speed.toFixed(1)} m/s<br>shots ${s.shots} · hits ${s.hits}<br>${s.modules.filter(m=>m.hp>0).length}/${s.modules.length} modules functional<br><small>${battle.ships.find(x=>x.name===s.name).order}</small></div>`).join('')+`<div><b>T+${sum.time.toFixed(1)} s</b>${sum.winner?` · winner: ${sum.winner}`:''}</div>`;
 logEl.innerHTML=battle.events.slice(-8).reverse().map(e=>`<div><span>${e.t.toFixed(1)}s</span> ${e.text}</div>`).join('')}
function loop(now){const elapsed=Math.min(.1,(now-last)/1000);last=now;if(!paused&&!battle.winner){let steps=Math.max(1,Math.round(simSpeed*elapsed/G.dt));for(let i=0;i<steps;i++)battle.step(G.dt)}render();requestAnimationFrame(loop)}requestAnimationFrame(loop);

pauseBtn.onclick=()=>{paused=!paused;pauseBtn.textContent=paused?'Resume':'Pause'};
$('#reset').onclick=()=>{reset();showTab('battle')};speedEl.oninput=()=>simSpeed=Number(speedEl.value);
$('#batch').onclick=()=>{let A=0,B=0,D=0,t=0;for(let i=1;i<=100;i++){const b=new Battle(blueprintToShip(designs.A,'A'),blueprintToShip(designs.B,'B'),i);for(let j=0;j<6000&&!b.winner;j++)b.step();const r=b.summary();if(r.winner==='A')A++;else if(r.winner==='B')B++;else D++;t+=r.time}alert(`100 battles\nDesign A: ${A}\nDesign B: ${B}\nDraws: ${D}\nMean duration: ${(t/100).toFixed(1)} s`)};
function showTab(id){$$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===id));$$('.tabpane').forEach(p=>p.classList.toggle('active',p.id===id));if(id==='battle')resize()}
$$('.tab').forEach(t=>t.onclick=()=>showTab(t.dataset.tab));
initShipyard();
