import {Battle} from './sim.js';
import {ensureCrew} from './crew-system.js';

const KEY='spaceFleet.crewPeople.v1';
const CULTURE_KEY='spaceFleet.commandCulture.v1';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hash=s=>[...String(s)].reduce((n,c)=>(n*131+c.charCodeAt(0))>>>0,2166136261);
const rnd=(seed,salt)=>((hash(`${seed}|${salt}`)%10000)+.5)/10000;
const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
const save=x=>localStorage.setItem(KEY,JSON.stringify(x));
const loadCulture=()=>{try{return JSON.parse(localStorage.getItem(CULTURE_KEY)||'{"retreatTolerance":0,"aggression":0,"strictness":0}')}catch{return{retreatTolerance:0,aggression:0,strictness:0}}};
const saveCulture=x=>localStorage.setItem(CULTURE_KEY,JSON.stringify(x));
const people=load();
export const commandCulture=loadCulture();

function personKey(ship,role){return `${ship.name}|${role}`}
function generationSeed(ship,role,generation){return `${ship.name}|${role}|${generation}`}
function makePerson(ship,base,generation=0){
 const seed=generationSeed(ship,base.role,generation);
 const aptitude=.32+rnd(seed,'aptitude')*.66;
 const experience=.18+rnd(seed,'experience')*.68;
 const competence=clamp(.18+experience*(aptitude-.08),.12,.96);
 return{
   generation,name:base.name,role:base.role,title:base.title,
   aptitude,experience,competence,
   confidence:.12+rnd(seed,'confidence')*.84,
   courage:.08+rnd(seed,'courage')*.88,
   ambition:.08+rnd(seed,'ambition')*.88,
   honesty:.72+rnd(seed,'honesty')*.27,
   stress:0,
   evidence:{samples:0,good:0,bad:0,approvedGood:0,approvedBad:0,deniedGood:0,nearMisses:0,formationRecoveries:0,longShots:0,longHits:0},
   notes:[]
 };
}
function replacementName(ship,role,generation){
 const first=['Alex','Dara','Jun','Samira','Tomas','Lena','Mateo','Priya','Noah','Yuki','Amara','Theo','Zara','Emil','Nadia','Leo'];
 const last=['Cross','Mendez','Ito','Fischer','Patel','Grant','Kim','Dawson','Rao','Moretti','Young','Serrano','Blake','Tanaka','Cole','Bishop'];
 const seed=generationSeed(ship,role,generation),h=hash(seed);
 return `${first[h%first.length]} ${last[(h>>>5)%last.length]}`;
}
export function ensureHumanCrew(ship){
 const crew=ensureCrew(ship);
 for(const p of Object.values(crew)){
   const k=personKey(ship,p.role);
   let stored=people[k];
   if(!stored){stored=makePerson(ship,p,0);stored.name=p.name;people[k]=stored;save(people)}
   Object.assign(p,stored,{skill:stored.competence});
 }
 return crew;
}
function persistPerson(ship,p){const k=personKey(ship,p.role);people[k]={...p,evidence:{...(p.evidence||{})},notes:[...(p.notes||[]).slice(-12)]};save(people)}
export function dismissOfficer(ship,role){
 const crew=ensureHumanCrew(ship),old=crew[role];if(!old)return null;
 const generation=(old.generation||0)+1;
 const base={role,title:old.title,name:replacementName(ship,role,generation)};
 const next=makePerson(ship,base,generation);next.name=base.name;
 crew[role]=next;crew[role].skill=next.competence;persistPerson(ship,crew[role]);
 return{oldName:old.name,newOfficer:crew[role]};
}
export function visibleAssessment(p){
 const e=p.evidence||{},n=e.samples||0,score=(e.good||0)-(e.bad||0)+(e.approvedGood||0)-(e.approvedBad||0)*1.2;
 if(n<3)return{label:'Unproven',detail:'Insufficient observed evidence'};
 const ratio=score/Math.max(1,n);
 if(ratio>.45)return{label:'Excellent',detail:'Consistently strong observed performance'};
 if(ratio>.15)return{label:'Promising',detail:'More good signs than bad'};
 if(ratio>-.15)return{label:'Mixed',detail:'Performance has been inconsistent'};
 if(ratio>-.45)return{label:'Concerning',detail:'Several poor outcomes observed'};
 return{label:'Poor',detail:'Repeatedly poor observed outcomes'};
}
export function officerSummary(p){
 const e=p.evidence||{},bits=[];
 if(e.formationRecoveries)bits.push(`${e.formationRecoveries} formation recoveries`);
 if(e.nearMisses)bits.push(`${e.nearMisses} dangerous close passes`);
 if(e.longShots)bits.push(`${e.longHits||0}/${e.longShots} long-range hits`);
 if(e.approvedGood)bits.push(`${e.approvedGood} approved recommendations later vindicated`);
 if(e.approvedBad)bits.push(`${e.approvedBad} approved recommendations later looked unnecessary`);
 return bits.slice(-4);
}
export function recordAdmiralDecision(b,report,approved){
 if(!report)return;const ship=b.ships.find(s=>s.uid===report.shipUid);if(!ship)return;const crew=ensureHumanCrew(ship),p=crew[report.role]||crew.captain;if(!p)return;
 p.evidence??={};p.evidence.samples=(p.evidence.samples||0)+1;
 if(approved)p.evidence.approvedGood=(p.evidence.approvedGood||0)+1;
 // Fleet culture learns from what the Admiral tolerates. This is perception, not objective truth.
 if(report.request?.type==='fallBack'||report.request?.type==='formationDiscipline')commandCulture.retreatTolerance=clamp((commandCulture.retreatTolerance||0)+(approved?.08:-.04),-1,1);
 if(report.request?.type==='doctrine'&&report.request?.value==='codeRed')commandCulture.strictness=clamp((commandCulture.strictness||0)+(approved?.025:-.015),-1,1);
 saveCulture(commandCulture);persistPerson(ship,p);
 // Schedule an after-the-fact judgement using subsequent ship state.
 b._crewDecisionChecks??=[];b._crewDecisionChecks.push({at:b.t+10,shipUid:ship.uid,role:p.role,reportId:report.id,approved,health:ship.modules.reduce((n,m)=>n+Math.max(0,m.hp||0),0),station:ship.formationDistance||0});
}
function judgeDecisions(b){
 const due=(b._crewDecisionChecks||[]).filter(x=>x.at<=b.t);b._crewDecisionChecks=(b._crewDecisionChecks||[]).filter(x=>x.at>b.t);
 for(const x of due){const s=b.ships.find(y=>y.uid===x.shipUid);if(!s)continue;const p=ensureHumanCrew(s)[x.role];if(!p)continue;const hp=s.modules.reduce((n,m)=>n+Math.max(0,m.hp||0),0),station=s.formationDistance||0;
   const improved=hp>=x.health*.97||station<x.station*.7;
   p.evidence.samples=(p.evidence.samples||0)+1;
   if(x.approved&&improved){p.evidence.good=(p.evidence.good||0)+1;}
   else if(x.approved&&!improved){p.evidence.approvedBad=(p.evidence.approvedBad||0)+1;p.evidence.bad=(p.evidence.bad||0)+1;}
   else if(!x.approved&&!improved){p.evidence.deniedGood=(p.evidence.deniedGood||0)+1;}
   persistPerson(s,p);
 }
}
function biasText(report,p){
 if(!report||!p)return;
 const bias=(p.courage-.5)*.7+(p.ambition-.5)*.55-(commandCulture.retreatTolerance||0)*.2;
 if(report.request?.type==='fallBack'||report.request?.type==='formationDiscipline'){
   if(bias>.32)report.text=report.text.replace('Request ','Reluctantly request ').replace('Continued exposure risks','We can continue, but exposure risks');
   else if(bias<-.25)report.text=report.text.replace('Request ','Strongly request ').replace('risks loss','poses an unacceptable risk of loss');
 }
 if(p.honesty<.82){
   if(p.ambition>p.courage)report.text=report.text.replace(/Structural condition (\d+)%/,'Structural condition roughly $1%').replace('Power deficit','Intermittent power deficit');
   else report.text=report.text.replace('limits acceleration','severely limits acceleration').replace('Shields at','Shields down to');
 }
}

