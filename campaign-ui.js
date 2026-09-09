import {campaign,saveCampaign,resetCampaign,repairShip,setActiveShips,advanceDay,persistBattleResults} from './campaign-core.js';
import {orderWithdraw,orderSurrender} from './battle-outcomes.js';
import {SYSTEMS,GOODS,ensureFrontierState,activeFleetProfile,cargoUsed,cargoFree,gateDecision,applyInspection,marketPrice,tradeGood,buyTradingHulk,generateContracts,completeAbstractContract} from './frontier-rules.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const R=()=>Math.random();
ensureFrontierState();

const ENCOUNTERS=[
 {id:'trade',title:'Merchant convoy',text:'A merchant convoy offers a profitable cargo contract through unsettled space.',kind:'trade'},
 {id:'explore',title:'Uncharted signal',text:'Long-range sensors have found an intermittent signal beyond the charted shipping lanes.',kind:'explore'},
 {id:'fight',title:'Pirate interception',text:'A pirate squadron is shadowing civilian traffic. You can move to intercept.',kind:'fight'},
 {id:'distress',title:'Distress beacon',text:'A damaged civilian vessel is transmitting a weak distress call from contested space.',kind:'distress'},
 {id:'salvage',title:'Derelict contact',text:'A cold hull is drifting without transponder or drive signature.',kind:'salvage'}
];
function choices(){let pool=[...ENCOUNTERS];if(campaign.location==='Nadir')pool.push(ENCOUNTERS.find(x=>x.kind==='fight'));if(campaign.location==='Kestrel')pool.push(ENCOUNTERS.find(x=>x.kind==='explore'));if(campaign.location==='Pelagos')pool.push(ENCOUNTERS.find(x=>x.kind==='trade'));return pool.sort(()=>R()-.5).slice(0,3)}
let currentChoices=[];

function install(){
 const nav=document.querySelector('.tabs');if(!nav||document.querySelector('[data-tab="campaign"]'))return;
 const btn=document.createElement('button');btn.className='tab';btn.dataset.tab='campaign';btn.textContent='Campaign';nav.prepend(btn);
 const pane=document.createElement('section');pane.id='campaign';pane.className='tabpane campaignPane';
 pane.innerHTML=`<div class="campaignWrap">
 <header class="campaignHead"><div><h2>Independent Fleet Command</h2><p>Regulated-gate frontier sandbox</p></div><button id="newCampaign">New campaign</button></header>
 <div id="campaignStatus"></div>
 <div class="campaignGrid">
  <section class="campaignCard"><h2>Fleet</h2><div id="fleetLegal"></div><div id="campaignFleet"></div><h2>Ship market</h2><div id="shipMarket"></div></section>
  <section class="campaignCard"><h2>Gate network</h2><div id="sectorMap"></div><h2>Contracts</h2><div id="contractBoard"></div><h2>Opportunities</h2><div id="encounterChoices"></div><button id="newChoices">Wait / scan again</button></section>
 </div>
 <div class="campaignGrid">
  <section class="campaignCard"><h2>Cargo & market</h2><div id="cargoMarket"></div></section>
  <section class="campaignCard"><h2>Authority & reputation</h2><div id="lawPanel"></div></section>
 </div>
 <section class="campaignCard"><h2>Command log</h2><div id="campaignLog"></div></section></div>`;
 document.querySelector('#shipyard')?.before(pane);
 btn.onclick=()=>show();
 document.querySelector('#newCampaign').onclick=()=>{if(confirm('Start a new campaign and erase current campaign progress?')){Object.assign(campaign,resetCampaign());ensureFrontierState();currentChoices=choices();render()}};
 document.querySelector('#newChoices').onclick=()=>{advanceDay(1);currentChoices=choices();render()};
 currentChoices=choices();render();
}
function show(){document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab==='campaign'));document.querySelectorAll('.tabpane').forEach(p=>p.classList.toggle('active',p.id==='campaign'));render()}
function hpSummary(entry){if(!entry.state)return'100% / fully serviced';const mods=entry.state.modules||[],alive=mods.filter(m=>m.hp>0).length;return`${alive}/${mods.length} modules operational`}
function shipCard(s){const active=(campaign.activeShipIds||[]).includes(s.id);return `<article class="campaignShip ${s.status!=='active'?'unavailable':''}" data-ship="${esc(s.id)}"><label><input type="checkbox" data-active ${active?'checked':''} ${s.status!=='active'?'disabled':''}> <b>${esc(s.name)}</b></label><span>${esc(s.blueprint?.hullId||'ship')} · ${esc(s.status)}</span><small>${esc(hpSummary(s))} · ${s.battles||0} battles · ${s.xp||0} experience</small><button data-repair ${s.status!=='active'?'disabled':''}>Repair/rearm</button></article>`}

