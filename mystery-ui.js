import {campaign} from './campaign-core.js';
import {investigationSummary,resolveLead,migrateLegacyMystery} from './mystery-system.js?v=72';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let signature='';
let migrated=false;
function ensureHost(){const law=document.querySelector('#lawPanel');if(!law)return null;let host=document.querySelector('#investigationPanel');if(!host){host=document.createElement('section');host.id='investigationPanel';host.className='investigationPanel';law.after(host)}return host}
function contextCard(c){if(!c)return'';return `<article class="mysteryDirective"><b>${esc(c.title)}</b><p>${esc(c.text)}</p>${c.rules?`<ul>${c.rules.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}</article>`}
function syncStatus(s){const clues=document.querySelector('#bridgeClues');if(clues){const label=clues.previousElementSibling;if(label)label.textContent='INTEL';clues.textContent=String(s.evidence.length)}const st=document.querySelector('#campaignStatus');if(st)st.innerHTML=st.innerHTML.replace(/mystery clues\s+\d+/i,`${s.evidence.length} intel item${s.evidence.length===1?'':'s'}`)}
function render(){
 const host=ensureHost();if(!host)return;if(!migrated){migrateLegacyMystery();migrated=true}const s=investigationSummary();syncStatus(s);const sig=JSON.stringify([campaign.location,campaign.day,s.evidence.map(x=>x.id),s.resolvedLeads,s.hypotheses,campaign.factionRep,campaign.central?.auxiliary]);if(sig===signature)return;signature=sig;
 host.innerHTML=`<div class="mysteryHead"><div><small>ACTIVE INVESTIGATION</small><h3>${esc(s.name)}</h3></div><strong>${s.evidence.length} evidence item${s.evidence.length===1?'':'s'}</strong></div><p class="mysterySummary">${esc(s.summary)}</p>
 ${contextCard(s.context.navy)}${contextCard(s.context.merchant)}${contextCard(s.context.underworld)}
 <div class="mysteryBlock"><b>EVIDENCE</b>${s.evidence.length?s.evidence.map(e=>`<article class="evidence"><span>${esc(e.title)}</span><small>${esc(e.confidence.toUpperCase())} CONFIDENCE // ${esc(e.source)}</small><p>${esc(e.text)}</p></article>`).join(''):'<p>No hard evidence logged yet. The disappearances are currently only a frontier rumour. Better faction access may expose useful records or witnesses.</p>'}</div>
 <div class="mysteryBlock"><b>WORKING HYPOTHESES</b><div class="hypothesisGrid">${s.hypotheses.map(h=>`<div><span>${esc(h.label)}</span><strong>${esc(h.strength.toUpperCase())}</strong></div>`).join('')}</div></div>
 <div class="mysteryBlock"><b>LEADS</b>${s.leads.length?s.leads.map(l=>`<article class="lead ${l.available?'available':''}"><span>${esc(l.title)}${l.system?` // ${esc(l.system)}`:''}</span><p>${esc(l.description)}</p>${l.available?`<button data-lead="${esc(l.id)}">Pursue lead${l.cost?` · ${l.cost} supplies`:''}</button>`:'<small>Not currently in-system.</small>'}</article>`).join(''):'<p>No actionable lead yet. Improving standing with Meridian, Central or the Nadir underworld can open very different routes into the same case.</p>'}</div>`;
 host.querySelectorAll('[data-lead]').forEach(b=>b.onclick=()=>{const r=resolveLead(b.dataset.lead);if(!r.ok)alert(r.reason||'Unable to pursue that lead.');signature='';render()});
}
render();setInterval(render,400);
