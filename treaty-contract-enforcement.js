import {campaign} from './campaign-core.js';
import {generateContracts} from './frontier-rules.js';
import {FACTIONS} from './factions-system.js?v=77';
import {recordPlayerHostileAction} from './treaty-operations.js?v=108';

function activePlayerCommitments(targetFaction){
 return (campaign.factionTreaties?.treaties||[]).filter(t=>t.status==='active'&&((t.a==='player'&&t.b===targetFaction)||(t.b==='player'&&t.a===targetFaction))&&(t.clauses?.includes('neutrality')||t.clauses?.includes('nonAggression')));
}
function contractRisk(contract){
 if(!contract?.targetFaction)return null;
 const treaties=activePlayerCommitments(contract.targetFaction);
 if(!treaties.length)return null;
 const clauses=[...new Set(treaties.flatMap(t=>(t.clauses||[]).filter(c=>c==='neutrality'||c==='nonAggression')))];
 return{targetFaction:contract.targetFaction,targetName:FACTIONS[contract.targetFaction]?.short||contract.targetFaction,clauses,treaties};
}
function warningText(risk){const commitments=risk.clauses.map(c=>c==='neutrality'?'neutrality guarantee':'non-aggression commitment').join(' and ');return`Treaty conflict: accepting hostile work against ${risk.targetName} violates your ${commitments} and will open a diplomatic crisis.`}
function decorate(){
 const host=document.querySelector('#contractBoard');if(!host)return false;
 const contracts=generateContracts();let changed=false;
 host.querySelectorAll('[data-contract]').forEach(button=>{
  if(button.dataset.treatyWrapped==='1')return;
  const index=Number(button.dataset.contract),contract=contracts[index],risk=contractRisk(contract);if(!risk)return;
  button.dataset.treatyWrapped='1';
  const article=button.closest('.contract');if(article&&!article.querySelector('[data-treaty-risk]')){const note=document.createElement('small');note.dataset.treatyRisk='1';note.className='treatyRisk';note.textContent=warningText(risk);article.insertBefore(note,button);changed=true}
  const original=button.onclick;
  button.onclick=event=>{const current=generateContracts()[index]||contract,currentRisk=contractRisk(current);if(currentRisk&&!confirm(`${warningText(currentRisk)}\n\nAccept the contract anyway?`))return; if(currentRisk)recordPlayerHostileAction(currentRisk.targetFaction,`accepted ${current.title||'a hostile contract'} targeting ${currentRisk.targetName}`,2);return original?.call(button,event)};
 });
 return changed;
}
export function enforceTreatyContractAcceptance(){return decorate()}
if(typeof window!=='undefined'){window.__treatyContractEnforcement={enforceTreatyContractAcceptance};setInterval(decorate,700)}
