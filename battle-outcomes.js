import {Battle} from './sim.js';

const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function nearestEnemy(b,s){return b.ships.filter(o=>!o.dead&&!o.escaped&&o.team!==s.team).sort((a,c)=>dist(a,s)-dist(c,s))[0]||null}
function health(s){const ms=s.modules.filter(m=>(m.maxHp||m.hp)>0),max=ms.reduce((n,m)=>n+(m.maxHp||m.hp||0),0)||1;return ms.reduce((n,m)=>n+Math.max(0,m.hp||0),0)/max}
function thrust(s){return s.modules.filter(m=>m.type==='engine'&&m.hp>0&&!m.disabled).reduce((n,m)=>n+(m.force||0),0)}

export function orderWithdraw(b,ships){for(const s of ships){if(s.dead||s.escaped)continue;s.withdrawOrder=true;s.ramPolicy='avoid';s.formationDiscipline='independent';s.order='WITHDRAW';b.log(`${s.name}: withdrawal ordered.`)}}
export function orderSurrender(b,ships){for(const s of ships){if(s.dead||s.escaped)continue;s.surrendered=true;s.outcome='surrendered';s.throttle=0;s.ramPolicy='avoid';s.order='SURRENDER';b.log(`${s.name} strikes colours and surrenders.`)}}

const baseAI=Battle.prototype.ai;
Battle.prototype.ai=function(s,e){
  if(s.surrendered||s.escaped){s.throttle=0;return;}
  if(s.withdrawOrder){
    const enemy=nearestEnemy(this,s);if(!enemy){s.escaped=true;s.outcome='escaped';return;}
    const away=Math.atan2(s.y-enemy.y,s.x-enemy.x);s.desiredAngle=away;s.throttle=1;s.ramIntent=false;s.order='WITHDRAW';return;
  }
  baseAI.call(this,s,e);
  if(s.team==='E'&&!s.dead&&!s.surrendered&&!s.withdrawOrder){
    const h=health(s),enemy=nearestEnemy(this,s),canRun=thrust(s)>0;
    if(h<.2&&canRun&&enemy){s.withdrawOrder=true;s.order='WITHDRAW';}
    else if(h<.11&&!canRun){s.surrendered=true;s.outcome='surrendered';s.throttle=0;}
  }
};

function checkEscape(b,s){if(!s.withdrawOrder||s.escaped||s.dead)return;const e=nearestEnemy(b,s);if(!e){s.escaped=true;s.outcome='escaped';return}const d=dist(s,e);if(d<5200)return;const dx=s.x-e.x,dy=s.y-e.y,r=d||1,rvx=s.vx-e.vx,rvy=s.vy-e.vy,opening=(rvx*dx+rvy*dy)/r;if(opening>80){s.escaped=true;s.outcome='escaped';s.dead=true;b.log(`${s.name} disengages successfully.`)}}
function resolveSurrenderCapture(b){
  for(const s of b.ships.filter(x=>x.surrendered&&!x._captureResolved)){
    const enemy=b.ships.filter(o=>!o.dead&&!o.escaped&&o.team!==s.team).sort((a,c)=>dist(a,s)-dist(c,s))[0];
    if(enemy&&dist(enemy,s)<2200){s.outcome='captured';s.dead=true;s._captureResolved=true;b.log(`${s.name} is captured by ${enemy.name}.`)}
  }
}
function livingTeams(b){return[...new Set(b.ships.filter(s=>!s.dead&&!s.escaped&&!s.surrendered).map(s=>s.team))]}
const baseStep=Battle.prototype.step;
Battle.prototype.step=function(dt){
  const out=baseStep.call(this,dt);for(const s of this.ships)checkEscape(this,s);resolveSurrenderCapture(this);
  if(!this.winner){const teams=livingTeams(this);if(teams.length<=1){this.winner=teams[0]||'draw';}}
  return out;
};