function renderSector(){
 const host=document.querySelector('#sectorMap'),node=SYSTEMS[campaign.location]||SYSTEMS['Haven Reach'];
 host.innerHTML=`<div class="sectorCurrent"><b>${esc(campaign.location)}</b><small>${esc(node.note)}</small></div><div class="sectorLinks">${node.links.map(x=>`<button data-travel="${esc(x)}">Calculate route → ${esc(x)}</button>`).join('')}</div>`;
 host.querySelectorAll('[data-travel]').forEach(b=>b.onclick=()=>{
   const to=b.dataset.travel,decision=gateDecision(campaign.location,to);
   if(!decision.allowed){campaign.log.push(`Day ${campaign.day}: gate transit to ${to} denied — ${decision.reason}`);saveCampaign(campaign);alert(`Transit denied: ${decision.reason}`);render();return;}
   const from=campaign.location;campaign.location=to;campaign.day+=1;campaign.supplies=Math.max(0,campaign.supplies-5);campaign.log.push(`Day ${campaign.day}: ${from} → ${to}. ${decision.reason} 5 supplies consumed.`);
   const inspection=applyInspection(decision.risk||0);if(inspection.inspected)campaign.log.push(`Gate inspection: ${inspection.text}`);
   saveCampaign(campaign);currentChoices=choices();render();
 });
}
function renderFleetLegal(){const p=activeFleetProfile(),host=document.querySelector('#fleetLegal');const cls=p.suspicious>0?'Military / scrutinised':p.merchants?'Civilian convoy':'Naval force';host.innerHTML=`<div class="legalBadge"><b>${cls}</b><small>${p.merchants} merchant hull(s) · ${p.military} military ship(s) · escort allowance ${p.escortAllowance} · cargo ${cargoUsed()}/${p.cargoCapacity}</small></div>`}
function renderShipMarket(){const host=document.querySelector('#shipMarket');const offers=[['trader_mule','Mule trading hulk'],['trader_caravan','Caravan trading hulk'],['trader_leviathan','Galleon trading hulk']];host.innerHTML=offers.map(([id,label])=>{const h=window.__shipyardHulls?.[id];return `<button data-buyhull="${id}">${label}${h?.basePrice?` · ${h.basePrice} cr`:''}</button>`}).join('');host.querySelectorAll('[data-buyhull]').forEach(b=>b.onclick=()=>{const ship=buyTradingHulk(b.dataset.buyhull);if(!ship)alert('You cannot afford that hull.');else campaign.log.push(`Day ${campaign.day}: commissioned merchant vessel ${ship.name}.`);render()})}
function renderContracts(){const host=document.querySelector('#contractBoard'),contracts=generateContracts();host.innerHTML=contracts.map((c,i)=>`<article class="contract ${c.legal?'legal':'grey'}"><h3>${esc(c.title)} · ${c.pay} cr</h3><p>${esc(c.text)}</p><small>${c.legal?'Recognised legal work':'Off-books / legal risk'}</small><button data-contract="${i}">Accept</button></article>`).join('');host.querySelectorAll('[data-contract]').forEach(b=>b.onclick=()=>{const c=contracts[+b.dataset.contract];if(c.kind==='antiPiracy'||c.kind==='mercenary'){campaign.pendingEncounter={kind:'fight',title:c.title,contract:c,day:campaign.day};saveCampaign(campaign);launchCampaignBattle();return;}completeAbstractContract(c);currentChoices=choices();render()})}
function renderMarket(){const host=document.querySelector('#cargoMarket'),free=cargoFree();host.innerHTML=`<p>Capacity <b>${cargoUsed()}</b> used / <b>${cargoUsed()+free}</b> available. Cargo space comes only from fitted Cargo Hold modules.</p>`+Object.entries(GOODS).map(([id,g])=>{const q=campaign.cargo?.[id]?.qty||0,buy=marketPrice(id,campaign.location,true),sell=marketPrice(id,campaign.location,false);return `<div class="marketRow"><span><b>${esc(g.name)}</b>${g.illegal?' · restricted':''}<br><small>aboard ${q} · buy ${buy} / sell ${sell}</small></span><button data-buygood="${id}">Buy 5</button><button data-sellgood="${id}">Sell 5</button></div>`}).join('');host.querySelectorAll('[data-buygood]').forEach(b=>b.onclick=()=>{if(!tradeGood(b.dataset.buygood,5,true))alert('Insufficient cargo capacity or credits.');render()});host.querySelectorAll('[data-sellgood]').forEach(b=>b.onclick=()=>{if(!tradeGood(b.dataset.sellgood,5,false))alert('You do not have that cargo.');render()})}
function renderLaw(){const c=campaign.central||{};document.querySelector('#lawPanel').innerHTML=`<p><b>Terran Central Government</b><br>Standing ${Math.round(c.standing||0)} · lawfulness ${Math.round(c.lawfulness||0)} · recorded violations ${c.violations||0}</p><p>${c.auxiliary?'<b>Central Naval Auxiliary credentials active.</b>':c.militaryPermit?'Military gate-transit permit active.':'No general military transit permit.'}</p><p>Local governments may legally fight within their own solar system. Moving warships through regulated inter-system gates for somebody else’s war is another matter entirely.</p>`}
function render(){
 ensureFrontierState();const st=document.querySelector('#campaignStatus');if(!st)return;
 st.innerHTML=`<b>Day ${campaign.day}</b> · ${esc(campaign.location)} · <b>${campaign.credits} cr</b> · ${campaign.supplies} supplies · reputation ${campaign.reputation} · mystery clues ${campaign.plotStage}`;
 const fleet=document.querySelector('#campaignFleet');fleet.innerHTML=campaign.ships.map(shipCard).join('');
 fleet.querySelectorAll('[data-active]').forEach(x=>x.onchange=()=>{const ids=[...fleet.querySelectorAll('[data-active]:checked')].map(y=>y.closest('[data-ship]').dataset.ship);setActiveShips(ids);render()});
 fleet.querySelectorAll('[data-repair]').forEach(b=>b.onclick=()=>{const id=b.closest('[data-ship]').dataset.ship;if(!repairShip(id))alert('Insufficient credits or ship unavailable.');render()});
 renderFleetLegal();renderSector();renderShipMarket();renderContracts();renderMarket();renderLaw();
 const host=document.querySelector('#encounterChoices');host.innerHTML=currentChoices.map((e,i)=>`<article class="encounter"><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p><button data-enc="${i}">${e.kind==='fight'?'Intercept':'Proceed'}</button></article>`).join('');host.querySelectorAll('[data-enc]').forEach(b=>b.onclick=()=>resolveEncounter(currentChoices[+b.dataset.enc]));
 document.querySelector('#campaignLog').innerHTML=[...(campaign.log||[])].slice(-16).reverse().map(x=>`<div>${esc(x)}</div>`).join('');
}
function launchCampaignBattle(){if(!(campaign.activeShipIds||[]).length){alert('Assign at least one active ship.');return}saveCampaign(campaign);window.__campaignActive=true;document.querySelector('#reset')?.click();const b=window.__fleetBattle;if(b)b.campaignBattle=true;window.__campaignActive=false;document.querySelector('[data-tab="battle"]')?.click()}
function resolveEncounter(e){
 if(e.kind==='fight'){campaign.pendingEncounter={kind:'fight',title:e.title,day:campaign.day};launchCampaignBattle();return;}
 advanceDay(1);
 if(e.kind==='trade'){const gain=140+Math.floor(R()*180);campaign.credits+=gain;campaign.reputation+=1;campaign.contractsCompleted.trade=(campaign.contractsCompleted.trade||0)+1;campaign.log.push(`Day ${campaign.day}: escorted merchants successfully; earned ${gain} cr.`)}
 else if(e.kind==='explore'){const gain=15+Math.floor(R()*25);campaign.supplies+=gain;campaign.contractsCompleted.scout=(campaign.contractsCompleted.scout||0)+1;const clue=R()<.35;if(clue)campaign.plotStage+=1;campaign.log.push(`Day ${campaign.day}: surveyed the uncharted signal; recovered ${gain} supplies${clue?', and logged a strange navigational anomaly for later investigation':''}.`)}
 else if(e.kind==='distress'){const cost=20+Math.floor(R()*20);campaign.supplies=Math.max(0,campaign.supplies-cost);campaign.reputation+=2;campaign.log.push(`Day ${campaign.day}: rescued civilians at a cost of ${cost} supplies.`)}
 else {const gain=90+Math.floor(R()*170);campaign.credits+=gain;campaign.log.push(`Day ${campaign.day}: salvaged the derelict for ${gain} cr.`)}
 saveCampaign(campaign);currentChoices=choices();render();
}

