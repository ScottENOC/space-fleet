import {blueprintToShip} from './shipyard.js';
import {makePremade} from './premades.js';

const KEY='spaceFleet.campaign.v1';
const clone=x=>JSON.parse(JSON.stringify(x));
const nowId=()=>Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-4);

function starterShip(name,hullId,ai='pursuit'){
  const bp=makePremade(hullId);bp.name=name;bp.ai=ai;
  return{id:'ship_'+nowId(),name,blueprint:bp,status:'active',xp:0,battles:0,kills:0,state:null,history:[]};
}
function defaultCampaign(){return{
  version:1,day:1,credits:1200,supplies:100,reputation:0,plotStage:0,location:'Haven Reach',
  ships:[starterShip('Resolute','frigate_line','broadside'),starterShip('Vigilant','frigate_sparrow','pursuit'),starterShip('Wayfarer','frigate_dart','pursuit')],
  activeShipIds:[],log:['Commissioned to independent fleet command at Haven Reach.'],pendingEncounter:null
}}
export function loadCampaign(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(x?.ships?.length)return x}catch{}const c=defaultCampaign();c.activeShipIds=c.ships.slice(0,3).map(s=>s.id);saveCampaign(c);return c}
export function saveCampaign(c){localStorage.setItem(KEY,JSON.stringify(c));return c}
export function resetCampaign(){const c=defaultCampaign();c.activeShipIds=c.ships.slice(0,3).map(s=>s.id);saveCampaign(c);return c}
export let campaign=loadCampaign();
export function refreshCampaign(){campaign=loadCampaign();return campaign}

function applySavedState(ship,entry){
  const st=entry.state;if(!st)return ship;
  const byId=new Map(ship.modules.map(m=>[m.id,m]));
  for(const sm of st.modules||[]){const m=byId.get(sm.id);if(!m)continue;m.hp=Math.min(m.maxHp||m.hp,sm.hp);if(Number.isFinite(sm.ammo)&&Number.isFinite(m.ammo))m.ammo=sm.ammo;if(Number.isFinite(sm.fightersRemaining))m.fightersRemaining=sm.fightersRemaining;if(Number.isFinite(sm.energyMWh))m.energyMWh=sm.energyMWh;if(Number.isFinite(sm.charge))m.charge=sm.charge;}
  ship.doctrineId=st.doctrineId||ship.doctrineId;ship.formationDiscipline=st.formationDiscipline||ship.formationDiscipline;
  return ship;
}
export function instantiateCampaignShip(entry,team='P'){
  const ship=blueprintToShip(entry.blueprint,team);ship.name=entry.name;ship.campaignShipId=entry.id;ship.campaignXp=entry.xp||0;applySavedState(ship,entry);return ship;
}
export function activePlayerShips(){const ids=new Set(campaign.activeShipIds||[]);return campaign.ships.filter(s=>ids.has(s.id)&&s.status==='active')}
export function campaignBuildSide(bp,count,team){
  if(team!=='P'||!window.__campaignActive)return null;
  const list=activePlayerShips();return list.length?list.map(s=>instantiateCampaignShip(s,'P')):null;
}
export function snapshotShip(ship){return{modules:ship.modules.map(m=>({id:m.id,hp:Math.max(0,m.hp||0),ammo:m.ammo,fightersRemaining:m.fightersRemaining,energyMWh:m.energyMWh,charge:m.charge})),doctrineId:ship.doctrineId,formationDiscipline:ship.formationDiscipline}}
export function persistBattleResults(battle){
  if(!window.__campaignActive||battle._campaignPersisted)return;battle._campaignPersisted=true;
  for(const ship of battle.ships.filter(s=>s.team==='P')){
    const entry=campaign.ships.find(x=>x.id===ship.campaignShipId);if(!entry)continue;
    entry.state=snapshotShip(ship);entry.battles=(entry.battles||0)+1;entry.xp=(entry.xp||0)+1;
    const keel=ship.modules.find(m=>m.id==='keel');
    if(ship.outcome==='captured')entry.status='captured';else if(ship.dead&&(!keel||keel.hp<=0))entry.status='lost';
    entry.history??=[];entry.history.push(`Day ${campaign.day}: ${ship.outcome|| (ship.dead?'combat ineffective':'survived')} at ${campaign.location}.`);entry.history=entry.history.slice(-20);
  }
  campaign.log??=[];campaign.log.push(`Day ${campaign.day}: battle concluded (${battle.winner||'no decisive winner'}).`);campaign.log=campaign.log.slice(-50);saveCampaign(campaign);
}
export function repairShip(id){const s=campaign.ships.find(x=>x.id===id);if(!s||s.status!=='active')return false;const cost=80+(s.state?.modules?.filter(m=>m.hp<=0).length||0)*20;if(campaign.credits<cost)return false;campaign.credits-=cost;s.state=null;s.history.push(`Day ${campaign.day}: repaired and rearmed at ${campaign.location}.`);saveCampaign(campaign);return true}
export function setActiveShips(ids){campaign.activeShipIds=[...new Set(ids)].slice(0,6);saveCampaign(campaign)}
export function advanceDay(n=1){campaign.day+=n;saveCampaign(campaign)}
