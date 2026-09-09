import {ensureCrew,answerCrewRequest} from './crew-system.js';
import {ensureHumanCrew,dismissOfficer,visibleAssessment,officerSummary,recordAdmiralDecision} from './crew-human-factors.js';
import {recordSocialDecision,socialSummary} from './fleet-social-system.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sevLabel=n=>n>=5?'CRITICAL':n>=4?'URGENT':n>=3?'IMPORTANT':n>=2?'ADVISORY':'INFO';
let lastNewestId=null;
function install(){
 const aside=document.querySelector('#battle>aside');if(!aside||document.querySelector('#crewInbox'))return;
 const wrap=document.createElement('section');wrap.className='crewPanel';wrap.innerHTML=`
   <div class="crewHead"><h2>Admiral's traffic</h2><span id="openRequestCount">0 open</span></div>
   <div id="crewInbox"></div>
   <details class="crewRosterWrap"><summary>Ship crews & appointments</summary><div id="crewRoster"></div></details>`;
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
function officerRow(s,p){
 const a=visibleAssessment(p),summary=officerSummary(p);
 return `<div class="officerRow" data-ship="${esc(s.uid)}" data-role="${esc(p.role)}">
   <div><b>${esc(p.title)}</b><span>${esc(p.name)}</span></div>
   <small><strong>${esc(a.label)}</strong> · ${esc(a.detail)}${summary.length?`<br>${summary.map(esc).join(' · ')}`:''}</small>
   <button data-dismiss>Dismiss</button>
 </div>`;
}
function rosterCard(s,b){
 const crew=ensureHumanCrew(s),people=Object.values(crew),social=socialSummary(s);
 return `<div class="rosterShip"><h3>${s.isFlagship?'★ ':''}${esc(s.name)}</h3>${social.length?`<p class="socialCue">Captain: ${social.map(esc).join(' · ')}</p>`:''}${people.map(p=>officerRow(s,p)).join('')}</div>`;
}
function bindDismiss(roster,b){
 roster.querySelectorAll('[data-dismiss]').forEach(btn=>btn.onclick=()=>{
   const row=btn.closest('.officerRow'),s=b.ships.find(x=>x.uid===row.dataset.ship);if(!s)return;
   const result=dismissOfficer(s,row.dataset.role);if(!result)return;
   b.log(`Admiral dismissed ${result.oldName}; ${result.newOfficer.name} promoted as ${result.newOfficer.title} aboard ${s.name}.`);
   refresh();
 });
}
function visibleTraffic(reports,b){
 const now=b.t||0;
 return reports.filter(r=>{
   if(r.request&&r.status==='open')return true;
   if((r.severity||0)>=3)return true;
   // Advisory chatter is only worth surfacing briefly when it is fresh. Routine info
   // stays in the underlying history but does not constantly compete for attention.
   if((r.severity||0)===2&&now-(r.t||0)<8)return true;
   return false;
 }).sort((a,c)=>(a.t||0)-(c.t||0));
}
function refresh(){
 const b=currentBattle();if(!b)return;
 const inbox=document.querySelector('#crewInbox'),roster=document.querySelector('#crewRoster');if(!inbox||!roster)return;
 for(const s of b.ships){ensureCrew(s);ensureHumanCrew(s)}
 const all=[...(b.crewInbox||[])].filter(r=>b.ships.find(s=>s.uid===r.shipUid)?.team==='P');
 const reports=visibleTraffic(all,b),open=all.filter(r=>r.status==='open'&&r.request);
 document.querySelector('#openRequestCount').textContent=`${open.length} open`;
 const shown=reports.slice(-18),newest=shown[shown.length-1]?.id||null;
 inbox.innerHTML=shown.length?shown.map(reportCard).join(''):'<p class="quietTraffic">No significant traffic. Captains are executing standing orders.</p>';
 roster.innerHTML=b.ships.filter(s=>s.team==='P').map(s=>rosterCard(s,b)).join('');
 inbox.querySelectorAll('[data-answer]').forEach(btn=>btn.onclick=()=>{
   const card=btn.closest('[data-report]'),r=(b.crewInbox||[]).find(x=>x.id===card.dataset.report),approved=btn.dataset.answer==='approve';
   answerCrewRequest(b,card.dataset.report,approved);recordAdmiralDecision(b,r,approved);recordSocialDecision(b,r,approved);refresh();
 });
 bindDismiss(roster,b);
 if(newest&&newest!==lastNewestId){lastNewestId=newest;requestAnimationFrame(()=>{inbox.scrollTop=inbox.scrollHeight})}
}
install();setInterval(refresh,300);
