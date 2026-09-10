import {MODULES} from './shipyard.js';

const clone=(baseId,nameSuffix,overrides)=>{
  const base=MODULES[baseId];
  if(!base)return null;
  return {...base,name:`${base.name} — ${nameSuffix}`,...overrides};
};

export const MISSILE_LOADOUTS={
  sprint:{label:'Sprint',description:'High-thrust, short-burn missile for difficult intercepts and point defence.',damage:0.62,thrust:1.60,fuel:0.78,hp:0.85},
  standard:{label:'Standard',description:'Balanced anti-ship missile.',damage:1,thrust:1,fuel:1,hp:1},
  heavyStrike:{label:'Heavy strike',description:'Large warhead with weaker propulsion; best against slow or favourably-positioned targets.',damage:1.55,thrust:0.68,fuel:0.82,hp:1.15}
};

for(const size of [1,2,3]){
  const baseId=`missile_${size}`;
  const base=MODULES[baseId];
  if(!base)continue;
  base.missileLoadout='standard';
  base.loadoutDescription=MISSILE_LOADOUTS.standard.description;
  for(const [id,spec] of [['sprint',MISSILE_LOADOUTS.sprint],['heavyStrike',MISSILE_LOADOUTS.heavyStrike]]){
    const suffix=id==='heavyStrike'?'Heavy strike':'Sprint';
    MODULES[`${baseId}_${id}`]=clone(baseId,suffix,{
      missileLoadout:id,
      loadoutDescription:spec.description,
      damage:Math.round(base.damage*spec.damage),
      missileThrust:base.missileThrust*spec.thrust,
      missileFuel:base.missileFuel*spec.fuel,
      missileHp:Math.round(base.missileHp*spec.hp),
      colour:id==='sprint'?'#e5a070':'#c96f51'
    });
  }
}

if(typeof window!=='undefined')window.__missileLoadouts=MISSILE_LOADOUTS;
