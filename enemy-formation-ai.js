import {Battle} from './sim.js';
import {setFormation,getFleetState} from './formation-system.js';

const baseStep=Battle.prototype.step;
const health=s=>{
  const ms=s.modules.filter(m=>(m.maxHp||m.hp)>0),max=ms.reduce((n,m)=>n+(m.maxHp||m.hp||0),0)||1;
  return ms.reduce((n,m)=>n+Math.max(0,m.hp||0),0)/max;
};
function threatened(b,ships){return (b.ordnance||[]).some(o=>o.team!=='E'&&o.hp>0&&ships.some(s=>Math.hypot(o.x-s.x,o.y-s.y)<2400));}
function chooseEnemyFormation(b){
  const ships=b.ships.filter(s=>s.team==='E'&&!s.dead);if(!ships.length)return;
  const st=getFleetState(b,'E');if(!st)return;
  const avg=ships.reduce((n,s)=>n+health(s),0)/ships.length;
  const rammers=ships.filter(s=>s.modules.some(m=>m.ram&&m.hp>0&&!m.disabled)).length;
  const broadside=ships.filter(s=>s.ai==='broadside').length;
  let wanted='loose';
  if(avg<.34&&rammers>0)wanted='ramming';
  else if(threatened(b,ships))wanted='loose';
  else if(broadside>=Math.ceil(ships.length/2))wanted='broadside';
  else if(ships.length>1&&avg<.58)wanted='tight';
  if(st.formation!==wanted){const f=setFormation(b,'E',wanted);b.log(`Enemy Admiral orders ${f.name}.`);}
}
Battle.prototype.step=function(dt){
  const out=baseStep.call(this,dt);
  this._enemyFormationDecisionAt??=0;
  if(!this.winner&&this.t>=this._enemyFormationDecisionAt){this._enemyFormationDecisionAt=this.t+3;chooseEnemyFormation(this);}
  return out;
};
