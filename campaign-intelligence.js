import {campaign,saveCampaign} from './campaign-core.js';
import {FACTIONS} from './factions-system.js?v=77';

const LEVELS={unknown:0,suspected:1,confirmed:2,coordinates:3,technical:4};
function store(){campaign.intelligence??={topics:{},history:[]};campaign.intelligence.topics??={};campaign.intelligence.history??=[];return campaign.intelligence}
function topic(id){const s=store();s.topics[id]??={id,factions:{},public:false};s.topics[id].factions??={};return s.topics[id]}
function levelValue(x){return LEVELS[x]??0}
export function knowledge(topicId,factionId){const k=topic(topicId).factions[factionId];return k?{...k}:{level:'unknown',source:null,day:null}}
export function knows(topicId,factionId,min='confirmed'){return levelValue(knowledge(topicId,factionId).level)>=levelValue(min)}
export function grantKnowledge(topicId,factionId,level='confirmed',source='unknown'){if(!FACTIONS[factionId])return null;const t=topic(topicId),old=t.factions[factionId];if(old&&levelValue(old.level)>=levelValue(level))return old;const entry={level,source,day:campaign.day};t.factions[factionId]=entry;store().history.push({day:campaign.day,topicId,factionId,level,source});store().history=store().history.slice(-80);saveCampaign(campaign);return entry}
export function publishKnowledge(topicId,level='confirmed',source='public disclosure'){const t=topic(topicId);t.public=true;for(const id of Object.keys(FACTIONS))grantKnowledge(topicId,id,level,source);saveCampaign(campaign);return t}
export function knowledgeSummary(topicId){const t=topic(topicId);return{public:!!t.public,factions:Object.entries(FACTIONS).map(([id,faction])=>({id,name:faction.name,...knowledge(topicId,id)})).sort((a,b)=>levelValue(b.level)-levelValue(a.level))}}
if(typeof window!=='undefined')window.__campaignIntelligence={knowledge,knows,grantKnowledge,publishKnowledge,knowledgeSummary};
