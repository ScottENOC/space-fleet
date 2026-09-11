import {campaign} from './campaign-core.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let activeStation='ops';
const STATIONS=[['ops','OPS'],['fleet','FLEET'],['nav','NAV'],['cargo','CARGO'],['intel','INTEL'],['log','LOG']];
function stationFor(card){if(card.querySelector('#campaignFleet'))return'fleet';if(card.querySelector('#sectorMap'))return'ops';if(card.querySelector('#cargoMarket'))return'cargo';if(card.querySelector('#lawPanel'))return'intel';if(card.querySelector('#campaignLog'))return'log';return null}
function labelFor(id){return({fleet:'FLEET CONTROL',ops:'OPERATIONS',nav:'NAVIGATION',cargo:'CARGO / TRADE',intel:'INTELLIGENCE / AUTHORITY',log:"SHIP'S LOG"})[id]||id.toUpperCase()}
function relabel(){
 const map=new Map([['Fleet','Fleet status'],['Ship market','Dockyard / procurement'],['Gate network','Navigation'],['Contracts','Operations board'],['Opportunities','Sensor / traffic'],['Cargo & market','Cargo / trade'],['Authority & reputation','Intelligence / authority'],['Command log',"Ship's log"]]);
 $$('#campaign .campaignCard>h2').forEach(h=>{const n=map.get(h.textContent.trim());if(n)h.textContent=n});
 const scan=$('#newChoices');if(scan)scan.textContent='ADVANCE WATCH / RESCAN';
 const reset=$('#newCampaign');if(reset)reset.textContent='RESET CAMPAIGN';
}
function installChrome(){
 const wrap=$('#campaign .campaignWrap');if(!wrap||$('.bridgeCommandRail'))return;
 const rail=document.createElement('section');rail.className='bridgeCommandRail';rail.innerHTML=`<div class="bridgeIdentity"><i class="bridgeMark"></i><div><b>BRIDGE // COMMAND DECK</b><small>INDEPENDENT FLEET COMMAND</small></div></div><div class="bridgeSituation"><strong id="bridgeLocation">—</strong><span id="bridgeDay">DAY —</span></div><div class="bridgeResources"><div class="bridgeResource"><span>CREDITS</span><b id="bridgeCredits">—</b></div><div class="bridgeResource"><span>SUPPLIES</span><b id="bridgeSupplies">—</b></div><div class="bridgeResource"><span>REP</span><b id="bridgeRep">—</b></div><div class="bridgeResource"><span>CLUES</span><b id="bridgeClues">—</b></div></div>`;wrap.prepend(rail);
 const bar=document.createElement('nav');bar.className='bridgeStationBar';bar.setAttribute('aria-label','Bridge stations');bar.innerHTML=STATIONS.map(([id,label])=>`<button type="button" data-bridge-station="${id}">${label}</button>`).join('');wrap.append(bar);
 bar.querySelectorAll('button').forEach(b=>b.onclick=()=>showStation(b.dataset.bridgeStation));
 const head=$('#campaign .campaignHead');if(head){const util=document.createElement('div');util.className='bridgeUtility';const reset=$('#newCampaign');if(reset)util.append(reset);wrap.append(util)}
 relabel();tagStations();showStation(activeStation);
}
function tagStations(){for(const card of $$('#campaign .campaignCard')){const id=stationFor(card);if(!id)continue;card.dataset.bridgeStationCard=id;card.dataset.bridgeLabel=labelFor(id)}}
function splitOperations(mode){
 const card=$('#sectorMap')?.closest('.campaignCard');if(!card)return;
 const nav=$('#sectorMap'),contracts=$('#contractBoard'),encounters=$('#encounterChoices'),scan=$('#newChoices');
 const heads=[...card.querySelectorAll(':scope>h2')],navHead=heads.find(h=>h.textContent.trim().toLowerCase()==='navigation'),opsHead=heads.find(h=>h.textContent.trim().toLowerCase()==='operations board'),trafficHead=heads.find(h=>h.textContent.trim().toLowerCase()==='sensor / traffic');
 const navMode=mode==='nav';for(const el of [nav,navHead])el?.classList.toggle('bridgeOpsHidden',!navMode);for(const el of [contracts,encounters,scan,opsHead,trafficHead])el?.classList.toggle('bridgeOpsHidden',navMode);card.dataset.bridgeLabel=labelFor(navMode?'nav':'ops');
}
function showStation(id){activeStation=id||'ops';for(const card of $$('#campaign [data-bridge-station-card]')){const station=card.dataset.bridgeStationCard,visible=station===activeStation||((activeStation==='nav'||activeStation==='ops')&&station==='ops');card.classList.toggle('bridgeStationHidden',!visible)}splitOperations(activeStation);for(const b of $$('.bridgeStationBar [data-bridge-station]'))b.classList.toggle('active',b.dataset.bridgeStation===activeStation);window.scrollTo({top:0,behavior:'smooth'})}
function syncRail(){
 const active=$('#campaign')?.classList.contains('active');document.body.classList.toggle('campaignBridgeActive',!!active);if(!active)return;
 $('#bridgeLocation')&&( $('#bridgeLocation').textContent=campaign.location||'UNKNOWN SYSTEM');
 $('#bridgeDay')&&( $('#bridgeDay').textContent=`DAY ${campaign.day??'—'}`);
 $('#bridgeCredits')&&( $('#bridgeCredits').textContent=`${campaign.credits??0} cr`);
 $('#bridgeSupplies')&&( $('#bridgeSupplies').textContent=String(campaign.supplies??0));
 $('#bridgeRep')&&( $('#bridgeRep').textContent=String(campaign.reputation??0));
 $('#bridgeClues')&&( $('#bridgeClues').textContent=String(campaign.plotStage??0));
 const ops=$('[data-bridge-station="ops"]');if(ops)ops.classList.toggle('hasAlert',!!campaign.pendingEncounter);
 const fleet=$('[data-bridge-station="fleet"]');if(fleet)fleet.classList.toggle('hasAlert',(campaign.ships||[]).some(s=>s.status!=='active'));
}
function install(){installChrome();tagStations();relabel();syncRail()}
install();setInterval(install,250);
