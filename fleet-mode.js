import {Battle,initialiseShip,buildPursuitFrigate} from './sim.js';
import {blueprintToShip} from './shipyard.js';
import {makeTradingPremade} from './trading-hulks.js';
import {campaign,activePlayerShips,instantiateCampaignShip,applySavedState} from './campaign-core.js';
import {campaignEnemyFleet} from './faction-fleet-identity.js?v=73';

const DEFAULT_PRIORITY=['weapons','engine','reactor','bridge','shield','radiator','armor','hull'];

function nearestEnemy(battle,s){
  const enemies=battle.ships.filter(o=>!o.dead&&o.team!==s.team);
  if(!enemies.length)return null;
  const ordered=s.commandTargetId?enemies.find(o=>o.uid===s.commandTargetId):null;
  if(ordered)return ordered;
  return enemies.sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y))[0];
}

Battle.prototype.enemy=function(s){return nearestEnemy(this,s)};
Battle.prototype.checkDeaths=function(){
  for(const s of this.ships){
    if(s.dead)continue;
    const hull=s.modules.find(m=>m.id==='keel');
    const bridge=s.modules.some(m=>m.type==='bridge'&&m.hp>0&&!m.disabled);
    const reactor=s.modules.some(m=>m.type==='reactor'&&m.hp>0&&!m.disabled);
    const engines=s.modules.some(m=>m.type==='engine'&&m.hp>0&&!m.disabled);
    if(!hull||hull.hp<=0||!bridge||(!reactor&&!engines)){
      s.dead=true;s.outcome=s.outcome||'combat ineffective';
      this.log(`${s.name} is combat ineffective.`);
    }
  }
  const livingTeams=[...new Set(this.ships.filter(s=>!s.dead&&!s.escaped&&!s.surrendered).map(s=>s.team))];
  if(livingTeams.length<=1){
    this.winner=livingTeams[0]||'draw';
    if(livingTeams[0])for(const s of this.ships)if(!s.dead&&s.team===livingTeams[0])s.kills++;
  }
};

function makeHazardConvoy(count=2){
 return Array.from({length:Math.max(1,count)},(_,i)=>{
   const hull=i%2?'trader_mule':'trader_caravan',bp=makeTradingPremade(hull),s=blueprintToShip(bp,'P');
   s.name=`Convoy merchant ${i+1}`;s.civilianEscort=true;s.hazardConvoyIndex=i;s.ai='pursuit';return s;
 });
}

export function createFleetBattle(playerShips,enemyShips,seed=1){
  let campaignEntries=null,nonCombatScenario=null,playerCombatCount=playerShips.length;
  if(typeof window!=='undefined'&&window.__campaignActive){
    const persistent=activePlayerShips(),enc=campaign.pendingEncounter;
    if(persistent.length){
      campaignEntries=persistent;playerShips=persistent.map(x=>instantiateCampaignShip(x,'P'));playerCombatCount=playerShips.length;
      if(enc?.kind==='hazardEscort'){
        nonCombatScenario='meteorEscort';playerShips=[...playerShips,...makeHazardConvoy(enc.convoyCount||2)];enemyShips=[];
      }else enemyShips=campaignEnemyFleet(persistent.length);
    }
  }
  if(!playerShips.length||(!enemyShips.length&&!nonCombatScenario))throw new Error('Each side needs at least one ship unless a non-combat tactical scenario is active.');
  const seedOpponent=enemyShips[0]||buildPursuitFrigate('E'),b=new Battle(playerShips[0],seedOpponent,seed);
  const all=[...playerShips.map((s,i)=>({s,team:'P',i})),...enemyShips.map((s,i)=>({s,team:'E',i}))];
  b.ships=all.map(({s,team,i})=>{
    s.team=team;
    initialiseShip(s);
    if(team==='P'&&i<playerCombatCount&&campaignEntries?.[i])applySavedState(s,campaignEntries[i]);
    s.uid=`${team}${i+1}`;
    s.commandTargetId=null;
    if(!Array.isArray(s.targetPriority)||!s.targetPriority.length)s.targetPriority=[...DEFAULT_PRIORITY];
    s.ramPolicy=team==='P'?'discretion':null;
    const lane=(i-(team==='P'?(playerShips.length-1)/2:(enemyShips.length-1)/2))*420;
    Object.assign(s,{x:team==='P'?-1500:1500,y:lane,angle:team==='P'?.08:Math.PI+.08,vx:0,vy:0,omega:0,dead:false,escaped:false,surrendered:false});
    return s;
  });
  if(nonCombatScenario){
    b.nonCombatScenario=nonCombatScenario;b.campaignBattle=true;
    const combat=b.ships.filter(s=>!s.civilianEscort),civ=b.ships.filter(s=>s.civilianEscort);
    combat.forEach((s,i)=>Object.assign(s,{x:-650,y:(i-(combat.length-1)/2)*260,angle:0}));
    civ.forEach((s,i)=>Object.assign(s,{x:-1450,y:(i-(civ.length-1)/2)*320,angle:0}));
  }
  b.projectiles=[];b.events=[];b.winner=null;b.t=0;
  if(typeof window!=='undefined')window.__fleetBattle=b;
  return b;
}

export function applyTargetOrder(battle,{recipient='all',target='any',priority='default'}={}){
  const players=battle.ships.filter(s=>s.team==='P'&&!s.dead&&!s.civilianEscort&&(recipient==='all'||s.uid===recipient));
  const chosenTarget=target==='any'?null:target;
  const preferred=priority==='default'?DEFAULT_PRIORITY:[priority,...DEFAULT_PRIORITY.filter(x=>x!==priority)];
  for(const s of players){s.commandTargetId=chosenTarget;s.targetPriority=[...preferred];}
  return players;
}

export {DEFAULT_PRIORITY};
