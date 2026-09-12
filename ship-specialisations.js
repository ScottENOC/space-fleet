import {registerBattleHook} from './battle-hooks.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export const SPECIALISATIONS={
 asterion:{name:'Asterion-7 missile package',category:'weapons',owner:'pelagosA',access:'restricted',description:'Compact export-controlled seeker/warhead package. Reduced blast damage, but impact shock can temporarily disrupt exposed ship systems.',effect:'disruptor missile'},
 centralFireControl:{name:'Central integrated fire-control',category:'weapons',owner:'central',access:'restricted',description:'Fleet-grade target correlation and firing discipline. Improves weapon cadence slightly and reduces wasteful fire.',effect:'fire control'},
 havenEscort:{name:'Haven escort-defence suite',category:'defence',owner:'haven',access:'licensed',description:'Escort combat-system package optimised for rapid close-in threat assignment and point-defence reaction.',effect:'point defence'},
 freePortDrive:{name:'Free Port emergency drive governor',category:'propulsion',owner:'pelagosB',access:'commercial',description:'Permissive propulsion governor allowing short periods of higher thrust at the cost of heat and machinery stress.',effect:'propulsion'},
 orpheusArmour:{name:'Orpheus modular industrial armour',category:'defence',owner:'orpheus',access:'commercial',description:'Heavy modular armour assembled from industrial plate. Cheap, repairable and extremely mass-inefficient.',effect:'armour'},
 frontierRepair:{name:'Frontier field-repair kit',category:'logistics',owner:'frontierGuard',access:'common',description:'Improvised spares, portable machine tools and standardised patches for keeping remote ships operational.',effect:'repair'},
 redKnifePrize:{name:'Red Knives prize-control suite',category:'boarding',owner:'redKnives',access:'black-market',description:'Illegal fire-control and boarding integration built around disabling propulsion and taking ships intact.',effect:'capture'},
 blackWakeBaffles:{name:'Black Wake emissions baffling',category:'sensors',owner:'blackWake',access:'black-market',description:'Crude but effective thermal and electronic baffling. Reduces obvious emissions while making heat rejection more difficult.',effect:'stealth'}
};

export function specialisationSlots(ship){
 const cls=String(ship.shipClass||'').toLowerCase(),cells=ship.grid?.validCells?.length||0;
 if(cls.includes('frigate')||cells<45)return 1;
 if(cls.includes('destroyer')||cells<115)return 2;
 if(cls.includes('cruiser')||cells<220)return 3;
 return 4;
}
export function installSpecialisation(ship,id){
 if(!SPECIALISATIONS[id])return false;ship.specialisationIds??=[];
 if(ship.specialisationIds.includes(id))return true;
 if(ship.specialisationIds.length>=specialisationSlots(ship))return false;
 const cat=SPECIALISATIONS[id].category;if(ship.specialisationIds.some(x=>SPECIALISATIONS[x]?.category===cat))return false;
 ship.specialisationIds.push(id);applySpecialisations(ship);return true;
}
export function applySpecialisations(ship){
 const ids=new Set(ship.specialisationIds||[]);
 if(ids.has('centralFireControl'))for(const m of ship.modules||[])if(['gun','laser','missile'].includes(m.type)&&!m._centralFC){m.cooldown=(m.cooldown||1)*.94;m._centralFC=true}
 if(ids.has('havenEscort'))for(const m of ship.modules||[])if(m.pdc&&!m._havenEscort){m.cooldown=(m.cooldown||.18)*.86;m.pdcRange=(m.pdcRange||1900)*1.08;m._havenEscort=true}
 if(ids.has('freePortDrive'))for(const m of ship.modules||[])if(m.type==='engine'&&!m._freePortDrive){m.force=(m.force||0)*1.12;m.powerUse=(m.powerUse||0)*1.08;m._freePortDrive=true}
 if(ids.has('orpheusArmour'))for(const m of ship.modules||[])if(m.type==='armor'&&!m._orpheusArmour){m.maxHp=(m.maxHp||m.hp)*1.18;m.hp*=1.18;m.mass=(m.mass||0)*1.18;m._orpheusArmour=true}
 if(ids.has('redKnifePrize')){ship.targetPriority=['engine','weapons','bridge','reactor','shield','armor','hull'];ship.boardingDoctrine='aggressive';ship.boardingObjective='capture';ship.boardingPosture='capture'}
 if(ids.has('blackWakeBaffles')){ship.signatureMultiplier=.72;ship.integratedCoolingMultiplier=(ship.integratedCoolingMultiplier||1)*.78}
 if(ids.has('asterion'))for(const m of ship.modules||[])if(m.type==='missile'&&!m._asterion){m.damage=(m.damage||100)*.74;m.missileEffect='asterionDisrupt';m.missileEffectDuration=5.5;m._asterion=true}
 ship.specialisations=(ship.specialisationIds||[]).map(id=>SPECIALISATIONS[id]).filter(Boolean);
 return ship;
}