const baseStep=Battle.prototype.step;
Battle.prototype.step=function(dt){
 const before=new Map(this.ships.map(s=>[s.uid,(s.crewReports||[]).length]));
 for(const s of this.ships)ensureHumanCrew(s);
 const out=baseStep.call(this,dt);
 for(const s of this.ships){const crew=ensureHumanCrew(s),start=before.get(s.uid)||0;for(const r of (s.crewReports||[]).slice(start)){const p=crew[r.role]||crew.captain;biasText(r,p);}}
 judgeDecisions(this);return out;
};

// Human performance subtly changes execution. Confidence chooses how aggressively to
// exploit skill; courage/ambition change willingness to remain close to danger.
const baseAI=Battle.prototype.ai;
Battle.prototype.ai=function(s,e){
 ensureHumanCrew(s);const crew=s.crew;
 baseAI.call(this,s,e);if(!e||s.dead)return;
 const helm=crew.helm||crew.captain,cap=crew.captain;
 const competence=helm?.competence??.6,confidence=helm?.confidence??.5,courage=cap?.courage??.5,ambition=cap?.ambition??.5;
 const d=Math.hypot(e.x-s.x,e.y-s.y);
 // Skilled + confident helmsmen exploit tighter geometry. Confidence without skill causes overshoot/risk.
 const aggression=(confidence-.5)*.55+(courage-.5)*.25+(ambition-.5)*.2;
 if(d<900){
   if(aggression>.2)s.throttle=Math.max(s.throttle||0,.15+aggression*.35);
   if(confidence>.72&&competence<.48){s.throttle=Math.max(s.throttle||0,.48);s.crewRiskyHelm=true;}
 }
 if((commandCulture.retreatTolerance||0)>.25&&cap?.courage<.45)s.formationDiscipline='strict';
};

