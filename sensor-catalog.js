import {HULLS,MODULES} from './shipyard.js';

const sensor=(name,size,mass,hp,sensitivity,powerUse)=>({name,type:'sensor',size,mass,hp,sensitivity,powerUse,colour:'#7fc7d8'});
MODULES.sensor_1 ??=sensor('Compact sensor array',[1,1],2,52,1.0,.10e6);
MODULES.sensor_2 ??=sensor('Long-baseline sensor',[2,1],4,92,1.8,.18e6);
MODULES.sensor_3 ??=sensor('Tactical sensor suite',[2,2],7,155,3.0,.32e6);
MODULES.sensor_4 ??=sensor('Fleet sensor array',[3,2],12,245,5.0,.55e6);
MODULES.sensor_5 ??=sensor('Capital sensor complex',[3,3],18,360,8.5,.90e6);

const profiles={
 frigate_sparrow:.68,frigate_dart:.76,frigate_line:.94,
 destroyer_rapier:.82,destroyer_guardian:1.03,destroyer_torpedo:.98,
 cruiser_pathfinder:.84,cruiser_line:1.02,cruiser_missile:1.00,
 battleship_line:1.13,battleship_siege:1.18,battleship_fast:1.08,
 carrier_light:1.12,carrier_fleet:1.20,carrier_super:1.27,
 trader_mule:1.22,trader_caravan:1.30,trader_leviathan:1.38
};
for(const [id,m] of Object.entries(profiles))if(HULLS[id])HULLS[id].radarProfile=m;

export function hullRadarProfile(hullId){return HULLS[hullId]?.radarProfile??1;}
