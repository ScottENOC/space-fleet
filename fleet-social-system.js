import {Battle} from './sim.js';
import {ensureHumanCrew,commandCulture} from './crew-human-factors.js';

const KEY='spaceFleet.fleetSocial.v1';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{"captains":{},"admiral":{}}')}catch{return{captains:{},admiral:{}}}};
const state=load();state.captains??={};state.admiral??={};
const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
const captain=s=>ensureHumanCrew(s).captain;
const key=s=>captain(s)?.name||s.name;
function rel(from,to){const a=key(from),b=key(to);state.captains[a]??={};state.captains[a][b]??={trust:0,respect:0,bravery:0,competence:0,selfishness:0,samples:0};return state.captains[a][b];}
function adm(s){const a=key(s);state.admiral[a]??={respect:0,trust:0,permissive:0,aggressive:0,samples:0};return state.admiral[a];}
function adjust(o,k,d){o[k]=clamp((o[k]||0)+d,-1,1);o.samples=(o.samples||0)+1;}

export function recordSocialDecision(b,report,approved){
 const subject=b.ships.find(s=>s.uid===report?.shipUid);if(!subject)return;
 for(const observer of b.ships.filter(s=>s.team===subject.team&&!s.dead)){
   const a=adm(observer);a.samples=(a.samples||0)+1;
   if(report.request?.type==='fallBack'||report.request?.type==='formationDiscipline'){
     adjust(a,'permissive',approved?.06:-.035);
     if(observer!==subject){const r=rel(observer,subject);adjust(r,'bravery',approved?-.035:.02);adjust(r,'selfishness',approved?.025:-.01);}
   }
   if(report.request?.type==='doctrine'&&report.request?.value==='codeRed')adjust(a,'aggressive',approved?-.02:.025);
   // Competent captains dislike arbitrary-looking reversals; cautious captains appreciate safety.
   const c=captain(observer);if(c){const pref=(c.courage||.5)+(c.ambition||.5)-1;if(approved)adjust(a,'respect',pref>.25?-.015:.015);else adjust(a,'respect',pref>.25?.015:-.01);}
 }
 save();
}

function health(s){const ms=s.modules.filter(m=>(m.maxHp||m.hp)>0),max=ms.reduce((n,m)=>n+(m.maxHp||m.hp||0),0)||1;return ms.reduce((n,m)=>n+Math.max(0,m.hp||0),0)/max;}
function observeFleet(b){
 for(const observer of b.ships.filter(s=>!s.dead))for(const subject of b.ships.filter(s=>s.team===observer.team&&!s.dead&&s!==observer)){
   const r=rel(observer,subject),h=health(subject),station=subject.formationDistance||0;
   if(subject.fallBackRequested&&h>.62){adjust(r,'bravery',-.025);adjust(r,'selfishness',.018);}
   if(h<.35&&!subject.fallBackRequested){adjust(r,'bravery',.018);if(station<500)adjust(r,'trust',.01);}
   if(station<180){adjust(r,'trust',.004);adjust(r,'competence',.003);}else if(station>700){adjust(r,'trust',-.004);adjust(r,'competence',-.003);}
   if(subject.crewRiskyHelm){adjust(r,'bravery',.006);adjust(r,'competence',-.004);}
 }
 save();
}

function maybeComment(b,s){
 if(s.team!=='P'||s.dead)return;const c=captain(s);if(!c)return;
 const others=b.ships.filter(o=>o.team==='P'&&!o.dead&&o!==s);if(!others.length)return;
 const noteworthy=others.map(o=>({o,r:rel(s,o)})).sort((a,z)=>Math.max(Math.abs(z.r.trust),Math.abs(z.r.bravery),Math.abs(z.r.competence))-Math.max(Math.abs(a.r.trust),Math.abs(a.r.bravery),Math.abs(a.r.competence)))[0];
 if(!noteworthy)return;const {o,r}=noteworthy,mag=Math.max(Math.abs(r.trust),Math.abs(r.bravery),Math.abs(r.competence));if(mag<.28)return;
 s._socialCommentAt??=-999;if(b.t-s._socialCommentAt<22)return;s._socialCommentAt=b.t;
 let text='';
 if(r.trust<-.3)text=`I do not trust ${o.name} to hold our flank if pressure increases.`;
 else if(r.bravery<-.3)text=`${o.name} has been quick to seek safety. I would not plan around them holding under heavy fire.`;
 else if(r.bravery>.35&&r.competence<-.15)text=`${o.name} is brave, but they are taking risks I do not think they can manage.`;
 else if(r.trust>.35&&r.competence>.2)text=`${o.name} has been dependable. We can safely lean on them for mutual support.`;
 else return;
 b.crewInbox??=[];const item={id:`social:${s.uid}:${Math.floor(b.t)}`,t:b.t,shipUid:s.uid,shipName:s.name,role:'captain',officer:c.name,title:'Captain',severity:2,text,request:null,status:'open'};b.crewInbox.push(item);
}

export function socialSummary(s){
 const a=adm(s),bits=[];
 if((a.respect||0)>.3)bits.push('appears to respect Admiral command');else if((a.respect||0)<-.3)bits.push('appears sceptical of Admiral judgement');
 if((a.permissive||0)>.35)bits.push('expects requests for exceptions to be granted');else if((a.permissive||0)<-.3)bits.push('expects strict adherence to orders');
 return bits;
}
export function captainOpinions(s,b){
 return b.ships.filter(o=>o.team===s.team&&o!==s).map(o=>({ship:o,opinion:rel(s,o)}));
}

const baseAI=Battle.prototype.ai;
Battle.prototype.ai=function(s,e){
 ensureHumanCrew(s);const a=adm(s),c=captain(s);baseAI.call(this,s,e);if(s.dead)return;
 // Respect/trust increase adherence. Low respect plus confidence/ambition produces initiative.
 const initiative=clamp((c?.confidence||.5)*.35+(c?.ambition||.5)*.35-(a.respect||0)*.25-(a.trust||0)*.15,0,1);
 if(initiative>.68&&s.formationDiscipline==='strict')s.formationDiscipline='normal';
 if(initiative>.82&&s.formationDiscipline==='normal'&&(s.formationDistance||0)<500)s.formationDiscipline='independent';
 if((a.respect||0)>.4&&s.formationDiscipline==='independent')s.formationDiscipline='normal';
};

const baseStep=Battle.prototype.step;
Battle.prototype.step=function(dt){const out=baseStep.call(this,dt);this._socialTick=(this._socialTick||0)+dt;if(this._socialTick>=2){this._socialTick=0;observeFleet(this);for(const s of this.ships)maybeComment(this,s);}return out;};