const baseFire=Battle.prototype.fireWeapons;
Battle.prototype.fireWeapons=function(s,e,powerBudget){
 ensureHumanCrew(s);const g=s.crew?.weapons;if(!g||!e)return baseFire.call(this,s,e,powerBudget);
 const d=Math.hypot(e.x-s.x,e.y-s.y),confidence=g.confidence??.5,competence=g.competence??.6;
 // Ambitious/confident gunners try marginal long shots by temporarily relaxing range.
 const changed=[];if(d>2200&&confidence>.63){for(const w of s.modules){if(!['gun','laser'].includes(w.type)||w.hp<=0)continue;changed.push([w,w.range,w.muzzle]);if(w.type==='laser')w.range=(w.range||9000)*(1+.35*confidence);else w.muzzle=(w.muzzle||1200)*(1+.08*confidence);}}
 const shots0=s.shots||0,hits0=s.hits||0;try{return baseFire.call(this,s,e,powerBudget)}finally{
   if((s.shots||0)>shots0&&d>2200){g.evidence.longShots=(g.evidence.longShots||0)+((s.shots||0)-shots0);g.evidence.longHits=(g.evidence.longHits||0)+Math.max(0,(s.hits||0)-hits0);g.evidence.samples=(g.evidence.samples||0)+1;if((s.hits||0)>hits0)g.evidence.good=(g.evidence.good||0)+1;else if(competence<.5)g.evidence.bad=(g.evidence.bad||0)+1;persistPerson(s,g);}
   for(const [w,r,m] of changed){if(r===undefined)delete w.range;else w.range=r;if(m===undefined)delete w.muzzle;else w.muzzle=m;}
 }};
