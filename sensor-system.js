import {Battle} from './sim.js';
import {HULLS} from './shipyard.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const alive=(s,t)=>s.modules.filter(m=>m.type===t&&m.hp>0&&!m.disabled);

function hullSignature(s){const cells=s.grid?.validCells?.length||Math.max(1,(s.length||1)*(s.width||1)/9);const profile=HULLS[s.hullId]?.radarProfile??1;return Math.sqrt(cells)*profile;}
function reactorEmission(s){if(s.runSilent)return 0;return alive(s,'reactor').reduce((n,m)=>n+((m.power||0)/1e6)*.38*(m.hp/Math.max(1,m.maxHp||m.hp)),0);}
function engineEmission(s){if(s.runSilent)return 0;return alive(s,'engine').reduce((n,m)=>n+(m.active?(m.force||0)/1e6*(1.8+2.2*(m.output||0)):0),0);}
function weaponEmission(s){if(s.runSilent)return 0;let v=0;for(const m of s.modules){if(m.hp<=0||m.disabled||(m.cooldownLeft||0)<=0)continue;if(m.type==='laser')v+=55;if(m.type==='gun')v+=22;if(m.type==='missile')v+=30;if(m.type==='fighterBay')v+=18;}return v;}
export function shipSignature(s){const base=hullSignature(s),reactor=reactorEmission(s),engines=engineEmission(s),weapons=weaponEmission(s);return{base,reactor,engines,weapons,total:base+reactor+engines+weapons};}
function sensorStrength(s){const bridge=alive(s,'bridge').length?.72:0;const arrays=alive(s,'sensor').reduce((n,m)=>n+(m.sensitivity||1)*(m.hp/Math.max(1,m.maxHp||m.hp)),0);return bridge+arrays;}
function ownClutter(b,s){const own=shipSignature(s),nearOrdnance=(b.ordnance||[]).filter(o=>dist(o,s)<2600).length;const nearbyShips=b.ships.filter(o=>o!==s&&!o.dead&&dist(o,s)<3500).reduce((n,o)=>n+Math.min(12,shipSignature(o).total*.08),0);return 1+own.reactor*.045+own.engines*.09+own.weapons*.035+nearOrdnance*.07+nearbyShips*.025;}
function evidence(observer,target,b){const r=Math.max(100,dist(observer,target)),sig=shipSignature(target),strength=sensorStrength(observer),clutter=ownClutter(b,observer);const passive=(sig.reactor+sig.engines+sig.weapons)*strength*900000/(r*r*clutter);const radar=sig.base*strength*520000/(r*r*Math.sqrt(clutter));return passive+radar;}
function ensureContacts(b){b.sensorContacts??={P:{},E:{}};b.sensorContacts.P??={};b.sensorContacts.E??={};}
function qualityLabel(q){return q>=.82?'resolved':q>=.57?'classified':q>=.30?'track':q>=.10?'contact':'unknown';}
function updateTeamContacts(b,team,dt){const observers=b.ships.filter(s=>s.team===team&&!s.dead),targets=b.ships.filter(s=>s.team!==team&&!s.dead),table=b.sensorContacts[team];for(const t of targets){let best=0;for(const o of observers)best=Math.max(best,evidence(o,t,b));const c=table[t.uid]??={uid:t.uid,quality:0,lastSeen:0,lastX:t.x,lastY:t.y};const gain=clamp(best*dt*.75,0,.24),decay=(best<.02?dt*.012:dt*.0025);c.quality=clamp(c.quality+gain-decay,0,1);if(best>.008){c.lastSeen=b.t;c.lastX=t.x;c.lastY=t.y;}c.level=qualityLabel(c.quality);c.signal=best;table[t.uid]=c;}for(const uid of Object.keys(table))if(!targets.some(t=>t.uid===uid))table[uid].quality=Math.max(0,table[uid].quality-dt*.025);}
export function getContact(b,team,uid){ensureContacts(b);return b.sensorContacts?.[team]?.[uid]||{uid,quality:0,level:'unknown',signal:0};}
export function knownEnemies(b,team,minQuality=.1){ensureContacts(b);return b.ships.filter(s=>s.team!==team&&!s.dead&&getContact(b,team,s.uid).quality>=minQuality);}

const BASE_STEP=Battle.prototype.step;
Battle.prototype.step=function(dt){ensureContacts(this);const out=BASE_STEP.call(this,dt);updateTeamContacts(this,'P',dt);updateTeamContacts(this,'E',dt);return out;};

const BASE_ENEMY=Battle.prototype.enemy;
Battle.prototype.enemy=function(s){const known=knownEnemies(this,s.team,.08);if(!known.length)return null;const ordered=s.commandTargetId&&known.find(o=>o.uid===s.commandTargetId);if(ordered)return ordered;return known.sort((a,b)=>dist(a,s)-dist(b,s))[0]||BASE_ENEMY.call(this,s);};

export function sensorSummary(b,observerTeam,target){const c=getContact(b,observerTeam,target.uid);return{...c,signature:shipSignature(target)};}
if(typeof window!=='undefined'){
  window.__sensorGetContact=getContact;
  window.__sensorKnownEnemies=knownEnemies;
  window.__sensorSummary=sensorSummary;
  window.__shipSignature=shipSignature;
}
