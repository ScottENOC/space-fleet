import {ensureCrew,answerCrewRequest} from './crew-system.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sevLabel=n=>n>=5?'CRITICAL':n>=4?'URGENT':n>=3?'IMPORTANT':n>=2?'ADVISORY':'INFO';

function install(){
 const aside=document.querySelector('#battle>aside');if(!aside||document.querySelector('#crewInbox'))return;
 const wrap=document.createElement('section');wrap.className='crewPanel';wrap.innerHTML=`
   <div class="crewHead"><h2>Admiral's traffic</h2><span id="openRequestCount">0 open</span></div>
   <div id="crewInbox"></div>
   <details class="crewRosterWrap"><summary>Ship crews</summary><div id="crewRoster"></div></details>`;
 const orders=aside.querySelector('.orders');orders?.after(wrap);
}
function currentBattle(){return window.__fleetBattle}
function reportCard(r){
 const open=r.status==='open',action=r.request&&open;
 return `<article class="crewReport severity${r.severity} ${open?'open':'closed'}" data-report="${esc(r.id)}">
   <div class="reportMeta"><b>${esc(r.shipName)}</b><span>${esc(r.title)} · ${esc(r.officer)}</span><em>${sevLabel(r.severity)}</em></div>
   <p>${esc(r.text)}</p>
   ${r.request?`<div class="requestLine">Request: <b>${esc(r.request.label||'Action')}</b></div>`:''}
   ${action?`<div class="requestActions"><button data-answer="approve">Approve</button><button data-answer="deny">Deny</button></div>`:`<small>${r.status==='approved'?'Approved':r.status==='denied'?'Denied':'Report only'}</small>`}
 </article>`;
}
function rosterCard(s){
 const crew=ensureCrew(s),people=Object.values(crew);
 return `<div class="rosterShip"><h3>${s.isFlagship?'★ ':''}${esc(s.name)}</h3>${people.map(p=>`<div><b>${esc(p.title)}</b><span>${esc(p.name)}</span><small>skill ${Math.round((p.skill||.8)*100)}%</small></div>`).join('')}</div>`;
}
function refresh(){
 const b=currentBattle();if(!b)return;
 const inbox=document.querySelector('#crewInbox'),roster=document.querySelector('#crewRoster');if(!inbox||!roster)return;
 for(const s of b.ships)ensureCrew(s);
 const reports=[...(b.crewInbox||[])].filter(r=>b.ships.find(s=>s.uid===r.shipUid)?.team==='P').sort((a,c)=>(c.status==='open')-(a.status==='open')||c.severity-a.severity||c.t-a.t);
 const open=reports.filter(r=>r.status==='open');document.querySelector('#openRequestCount').textContent=`${open.length} open`;
 inbox.innerHTML=(reports.slice(0,14).map(reportCard).join(''))||'<p class="quietTraffic">No significant reports. Captains are executing standing orders.</p>';
 roster.innerHTML=b.ships.filter(s=>s.team==='P').map(rosterCard).join('');
 inbox.querySelectorAll('[data-answer]').forEach(btn=>btn.onclick=()=>{const card=btn.closest('[data-report]');answerCrewRequest(b,card.dataset.report,btn.dataset.answer==='approve');refresh();});
}

install();setInterval(refresh,250);
