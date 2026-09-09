import {Battle,initialiseShip} from './sim.js';
import {activePlayerShips,instantiateCampaignShip} from './campaign-core.js';

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

export function createFleetBattle(playerShips,enemyShips,seed=1){
  if(typeof window!=='undefined'&&window.__campaignActive){
    const persistent=activePlayerShips();
    if(persistent.length)playerShips=persistent.map(x=>instantiateCampaignShip(x,'P'));
  }
  if(!playerShips.length||!enemyShips.length)throw new Error('Each side needs at least one ship.');
  const b=new Battle(playerShips[0],enemyShips[0],seed);
  const all=[...playerShips.map((s,i)=>({s,team:'P',i})),...enemyShips.map((s,i)=>({s,team:'E',i}))];
  b.ships=all.map(({s,team,i})=>{
    s.team=team;
    initialiseShip(s);
    s.uid=`${team}${i+1}`;
    s.commandTargetId=null;
    s.targetPriority=[...DEFAULT_PRIORITY];
    s.ramPolicy=team==='P'?'discretion':null;
    const lane=(i-(team==='P'?(playerShips.length-1)/2:(enemyShips.length-1)/2))*420;
    Object.assign(s,{x:team==='P'?-1500:1500,y:lane,angle:team==='P'?.08:Math.PI+.08,vx:0,vy:0,omega:0,dead:false,escaped:false,surrendered:false});
    return s;
  });
  b.projectiles=[];b.events=[];b.winner=null;b.t=0;
  if(typeof window!=='undefined')window.__fleetBattle=b;
  return b;
}

export function applyTargetOrder(battle,{recipient='all',target='any',priority='default'}={}){
  const players=battle.ships.filter(s=>s.team==='P'&&!s.dead&&(recipient==='all'||s.uid===recipient));
  const chosenTarget=target==='any'?null:target;
  const preferred=priority==='default'?DEFAULT_PRIORITY:[priority,...DEFAULT_PRIORITY.filter(x=>x!==priority)];
  for(const s of players){s.commandTargetId=chosenTarget;s.targetPriority=[...preferred];}
  return players;
}

export {DEFAULT_PRIORITY};