function getBattle(){return window.__fleetBattle||null}
function installBattleOutcomeControls(){
 const orders=document.querySelector('.orders');if(!orders||document.querySelector('#withdrawShips'))return;
 const box=document.createElement('div');box.className='outcomeControls';box.innerHTML=`<h2>Survival orders</h2><button id="withdrawShips">Withdraw selected ship(s)</button><button id="withdrawFleet">Withdraw fleet</button><button id="surrenderShips">Surrender selected ship(s)</button><p>Withdrawal is physical. Ships must open enough range to escape; the enemy can pursue.</p>`;orders.append(box);
 const selected=()=>{const b=getBattle();if(!b)return[];const who=document.querySelector('#orderShips')?.value||'all';return b.ships.filter(s=>s.team==='P'&&!s.dead&&(who==='all'||s.uid===who))};
 document.querySelector('#withdrawShips').onclick=()=>{const b=getBattle();if(b)orderWithdraw(b,selected())};
 document.querySelector('#withdrawFleet').onclick=()=>{const b=getBattle();if(b)orderWithdraw(b,b.ships.filter(s=>s.team==='P'&&!s.dead))};
 document.querySelector('#surrenderShips').onclick=()=>{const b=getBattle();if(b&&confirm('Order selected ship(s) to surrender?'))orderSurrender(b,selected())};
}
function watchBattle(){const b=getBattle();if(!b||!b.campaignBattle)return;if(b.winner&&!b._campaignPersisted){const contract=campaign.pendingEncounter?.contract;persistBattleResults(b);campaign.pendingEncounter=null;campaign.day+=1;if(b.winner==='P'){const gain=contract?.pay||180;campaign.credits+=gain;campaign.reputation+=1;if(contract){campaign.contractsCompleted[contract.kind]=(campaign.contractsCompleted[contract.kind]||0)+1;campaign.central.standing+=(contract.legal?2:-2);}campaign.log.push(`Day ${campaign.day}: fleet action won; ${gain} cr recovered/paid.`)}else campaign.log.push(`Day ${campaign.day}: fleet action ended without victory.`);saveCampaign(campaign);render()}}

install();installBattleOutcomeControls();setInterval(watchBattle,400);
