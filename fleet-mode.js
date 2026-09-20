import {Battle,initialiseShip,buildPursuitFrigate} from './sim.js';
import {blueprintToShip} from './shipyard.js';
import {makeTradingPremade} from './trading-hulks.js';
import {campaign,activePlayerShips,instantiateCampaignShip,applySavedState} from './campaign-core.js';
import {campaignEnemyFleet,makeFactionEnemyFleet} from './faction-fleet-identity.js?v=77';

const DEFAULT_PRIORITY=['weapons','engine','reactor','bridge','shield','radiator','armor','hull'];

function nearestEnemy(battle,s){
  const enemies=battle.ships.filter(o=>!o.dead&&o.team!==s.team&&!o.missionNonHostile&&!o.missionDerelict);
  if(!enemies.length)return null;
  const ordered=s.commandTargetId?enemies.find(o=>o.uid===s.commandTargetId):null;
  if(ordered)return ordered;
  return enemies.sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y))[0];
}

Battle.prototype.enemy=function(s){return nearestEnemy(this,s)};
Battle.prototype.checkDeaths=function(){
  for(const s of this.ships){
    if(s.dead||s.missionDerelict)continue;
    const hull=s.modules.find(m=>m.id==='keel');
    const bridge=s.modules.some(m=>m.type==='bridge'&&m.hp>0&&!m.disabled);
    const reactor=s.modules.some(m=>m.type==='reactor'&&m.hp>0&&!m.disabled);
    const engines=s.modules.some(m=>m.type==='engine'&&m.hp>0&&!m.disabled);
    if(!hull||hull.hp<=0||!bridge||(!reactor&&!engines)){
      s.dead=true;s.outcome=s.outcome||'combat ineffective';
      this.log(`${s.name} is combat ineffective.`);
    }
  }
  const livingTeams=[...new Set(this.ships.filter(s=>!s.dead&&!s.escaped&&!s.surrendered&&!s.missionNonHostile&&!s.missionDerelict).map(s=>s.team))];
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
function makeInterdictionRunners(count=5){
 const names=['Kestrel Finch','Blue Meridian','Sable Fox','Quiet Fortune','Lucky Star'];
 return Array.from({length:Math.max(1,count)},(_,i)=>{
   const bp=makeTradingPremade('trader_mule'),s=blueprintToShip(bp,'E');
   s.name=names[i]||`Outbound merchant ${i+1}`;s.interdictionRunner=true;s.ai='pursuit';
   const driveScale=[1.08,1.00,1.13,.96,1.05][i%5];for(const m of s.modules)if(m.type==='engine')m.force=(m.force||0)*driveScale;
   return s;
 });
}
function makeLacunaObserver(){const s=makeFactionEnemyFleet('nadir',1)[0];s.name='Unidentified contact';s.factionId=null;s.factionName='Unidentified human craft';s.factionStyle='No recognised transponder. Registry surfaces have been masked.';s.missionNonHostile=true;s.lacunaObserver=true;s.ai='pursuit';for(const m of s.modules)if(m.type==='engine')m.force=(m.force||0)*1.16;return s}
function makeLacunaSentries(){return Array.from({length:2},(_,i)=>{const s=makeFactionEnemyFleet('nadir',1)[0];s.name=`Unidentified picket ${i+1}`;s.factionId=null;s.factionName='Inner-system picket';s.factionStyle='Cold-running human warship with no recognised registry broadcast.';s.missionNonHostile=true;s.lacunaSentry=true;s.ai='pursuit';for(const m of s.modules)if(m.type==='engine')m.force=(m.force||0)*(1.08+i*.04);return s})}
function makeOrisonSentries(){return Array.from({length:3},(_,i)=>{const s=makeFactionEnemyFleet('central',1)[0];s.name=`ORISON continuity sentry ${i+1}`;s.factionId=null;s.factionName='Automated continuity defence';s.factionStyle='Uncrewed closure-era defence craft. No modern registry or live command traffic.';s.missionNonHostile=true;s.orisonSentry=true;s.automated=true;s.ai='pursuit';for(const m of s.modules)if(m.type==='engine')m.force=(m.force||0)*(.92+i*.03);return s})}
function scaleDrives(s,factor){for(const m of s.modules)if(m.type==='engine')m.force=(m.force||0)*factor;return s}
function missionShip(hull,name,team='E',drive=1){const s=blueprintToShip(makeTradingPremade(hull),team);s.name=name;s.ai='pursuit';scaleDrives(s,drive);return s}
function makeTacticalMissionShips(type){
  if(type==='courierIntercept'){const s=missionShip('trader_mule','Fast courier','E',1.42);s.missionTarget=true;return{enemy:[s],friendly:[]}}
  if(type==='blockadeRunner'){const s=missionShip('trader_caravan','Blockade runner','E',1.20);s.missionTarget=true;return{enemy:[s],friendly:[]}}
  if(type==='vipExtraction'){const s=missionShip('trader_caravan','VIP transport','E',1.08);s.missionTarget=true;return{enemy:[s],friendly:[]}}
  if(type==='prisonerRescue'){const s=missionShip('trader_caravan','Prison transport','E',1.12);s.missionTarget=true;return{enemy:[s],friendly:[]}}
  if(type==='salvageRace'){
    const rival=missionShip('trader_mule','Rival salvage tug','E',.84);rival.missionNonHostile=true;rival.missionRival=true;
    const wreck=missionShip('trader_mule','Derelict prize','P',1);wreck.missionDerelict=true;wreck.civilianEscort=true;wreck.ai='pursuit';
    return{enemy:[rival],friendly:[wreck]};
  }
  return{enemy:[],friendly:[]};
}
function markLargestTarget(fleet){const t=[...fleet].sort((a,b)=>(b.grid?.validCells?.length||b.modules?.length||0)-(a.grid?.validCells?.length||a.modules?.length||0))[0];if(t){t.missionObjectiveTarget=true;t.name=`${t.name} — designated target`}return t}

export function createFleetBattle(playerShips,enemyShips,seed=1){
  let campaignEntries=null,nonCombatScenario=null,playerCombatCount=playerShips.length,missionType=null,combatObjectiveType=null,lacunaLeg=null,lacunaSiteId=null;
  if(typeof window!=='undefined'&&window.__campaignActive){
    const persistent=activePlayerShips(),enc=campaign.pendingEncounter;
    if(persistent.length){
      campaignEntries=persistent;playerShips=persistent.map(x=>instantiateCampaignShip(x,'P'));playerCombatCount=playerShips.length;
      if(enc?.kind==='lacunaTransit'){
        lacunaLeg=enc.lacunaLeg;
        if(lacunaLeg==='pursuit')enemyShips=makeFactionEnemyFleet(enc.factionId||'redKnives',Math.max(2,persistent.length));
        else{nonCombatScenario='lacunaTransit';enemyShips=[];}
      }else if(enc?.kind==='lacunaSurvival'){
        nonCombatScenario='lacunaSurvival';lacunaSiteId=enc.siteId;enemyShips=[];
      }else if(enc?.kind==='lacunaActivity'){
        nonCombatScenario='lacunaActivity';enemyShips=[makeLacunaObserver()];
      }else if(enc?.kind==='lacunaInner'){
        nonCombatScenario='lacunaInner';enemyShips=makeLacunaSentries();
      }else if(enc?.kind==='orisonApproach'){
        nonCombatScenario='orisonApproach';enemyShips=makeOrisonSentries();
      }else if(enc?.kind==='peregrineTransit'){
        nonCombatScenario='peregrineTransit';enemyShips=[];
      }else if(enc?.kind==='hazardEscort'){
        nonCombatScenario='meteorEscort';playerShips=[...playerShips,...makeHazardConvoy(enc.convoyCount||2)];enemyShips=[];
      }else if(enc?.kind==='interdiction'||enc?.contract?.encounter==='interdiction'){
        nonCombatScenario='smugglerInterdiction';enemyShips=makeInterdictionRunners(enc.runnerCount||enc.contract?.runnerCount||5);
      }else if(enc?.kind==='tacticalMission'||enc?.contract?.encounter==='tacticalMission'){
        nonCombatScenario='tacticalMission';missionType=enc.missionType||enc.contract?.missionType;const setup=makeTacticalMissionShips(missionType);enemyShips=setup.enemy;playerShips=[...playerShips,...setup.friendly];
      }else if(enc?.contract?.encounter==='combatObjective'){
        combatObjectiveType=enc.contract.objectiveType||'destroyTarget';enemyShips=campaignEnemyFleet(persistent.length);
        if(combatObjectiveType==='destroyTarget')markLargestTarget(enemyShips);
        else if(combatObjectiveType==='protectWithdrawal'){
          const issuer=enc.contract.issuer||'haven',protectedShip=makeFactionEnemyFleet(issuer,1)[0];
          protectedShip.missionProtectedShip=true;protectedShip.civilianEscort=true;protectedShip.name=`${protectedShip.name} — protected withdrawal`;
          playerShips=[...playerShips,protectedShip];
        }
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
    if(s.missionProtectedShip){s.withdrawOrder=true;s.ramPolicy='avoid';s.formationDiscipline='independent';s.order='PROTECTED WITHDRAWAL'}
    return s;
  });
  b.combatObjectiveType=combatObjectiveType;b.lacunaLeg=lacunaLeg;b.lacunaSiteId=lacunaSiteId;
  if(nonCombatScenario){
    b.nonCombatScenario=nonCombatScenario;b.campaignBattle=true;b.missionType=missionType;
    if(nonCombatScenario==='lacunaTransit'||nonCombatScenario==='lacunaSurvival'||nonCombatScenario==='peregrineTransit'){
      const ps=b.ships.filter(s=>s.team==='P');ps.forEach((s,i)=>Object.assign(s,{x:-900,y:(i-(ps.length-1)/2)*280,angle:0,vx:nonCombatScenario==='lacunaTransit'?120:80,vy:0}));
    }else if(nonCombatScenario==='lacunaActivity'){
      const ps=b.ships.filter(s=>s.team==='P'),c=b.ships.find(s=>s.lacunaObserver);ps.forEach((s,i)=>Object.assign(s,{x:-1600,y:(i-(ps.length-1)/2)*240,angle:0,vx:95,vy:0}));if(c)Object.assign(c,{x:1200,y:180,angle:0,vx:185,vy:0});
    }else if(nonCombatScenario==='lacunaInner'){
      const ps=b.ships.filter(s=>s.team==='P'),ss=b.ships.filter(s=>s.lacunaSentry);ps.forEach((s,i)=>Object.assign(s,{x:-2200,y:(i-(ps.length-1)/2)*260,angle:0,vx:70,vy:0}));ss.forEach((s,i)=>Object.assign(s,{x:1500,y:(i-.5)*850,angle:Math.PI,vx:-40,vy:0}));
    }else if(nonCombatScenario==='orisonApproach'){
      const ps=b.ships.filter(s=>s.team==='P'),ss=b.ships.filter(s=>s.orisonSentry);ps.forEach((s,i)=>Object.assign(s,{x:-2400,y:(i-(ps.length-1)/2)*260,angle:0,vx:65,vy:0}));ss.forEach((s,i)=>Object.assign(s,{x:1250,y:(i-(ss.length-1)/2)*780,angle:Math.PI,vx:-25,vy:0}));
    }else if(nonCombatScenario==='meteorEscort'){
      const combat=b.ships.filter(s=>!s.civilianEscort),civ=b.ships.filter(s=>s.civilianEscort);
      combat.forEach((s,i)=>Object.assign(s,{x:-650,y:(i-(combat.length-1)/2)*260,angle:0}));
      civ.forEach((s,i)=>Object.assign(s,{x:-1450,y:(i-(civ.length-1)/2)*320,angle:0}));
    }else if(nonCombatScenario==='smugglerInterdiction'){
      const ps=b.ships.filter(s=>s.team==='P'),rs=b.ships.filter(s=>s.interdictionRunner);
      ps.forEach((s,i)=>Object.assign(s,{x:-1750,y:(i-(ps.length-1)/2)*260,angle:0,vx:70,vy:0}));
      rs.forEach((s,i)=>Object.assign(s,{x:900+i*170,y:(i-(rs.length-1)/2)*420,angle:0,vx:210+i*18,vy:0}));
    }else if(nonCombatScenario==='tacticalMission'){
      const ps=b.ships.filter(s=>s.team==='P'&&!s.missionDerelict),target=b.ships.find(s=>s.missionTarget),rival=b.ships.find(s=>s.missionRival),wreck=b.ships.find(s=>s.missionDerelict);
      ps.forEach((s,i)=>Object.assign(s,{x:-1800,y:(i-(ps.length-1)/2)*260,angle:0,vx:60,vy:0}));
      if(target)Object.assign(target,{x:900,y:0,angle:0,vx:missionType==='courierIntercept'?330:missionType==='blockadeRunner'?260:220,vy:0});
      if(wreck)Object.assign(wreck,{x:3600,y:0,angle:0,vx:0,vy:0,throttle:0});
      if(rival)Object.assign(rival,{x:-650,y:420,angle:0,vx:80,vy:0});
    }
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
