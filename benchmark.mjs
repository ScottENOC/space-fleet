import {runBattle} from './sim.js';
let a=0,b=0,d=0,total=0;let durations=[];
for(let seed=1;seed<=500;seed++){const r=runBattle(seed); if(r.winner==='A')a++; else if(r.winner==='B')b++; else d++;total+=r.time;durations.push(r.time)}
durations.sort((x,y)=>x-y);console.log(JSON.stringify({battles:500,broadsideWins:a,pursuitWins:b,draws:d,meanSeconds:+(total/500).toFixed(1),medianSeconds:+durations[249].toFixed(1)},null,2));
