import {campaign,saveCampaign} from './campaign-core.js';
import {FACTIONS,ensureFactionState,localPowers} from './factions-system.js?v=68';

export const NPCS={
 central_vesper:{name:'Commodore Mara Vesper',title:'Naval liaison',faction:'central',home:'Sol Gateway',role:'naval',traits:['formal','strategic','lawful'],bio:'A Central Navy officer responsible for deciding which independent captains are useful enough to trust.'},
 haven_okafor:{name:'Director Elias Okafor',title:'Port Authority Director',faction:'haven',home:'Haven Reach',role:'administrator',traits:['cautious','procedural','pragmatic'],bio:'Keeps Haven Reach moving by treating logistics, permits and piracy as parts of the same problem.'},
 pelagosa_sato:{name:'Admiral Ren Sato',title:'Compact Defence Commander',faction:'pelagosA',home:'Pelagos',role:'naval',traits:['disciplined','integrationist','hardline'],bio:'Believes Pelagos survives only through unified defence and centralised command.'},
 pelagosb_iman:{name:'Councillor Imani Vale',title:'Free Ports Security Convenor',faction:'pelagosB',home:'Pelagos',role:'political',traits:['commercial','independent','diplomatic'],bio:'A port-city politician who prefers contracts, leverage and fast ships to standing bureaucracy.'},
 meridian_chen:{name:'Sofia Chen',title:'Meridian Route Director',faction:'meridian',home:'Pelagos',role:'merchant',traits:['connected','calculating','reliable'],bio:'Controls convoy schedules worth more than some frontier governments and remembers captains who deliver.'},
 kestrel_adebayo:{name:'Chair Tunde Adebayo',title:'Colonial Council Chair',faction:'kestrel',home:'Kestrel',role:'political',traits:['patient','localist','resourceful'],bio:'Tries to govern a system where settlements are farther apart than the institutions meant to bind them.'},
 orpheus_malik:{name:'Dr Sana Malik',title:'Orpheus Operations Chief',faction:'orpheus',home:'Kestrel',role:'industrial',traits:['technical','unsentimental','expansionist'],bio:'Measures frontier security in tonnes shipped, reactors online and claims kept productive.'},
 guard_reyes:{name:'Captain Tomas Reyes',title:'Mutual Defence Coordinator',faction:'frontierGuard',home:'Kestrel',role:'militia',traits:['protective','improvisational','plainspoken'],bio:'A former escort captain trying to make volunteer defence forces act like a fleet when it matters.'},
 nadir_rahman:{name:'Speaker Leila Rahman',title:'Settlements League Speaker',faction:'nadir',home:'Nadir',role:'political',traits:['practical','suspicious','community-minded'],bio:'Represents habitats that cannot rely on anyone arriving in time to save them.'},
 redknives_varga:{name:'Rook Varga',title:'Red Knives flotilla chief',faction:'redKnives',home:'Nadir',role:'pirate',traits:['predatory','patient','collector'],bio:'Prefers intact prizes to wreckage. Varga crews train to cripple drives, close fast and take ships alive.'},
 blackwake_morrow:{name:'Nyx Morrow',title:'Black Wake broker-captain',faction:'blackWake',home:'Nadir',role:'underworld',traits:['elusive','transactional','deceptive'],bio:'A smuggler, information broker and sometime raider whose loyalties are mostly contractual.'}
};

function ensureRecord(id){const n=NPCS[id];if(!n)return null;campaign.npcs??={};campaign.npcs[id]??={relationship:0,met:false,alive:true,lastSeen:null,jobsCompleted:0,jobsFailed:0,notes:[]};return campaign.npcs[id]}
export function ensureNpcState(){ensureFactionState();for(const id of Object.keys(NPCS))ensureRecord(id);saveCampaign(campaign);return campaign.npcs}
export function npc(id){ensureNpcState();const base=NPCS[id],state=campaign.npcs[id];return base?{id,...base,state}:null}
export function factionNpcs(faction){ensureNpcState();return Object.keys(NPCS).filter(id=>NPCS[id].faction===faction).map(npc).filter(x=>x.state.alive)}
export function localNpcs(system=campaign.location){ensureNpcState();const powers=new Set(localPowers(system).map(x=>x.id));return Object.keys(NPCS).filter(id=>NPCS[id].home===system||powers.has(NPCS[id].faction)).map(npc).filter(x=>x.state.alive)}
export function issuerNpc(faction,kind=''){const people=factionNpcs(faction);if(!people.length)return null;const preferred=people.find(x=>(kind==='escort'&&x.role==='merchant')||(kind==='government'&&x.role==='naval')||(kind==='antiPiracy'&&['naval','militia','administrator'].includes(x.role))||(kind==='mercenary'&&['naval','political'].includes(x.role))||(kind==='smuggling'&&['pirate','underworld'].includes(x.role)));return preferred||people[0]}
export function changeNpcRelationship(id,delta,note=''){const st=ensureRecord(id);if(!st)return 0;st.met=true;st.lastSeen=campaign.day;st.relationship=Math.max(-100,Math.min(100,Math.round(st.relationship+delta)));if(note){st.notes??=[];st.notes.push(`Day ${campaign.day}: ${note}`);st.notes=st.notes.slice(-12)}saveCampaign(campaign);return st.relationship}
export function recordNpcContract(id,success=true){const st=ensureRecord(id);if(!st)return;if(success)st.jobsCompleted=(st.jobsCompleted||0)+1;else st.jobsFailed=(st.jobsFailed||0)+1;changeNpcRelationship(id,success?3:-3,success?'Contract completed successfully.':'Contract failed or abandoned.')}
export function relationshipLabel(v){if(v<=-50)return'hostile';if(v<=-15)return'wary';if(v<15)return'unfamiliar';if(v<40)return'positive';if(v<70)return'trusted';return'close associate'}

if(typeof window!=='undefined')window.__campaignNPCs={NPCS,npc,localNpcs,changeNpcRelationship};