function segmentCircle(ax,ay,bx,by,cx,cy,r){const dx=bx-ax,dy=by-ay,fx=ax-cx,fy=ay-cy,a=dx*dx+dy*dy;if(a<1e-9)return Math.hypot(fx,fy)<=r;const b=2*(fx*dx+fy*dy),c=fx*fx+fy*fy-r*r,d=b*b-4*a*c;if(d<0)return false;const q=Math.sqrt(d);return[(-b-q)/(2*a),(-b+q)/(2*a)].some(t=>t>=0&&t<=1)}
function tagMissiles(b){for(const o of b.ordnance||[]){if(o.kind!=='missile'||o._specialisationTagged)continue;o._specialisationTagged=true;if(o.owner?.specialisationIds?.includes('asterion')){o.missileEffect='asterionDisrupt';o.effectDuration=5.5}}}
function applyAsterionIfImpact(b,dt){
 for(const o of b.ordnance||[]){if(o.kind!=='missile'||o.hp<=0||o.missileEffect!=='asterionDisrupt'||o.effectApplied)continue;
   const bx=o.x+(o.vx||0)*dt,by=o.y+(o.vy||0)*dt;let hit=null;
   for(const s of b.ships||[]){if(s.dead||s.team===o.team)continue;if(segmentCircle(o.x,o.y,bx,by,s.x,s.y,(s.radius||15)+(o.r||1.3))){hit=s;break}}
   if(!hit)continue;o.effectApplied=true;
   const candidates=(hit.modules||[]).filter(m=>m.hp>0&&!m.disabled&&['engine','sensor','shield','gun','laser','missile','bridge'].includes(m.type));
   candidates.sort((a,c)=>{const rank=m=>m.type==='engine'?0:m.type==='sensor'?1:m.type==='shield'?2:3;return rank(a)-rank(c)});
   const n=Math.min(2,candidates.length);for(let i=0;i<n;i++){const m=candidates[i];m.disabled=true;m.specialisationDisabledUntil=Math.max(m.specialisationDisabledUntil||0,b.t+(o.effectDuration||5.5))}
   if(n)b.log(`${hit.name}: Asterion impact disrupted ${candidates.slice(0,n).map(m=>m.type).join(' / ')} systems.`);
 }
}
function recoverDisruption(b){for(const s of b.ships||[])for(const m of s.modules||[])if(m.specialisationDisabledUntil&&b.t>=m.specialisationDisabledUntil){m.disabled=false;delete m.specialisationDisabledUntil}}

registerBattleHook('beforeProjectiles','specialisations-tag-missiles',({battle,dt})=>{tagMissiles(battle);applyAsterionIfImpact(battle,dt)},85);
registerBattleHook('afterStep','specialisations-recover-disruption',({battle})=>recoverDisruption(battle),-80);

if(typeof window!=='undefined')window.__shipSpecialisations={SPECIALISATIONS,specialisationSlots,installSpecialisation,applySpecialisations};
