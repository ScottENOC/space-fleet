import {MODULES} from './shipyard.js';

const hangar=(name,size,mass,hp,spaces,loadout)=>({name,type:'hangar',size,mass,hp,hangarSpaces:spaces,defaultCraft:{...loadout},colour:'#8fa6b8'});
const bay=(name,size,mass,hp,slots,launchCycle,recoveryCycle)=>({name,type:'launchBay',size,mass,hp,launchSlots:slots,launchCycle,recoveryCycle,powerUse:.35e6*slots,directional:true,clearance:'muzzle',colour:'#9fd18c'});

MODULES.hangar_1 ??=hangar('Compact hangar',[2,2],12,150,4,{fighter:3,sensorDrone:2});
MODULES.hangar_2 ??=hangar('Fleet hangar',[3,2],22,265,9,{fighter:7,sensorDrone:4});
MODULES.hangar_3 ??=hangar('Carrier hangar',[4,3],42,470,18,{fighter:14,sensorDrone:8});

MODULES.launch_bay_1 ??=bay('Small launch / recovery bay',[2,1],7,105,1,2.2,3.0);
MODULES.launch_bay_2 ??=bay('Fleet launch / recovery bay',[3,1],12,175,2,1.8,2.5);
MODULES.launch_bay_3 ??=bay('Capital launch / recovery bay',[3,2],20,290,3,1.45,2.1);

export const CRAFT={
 fighter:{id:'fighter',name:'Fighter',space:1,launchTime:1,recoveryTime:1,serviceTime:12,maxFuel:105,returnFuel:30,hp:44,accel:115,turnRate:3.4,r:2.1},
 sensorDrone:{id:'sensorDrone',name:'Sensor drone',space:.5,launchTime:.7,recoveryTime:.7,serviceTime:6,maxFuel:420,returnFuel:65,hp:22,accel:55,turnRate:2.2,r:1.4,sensorStrength:1.6}
};

export function craftSpace(kind){return CRAFT[kind]?.space||1;}
