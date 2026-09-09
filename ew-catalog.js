import {MODULES} from './shipyard.js';

const jammer=(name,size,mass,hp,jamStrength,range,powerUse)=>({name,type:'jammer',size,mass,hp,jamStrength,jamRange:range,powerUse,heatFraction:.62,colour:'#b38cd6'});
const decoy=(name,size,mass,hp,ammo,decoyStrength)=>({name,type:'decoy',size,mass,hp,ammo,maxAmmo:ammo,decoyStrength,cooldown:5.5,powerUse:.04e6,colour:'#d6bd76'});

MODULES.jammer_1 ??=jammer('Compact EW jammer',[1,1],3,65,.95,7000,.65e6);
MODULES.jammer_2 ??=jammer('Fleet EW jammer',[2,1],7,125,1.9,10500,1.45e6);
MODULES.jammer_3 ??=jammer('Capital EW suite',[2,2],15,245,3.5,14500,3.2e6);

MODULES.decoy_1 ??=decoy('Countermeasure launcher',[1,1],2,55,8,1.0);
MODULES.decoy_2 ??=decoy('Fleet decoy battery',[2,1],5,105,22,1.45);
MODULES.decoy_3 ??=decoy('Capital decoy battery',[2,2],10,205,52,2.0);
