import {Battle} from './sim.js';

const BASE_APPLY=Battle.prototype.applySystems;

Battle.prototype.applySystems=function(s,dt){
  if(!s.runSilent)return BASE_APPLY.call(this,s,dt);
  const reactors=s.modules.filter(m=>m.type==='reactor'&&m.hp>0&&!m.disabled);
  const weapons=s.modules.filter(m=>['gun','laser','missile','fighterBay'].includes(m.type)&&m.hp>0&&!m.disabled);
  const engines=s.modules.filter(m=>m.type==='engine'&&m.hp>0&&!m.disabled);
  const shields=s.modules.filter(m=>m.type==='shield'&&m.hp>0&&!m.disabled);
  const saved={throttle:s.throttle,reactors:reactors.map(m=>[m,m.power]),disabled:[...weapons,...engines].map(m=>[m,m.disabled])};
  try{
    for(const m of reactors)m.power=0;
    for(const m of weapons)m.disabled=true;
    for(const m of engines)m.disabled=true;
    s.throttle=0;
    const out=BASE_APPLY.call(this,s,dt);
    for(const sh of shields)if((sh.charge||0)>0)sh.charge=Math.max(0,sh.charge-(sh.capacity||0)*.012*dt);
    s.weaponStatus='running silent';
    return out;
  } finally {
    s.throttle=saved.throttle;
    for(const [m,p] of saved.reactors)m.power=p;
    for(const [m,d] of saved.disabled)m.disabled=d;
  }
};

export function setRunSilent(ship,on=true){ship.runSilent=!!on;return ship.runSilent;}
if(typeof window!=='undefined')window.__setRunSilent=setRunSilent;
