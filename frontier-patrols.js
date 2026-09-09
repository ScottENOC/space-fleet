import {campaign,saveCampaign} from './campaign-core.js';
import {SYSTEMS,ensureFrontierState,applyInspection} from './frontier-rules.js';

function launchPatrolBattle(){
  campaign.central.violations=(campaign.central.violations||0)+1;
  campaign.central.standing=(campaign.central.standing||0)-15;
  campaign.central.lawfulness=(campaign.central.lawfulness||0)-20;
  campaign.pendingEncounter={kind:'fight',title:'Central Government patrol action',centralPatrol:true,day:campaign.day};
  campaign.log.push(`Day ${campaign.day}: refused a Central patrol order to heave to. Weapons free.`);saveCampaign(campaign);
  window.__campaignActive=true;document.querySelector('#reset')?.click();const b=window.__fleetBattle;if(b)b.campaignBattle=true;window.__campaignActive=false;document.querySelector('[data-tab="battle"]')?.click();
}
function shouldChallenge(){ensureFrontierState();const s=SYSTEMS[campaign.location];if(!s||s.authority<.3)return false;const c=campaign.central;return (c.violations||0)>0||(c.lawfulness||0)<-8||(c.standing||0)<0;}
function render(){
 const host=document.querySelector('#lawPanel');if(!host||document.querySelector('#patrolChallenge')||!shouldChallenge())return;
 const box=document.createElement('div');box.id='patrolChallenge';box.className='patrolChallenge';box.innerHTML=`<h3>Central patrol challenge</h3><p>A patrol cutter has ordered the fleet to heave to for inspection. They have not opened fire.</p><div><button data-submit>Submit to inspection</button><button data-talk>Call in a favour</button><button data-resist>Refuse / prepare to fight</button></div>`;host.append(box);
 box.querySelector('[data-submit]').onclick=()=>{const r=applyInspection(1);campaign.log.push(`Day ${campaign.day}: submitted to Central patrol inspection. ${r.text||'Inspection completed.'}`);if(!r.caught)campaign.central.standing=(campaign.central.standing||0)+1;saveCampaign(campaign);box.remove()};
 box.querySelector('[data-talk]').onclick=()=>{const chance=Math.max(.08,Math.min(.8,.2+(campaign.central.standing||0)/100));if(Math.random()<chance){campaign.log.push(`Day ${campaign.day}: a contact vouched for the fleet; patrol released you.`);campaign.central.standing-=2}else{campaign.log.push(`Day ${campaign.day}: your contact could not make the patrol disappear.`);campaign.central.standing-=1}saveCampaign(campaign);box.remove()};
 box.querySelector('[data-resist]').onclick=()=>{if(confirm('Refusing a lawful patrol order will seriously damage your Central standing. Continue?'))launchPatrolBattle()};
}
setInterval(render,500);
