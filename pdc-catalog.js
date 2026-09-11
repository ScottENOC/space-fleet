import {MODULES} from './shipyard.js';

const DEG=Math.PI/180;

// A close-in kinetic weapon. It uses the normal directional-gun mounting model so
// ship designers still choose which sectors are covered, but unlike naval guns it
// has a very wide powered traverse and is reserved for autonomous point defence.
MODULES.pdc_1={
  name:'Point-defence cannon',type:'gun',size:[1,1],mass:4,hp:58,
  powerUse:.34e6,ammo:2400,projectileMass:.02,muzzle:1650,damage:.005,
  cooldown:.18,penetration:.005,arc:100*DEG,directional:true,clearance:'muzzle',
  colour:'#f1c96b',pointDefenceOnly:true,pdc:true,pdcRange:1900,
  pdcSpread:7*DEG,pdcTracers:11,pdcBurstRounds:24,pdcPacketDamage:8,
  pdcAimTolerance:11,pdcHeatMJ:.42
};

if(typeof window!=='undefined')window.__pdcCatalog={pdc_1:MODULES.pdc_1};
