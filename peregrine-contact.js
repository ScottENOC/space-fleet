import {campaign,saveCampaign} from './campaign-core.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const RECON={
 traffic:{name:'Traffic census',cost:4,days:2,summary:'Remain passive and count heat signatures, transfer burns and navigation-lattice hand-offs.',finding:'Traffic analysis resolves a small but established human society rather than a stranded outpost. Life-support cycling and routine passenger movement suggest roughly 400–800 permanent residents spread across several linked habitats. Most traffic is utility craft; a handful of armed patrol hulls rotate through the outer lanes.'},
 habitat:{name:'Habitat and industry mapping',cost:5,days:2,summary:'Map thermal loads, agricultural lighting, fabrication signatures and propellant handling without active illumination.',finding:'PEREGRINE has one main rotating habitat cluster, two industrial annexes, closed-loop agriculture, ice processing and enough fabrication capacity to maintain local spacecraft. The settlement can survive independently, but nothing resembles a large military shipyard or mass-production economy.'},
 signals:{name:'Language and signal watch',cost:3,days:1,summary:'Record open civilian traffic and navigation chatter before transmitting anything of your own.',finding:'The spoken language is recognisably descended from contemporary trade English, with modest drift. Civil traffic repeatedly references “the First Passage”, “Origin Station”, and an annual “Twenty-Nine” memorial. ARGOSY is not forgotten history here — it is the settlement’s founding event.'}
};
function fresh(){return{recon:{traffic:false,habitat:false,signals:false},reconComplete:false,contactPolicy:null,contacted:false,trust:0,identity:null,response:null,history:[],complete:false,nextLead:null}}
function ensure(){campaign.mainPlot??={};campaign.mainPlot.peregrineContact??=fresh();const s=campaign.mainPlot.peregrineContact;s.recon??={traffic:false,habitat:false,signals:false};s.history??=[];return s}
function transit(){return campaign.mainPlot?.peregrine}
function core(){return campaign.mainPlot?.orisonCore}
function available(){return campaign.location==='Peregrine'&&!!transit()?.arrived}
function add(text){const s=ensure();s.history.push({day:campaign.day,text});campaign.log??=[];campaign.log.push(`Day ${campaign.day}: PEREGRINE contact — ${text}`)}
function finishRecon(){const s=ensure();if(s.reconComplete||!Object.values(s.recon).every(Boolean))return;s.reconComplete=true;add('Passive reconnaissance complete. PEREGRINE is a self-sustaining human settlement founded by ARGOSY’s evacuees and their descendants. Its outer patrols have not yet challenged the fleet, but navigation behaviour suggests they know an unregistered object is present.')}
export function peregrineContactSummary(){const s=ensure();return{...s,available:available(),reconOps:Object.entries(RECON).map(([id,r])=>({id,...r,resolved:!!s.recon[id],available:available()&&!s.recon[id]})),canContact:s.reconComplete&&!s.contacted}}
export function runPeregrineRecon(id){const s=ensure(),r=RECON[id];if(!available())return{ok:false,reason:'The fleet has not reached PEREGRINE.'};if(!r)return{ok:false,reason:'Unknown reconnaissance operation.'};if(s.recon[id])return{ok:false,reason:'That reconnaissance operation is already complete.'};if(campaign.supplies<r.cost)return{ok:false,reason:`This operation requires ${r.cost} supplies.`};campaign.supplies-=r.cost;campaign.day+=r.days;s.recon[id]=true;add(`${r.name}: ${r.finding}`);finishRecon();saveCampaign(campaign);return{ok:true}}
export function initiatePeregrineContact(policy){const s=ensure();if(!s.reconComplete)return{ok:false,reason:'Complete passive reconnaissance before choosing a first-contact posture.'};if(s.contacted)return{ok:false,reason:'First contact has already occurred.'};if(!['lineage','neutral','silent'].includes(policy))return{ok:false,reason:'Unknown first-contact posture.'};s.contactPolicy=policy;campaign.day+=1;
 const shared=core()?.disclosure==='share';
 if(policy==='lineage'){
   s.trust=clamp(s.trust+3+(shared?1:0),-6,8);s.identity='Peregrine Continuity Council';
   s.response='Your transmission is challenged twice, then answered by a human voice identifying the Peregrine Continuity Council. They authenticate fragments of ARGOSY’s departure ledger and ask for the names of ORISON’s caretakers. The Twenty-Nine are remembered individually in their founding rolls.';
   add('Fleet transmits ORISON archive lineage, ARGOSY personnel hashes and the reconstructed route history. PEREGRINE responds after a long authentication delay: “We know those names. Hold your present orbit. Do not energise another route.”');
 }else if(policy==='neutral'){
   s.trust=clamp(s.trust+1,-6,8);s.identity='Peregrine Continuity Council';
   s.response='A local patrol answers the neutral hail and routes it to the Peregrine Continuity Council. They confirm that their founders arrived aboard ARGOSY but withhold detailed records until they understand who you are and how you crossed the dead route.';
   add('Fleet makes a neutral identification with no sovereignty claim and no archive dump. PEREGRINE replies: “Unknown human fleet, hold outer-lane vector. Your language is recognised. Your route is not.”');
 }else{
   s.trust=clamp(s.trust-2,-6,8);s.identity='Peregrine Outer Watch';
   s.response='Before the fleet reaches the inner traffic lanes, two patrol craft illuminate it with active sensors and order it to stop. The settlement had tracked the anomalous arrival from the moment the route collapsed; silence is interpreted as deliberate concealment.';
   add('Fleet remains silent and edges deeper into the traffic envelope. PEREGRINE patrol craft intercept: “Unidentified fleet, cut thrust and hold. You entered through a route our founders buried. Silence is not consent to approach.”');
 }
 s.contacted=true;s.complete=true;s.nextLead='PEREGRINE_COUNCIL';campaign.mainPlot.act='peregrine-council';saveCampaign(campaign);return{ok:true,trust:s.trust,response:s.response}}

if(typeof window!=='undefined')window.__peregrineContact={peregrineContactSummary,runPeregrineRecon,initiatePeregrineContact};
