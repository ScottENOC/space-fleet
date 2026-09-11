import {campaign} from './campaign-core.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let activeStation='ops';
const STATIONS=[['ops','OPS'],['fleet','FLEET'],['nav','NAV'],['cargo','CARGO'],['intel','INTEL'],['log','LOG']];
function text(id,fallback='—'){const el=$(id);return el?.textContent?.trim()||fallback}
function stationFor(card){if(card.querySelector('#campaignFleet'))return'fleet';if(card.querySelector('#sectorMap'))return'ops';if(card.querySelector('#cargoMarket'))return'cargo';if(card.querySelector('#lawPanel'))return'intel';if(card.querySelector('#campaignLog'))return'log';return null}
function labelFor(id){return({fleet:'FLEET CONTROL',ops:'OPERATIONS / NAVIGATION',nav:'NAVIGATION',cargo:'CARGO / TRADE',intel:'INTELLIGENCE / AUTHORITY',log:"SHIP'S LOG"})[id]||id.toUpperCase()}
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
function showStation(id){activeStation=id||'ops';for(const card of $$('#campaign [data-bridge-station-card]')){const station=card.dataset.bridgeStationCard;let visible=station===activeStation;if(activeStation==='nav'&&station==='ops')visible=true;card.classList.toggle('bridgeStationHidden',!visible)}for(const b of $$('.bridgeStationBar [data-bridge-station]'))b.classList.toggle('active',b.dataset.bridgeStation===activeStation);if(activeStation==='nav')$('#sectorMap')?.scrollIntoView({block:'start',behavior:'smooth'})}
function syncRail(){
 if(!$('#campaign')?.classList.contains('active'))return;
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
