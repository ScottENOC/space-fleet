import {campaign} from './campaign-core.js';
import {SYSTEMS} from './frontier-rules.js';

SYSTEMS.Peregrine??={authority:0,market:0,security:0,links:[],note:'Hidden continuity endpoint reached through ORISON. No recognised gate authority, market, dockyard or surveyed return route is available.'};

if(typeof document!=='undefined')document.addEventListener('click',e=>{
 if(campaign.location!=='Peregrine')return;
 const target=e.target?.closest?.('[data-travel],[data-repair],[data-buyhull],[data-contract],[data-buygood],[data-sellgood]');
 if(!target)return;
 e.preventDefault();e.stopImmediatePropagation();
 alert('PEREGRINE is outside the registered network. No ordinary gate route, market, contract board or dockyard access is available until local contact establishes what infrastructure actually exists here.');
},true);
