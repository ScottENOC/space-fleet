import {Battle} from './sim.js';

export const DOCTRINES={
  balanced:{id:'balanced',name:'Balanced action',powerPriority:['shieldMaintain','engines','shieldRecharge','weapons','storageRecharge'],targetPriority:['weapons','engine','reactor','bridge','shield','radiator','armor','hull'],defencePriority:['missile','fighter'],reserveDefenceMW:6e6,laserMinStorageFraction:0,ramMode:'discretion',formationDiscipline:'normal'},
  codeRed:{id:'codeRed',name:'Code Red',powerPriority:['shieldMaintain','shieldRecharge','engines','weapons','storageRecharge'],targetPriority:['weapons','engine','reactor','bridge','shield','radiator','armor','hull'],defencePriority:['missile','fighter'],reserveDefenceMW:18e6,laserMinStorageFraction:.95,ramMode:'avoid',formationDiscipline:'strict'}
};
export function registerDoctrine(d){if(!d?.id)return null;DOCTRINES[d.id]={...d,powerPriority:[...(d.powerPriority||DOCTRINES.balanced.powerPriority)],targetPriority:[...(d.targetPriority||DOCTRINES.balanced.targetPriority)],defencePriority:[...(d.defencePriority||DOCTRINES.balanced.defencePriority)],formationDiscipline:d.formationDiscipline||'normal'};return DOCTRINES[d.id];}
export function removeDoctrine(id){if(!['balanced','codeRed'].includes(id))delete DOCTRINES[id];}
export function applyDoctrine(ship,id='balanced'){
  const d=DOCTRINES[id]||DOCTRINES.balanced;
  ship.doctrineId=d.id;ship.powerPriority=[...d.powerPriority];ship.targetPriority=[...d.targetPriority];ship.defencePriority=[...d.defencePriority];ship.reserveDefenceMW=d.reserveDefenceMW||0;ship.laserMinStorageFraction=d.laserMinStorageFraction||0;ship.formationDiscipline=d.formationDiscipline||'normal';ship.ramOrder=d.ramMode||'discretion';ship.ramPolicy=d.ramMode||'discretion';return d;
}
function shieldFraction(s){const shields=s.modules.filter(m=>m.type==='shield'&&m.hp>0&&!m.disabled);if(!shields.length)return 1;const cap=shields.reduce((n,m)=>n+(m.capacity||0),0)||1;return shields.reduce((n,m)=>n+(m.charge||0),0)/cap;}
function dangerNearby(b,s){return (b.ordnance||[]).some(o=>o.team!==s.team&&o.hp>0&&Math.hypot(o.x-s.x,o.y-s.y)<2200);}
const baseAI=Battle.prototype.ai;
Battle.prototype.ai=function(s,e){if(!s.doctrineId)applyDoctrine(s,'balanced');if(s.team==='E'&&!s.customDoctrineLocked){const threatened=dangerNearby(this,s)||shieldFraction(s)<.4,wanted=threatened?'codeRed':'balanced';if(s.doctrineId!==wanted)applyDoctrine(s,wanted);}return baseAI.call(this,s,e);};
