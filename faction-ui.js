import {campaign} from './campaign-core.js';
import {generateContracts} from './frontier-rules.js';
import {FACTIONS,ensureFactionState,localPowers,factionSummary,relationLabel} from './factions-system.js?v=68';

const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function standingLabel(v){if(v<=-50)return'hostile';if(v<=-15)return'distrusted';if(v<15)return'unknown';if(v<45)return'trusted';if(v<70)return'favoured';return'close ally'}
function ensureHosts(){
 const law=$('#lawPanel');if(law&&!$('#factionIntel')){const x=document.createElement('section');x.id='factionIntel';x.className='factionIntel';law.append(x)}
 const map=$('#sectorMap');if(map&&!$('#localPowers')){const x=document.createElement('section');x.id='localPowers';x.className='localPowers';map.append(x)}
}
function powerCard(x,compact=false){
 const f=x.faction,s=factionSummary(x.id),rep=x.playerStanding||0,worst=s?.worst&&FACTIONS[s.worst.id],best=s?.best&&FACTIONS[s.best.id];
 return `<article class="factionPower ${f.lawful?'lawful':'outlaw'}" data-faction="${esc(x.id)}"><div class="factionPowerHead"><i style="--faction:${esc(f.colour)}"></i><div><b>${esc(f.short)}</b><small>${esc(f.kind.toUpperCase())}${compact?` · ${Math.round(x.presence*100)}% PRESENCE`:''}</small></div><strong>${rep>=0?'+':''}${rep}</strong></div>${compact?'':`<p>${esc(f.description)}</p><div class="factionMetrics"><span>Local presence <b>${Math.round(x.presence*100)}%</b></span><span>Fleet standing <b>${esc(standingLabel(rep))}</b></span><span>Power <b>${s?.state?.power??'—'}</b></span><span>Military <b>${s?.state?.military??'—'}</b></span></div><div class="factionRelations">${best?`Closest: <b>${esc(best.short)}</b> (${esc(relationLabel(s.best.value))})`:''}${worst?` · Rival: <b>${esc(worst.short)}</b> (${esc(relationLabel(s.worst.value))})`:''}</div>`}</article>`;
}
function render(){
 ensureFactionState();ensureHosts();
 const powers=localPowers(campaign.location),local=$('#localPowers'),intel=$('#factionIntel');
 if(local)local.innerHTML=`<div class="factionSectionLabel">LOCAL POWER PICTURE</div><div class="localPowerGrid">${powers.slice(0,4).map(x=>powerCard(x,true)).join('')}</div>`;
 if(intel)intel.innerHTML=`<div class="factionSectionLabel">LOCAL POWERS // ${esc(campaign.location).toUpperCase()}</div>${powers.map(x=>powerCard(x,false)).join('')}`;
 const contracts=generateContracts();document.querySelectorAll('#contractBoard .contract').forEach((card,i)=>{const c=contracts[i];if(!c)return;let tag=card.querySelector('.contractIssuer');if(!tag){tag=document.createElement('small');tag.className='contractIssuer';card.querySelector('h3')?.after(tag)}tag.textContent=`ISSUER // ${c.issuerName||FACTIONS[c.issuer]?.name||'Unknown principal'}`});
}
render();setInterval(render,350);
