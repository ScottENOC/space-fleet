export const G = {
  dt: 0.05,
  projectileTTL: 24,
  c: 299792458,
};

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const cross=(ax,ay,bx,by)=>ax*by-ay*bx;
const len=(x,y)=>Math.hypot(x,y);
const unit=(x,y)=>{const l=len(x,y)||1;return [x/l,y/l]};
const rot=(x,y,a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
const dot=(ax,ay,bx,by)=>ax*bx+ay*by;

function interceptAngle(shooter,target,speed){
  const rx=target.x-shooter.x, ry=target.y-shooter.y;
  const vx=target.vx-shooter.vx, vy=target.vy-shooter.vy;
  const a=vx*vx+vy*vy-speed*speed;
  const b=2*(rx*vx+ry*vy);
  const c=rx*rx+ry*ry;
  let t=null;
  if(Math.abs(a)<1e-9){ if(Math.abs(b)>1e-9){const q=-c/b;if(q>0)t=q;} }
  else {
    const disc=b*b-4*a*c;
    if(disc>=0){const root=Math.sqrt(disc),t1=(-b-root)/(2*a),t2=(-b+root)/(2*a);const vals=[t1,t2].filter(x=>x>0);if(vals.length)t=Math.min(...vals);}
  }
  if(t==null)return Math.atan2(ry,rx);
  return Math.atan2(ry+vy*t,rx+vx*t);
}

export class RNG {
  constructor(seed=1){this.s=seed>>>0||1}
  next(){let x=this.s;x^=x<<13;x^=x>>>17;x^=x<<5;this.s=x>>>0;return this.s/4294967296}
  range(a,b){return a+(b-a)*this.next()}
}

const MODULE_DEFAULTS={
  hull:{mass:12, hp:260}, armor:{mass:18,hp:420}, reactor:{mass:22,hp:180,power:24e6},
  engine:{mass:12,hp:150,force:1.8e6,powerUse:5e6}, gun:{mass:8,hp:120,powerUse:0.2e6,ammo:100,projectileMass:18,muzzle:1300,damage:95,cooldown:1.25},
  laser:{mass:7,hp:105,powerUse:4e6,damage:60,cooldown:0.7,range:4800}, missile:{mass:10,hp:110,powerUse:0.4e6,ammo:12,damage:220,cooldown:4},
  shield:{mass:14,hp:130,powerUse:6e6,capacity:500,recharge:45}, bridge:{mass:7,hp:140}, radiator:{mass:8,hp:120}
};

function mod(type,x,y,opts={}){
  return {type,x,y,...MODULE_DEFAULTS[type],...opts,id:opts.id||`${type}-${Math.random().toString(36).slice(2,8)}`, cooldownLeft:0, active:false, disabled:false};
}

export function buildBroadsideFrigate(team='A'){
  const modules=[
    mod('hull',0,0,{mass:95,hp:1250,id:'keel'}), mod('armor',0,0,{mass:75,hp:1050,id:'belt',arc:'side',absorb:0.72}),
    mod('bridge',2,0,{id:'bridge'}), mod('reactor',-4,0,{id:'reactor',power:34e6}),
    mod('shield',0,0,{id:'shield-belt',capacity:620,recharge:42,arc:'side'}),
    mod('engine',-10,-3,{id:'engine-port',force:1.5e6,dir:0}), mod('engine',-10,3,{id:'engine-starboard',force:1.5e6,dir:0}),
    mod('engine',7,-5,{id:'retro-port',force:0.55e6,dir:Math.PI}), mod('engine',7,5,{id:'retro-starboard',force:0.55e6,dir:Math.PI}),
    mod('gun',0,-6,{id:'port-1',mountDir:-Math.PI/2,ammo:90}),mod('gun',5,-6,{id:'port-2',mountDir:-Math.PI/2,ammo:90}),mod('gun',-5,-6,{id:'port-3',mountDir:-Math.PI/2,ammo:90}),
    mod('gun',0,6,{id:'stbd-1',mountDir:Math.PI/2,ammo:90}),mod('gun',5,6,{id:'stbd-2',mountDir:Math.PI/2,ammo:90}),mod('gun',-5,6,{id:'stbd-3',mountDir:Math.PI/2,ammo:90}),
  ];
  return shipFromModules('Resolute-class broadside frigate',team,modules,{length:24,width:14,ai:'broadside'});
}

export function buildPursuitFrigate(team='B'){
  const modules=[
    mod('hull',0,0,{mass:60,hp:850,id:'keel'}), mod('armor',3,0,{mass:26,hp:340,id:'bow-armor',arc:'front',absorb:0.68}),
    mod('bridge',1,0,{id:'bridge'}), mod('reactor',-2,0,{id:'reactor',power:30e6}), mod('shield',6,0,{id:'shield-bow',capacity:620,recharge:50,arc:'front'}),
    mod('engine',-9,-4,{id:'main-port',force:2.15e6,dir:0}),mod('engine',-9,4,{id:'main-starboard',force:2.15e6,dir:0}),
    mod('engine',0,-6,{id:'turn-port-a',force:0.75e6,dir:Math.PI/2}),mod('engine',0,6,{id:'turn-stbd-a',force:0.75e6,dir:-Math.PI/2}),
    mod('engine',7,-5,{id:'retro-port',force:0.65e6,dir:Math.PI}),mod('engine',7,5,{id:'retro-starboard',force:0.65e6,dir:Math.PI}),
    mod('gun',7,-2.8,{id:'bow-gun-1',mountDir:0,ammo:130,muzzle:1450,damage:82,cooldown:0.9}),mod('gun',7,2.8,{id:'bow-gun-2',mountDir:0,ammo:130,muzzle:1450,damage:82,cooldown:0.9}),
    mod('laser',5,0,{id:'bow-laser',mountDir:0,range:3600,damage:45,cooldown:0.55})
  ];
  return shipFromModules('Vigilant-class pursuit frigate',team,modules,{length:22,width:13,ai:'pursuit'});
}

export function shipFromModules(name,team,modules,opts={}){
  const s={name,team,modules,x:0,y:0,vx:0,vy:0,angle:0,omega:0,length:opts.length||20,width:opts.width||12,ai:opts.ai||'pursuit',dead:false,kills:0,shots:0,hits:0,damageDone:0,order:'', desiredAngle:0, throttle:0, timeAlive:0};
  recalc(s); return s;
}

export function recalc(s){
  s.mass=s.modules.filter(m=>m.hp>0).reduce((a,m)=>a+m.mass,0)*1000;
  s.inertia=Math.max(1,s.modules.filter(m=>m.hp>0).reduce((a,m)=>a+(m.mass*1000)*(m.x*m.x+m.y*m.y+4),0));
  s.radius=Math.hypot(s.length/2,s.width/2);
  s.power=s.modules.filter(m=>m.type==='reactor'&&m.hp>0).reduce((a,m)=>a+m.power*(m.hp/m.maxHp||1),0);
}

function initModule(m){m.maxHp=m.hp;if(m.type==='shield'){m.charge=m.capacity;}return m}
export function initialiseShip(s){s.modules.forEach(initModule);recalc(s);return s}

function aliveMods(s,type){return s.modules.filter(m=>m.type===type&&m.hp>0&&!m.disabled)}
function localToWorld(s,m){const [rx,ry]=rot(m.x,m.y,s.angle);return [s.x+rx,s.y+ry]}

export class Battle {
  constructor(a=buildBroadsideFrigate('A'),b=buildPursuitFrigate('B'),seed=1){
    this.rng=new RNG(seed);this.t=0;this.ships=[initialiseShip(a),initialiseShip(b)];this.projectiles=[];this.events=[];this.winner=null;
    Object.assign(this.ships[0],{x:-1400,y:-350,angle:0.12});Object.assign(this.ships[1],{x:1400,y:350,angle:Math.PI+0.1});
  }
  log(text){this.events.push({t:this.t,text}); if(this.events.length>180)this.events.shift()}
  step(dt=G.dt){
    if(this.winner)return;
    this.t+=dt;
    for(const s of this.ships){if(s.dead)continue;s.timeAlive+=dt;this.ai(s,this.enemy(s));}
    for(const s of this.ships){if(!s.dead)this.applySystems(s,dt)}
    this.updateProjectiles(dt);this.collisions();this.checkDeaths();
    if(this.t>240&&!this.winner){this.winner='draw';this.log('Battle ended by time limit.')}
  }
  enemy(s){return this.ships.find(o=>o!==s)}
  ai(s,e){
    if(!e||e.dead)return;
    const dx=e.x-s.x,dy=e.y-s.y,d=Math.hypot(dx,dy),bearing=Math.atan2(dy,dx);
    const relvx=e.vx-s.vx, relvy=e.vy-s.vy, closing=dot(relvx,relvy,dx/d,dy/d);
    if(s.ai==='broadside'){
      const side = wrap(bearing-s.angle)>0 ? 1:-1;
      s.desiredAngle=wrap(bearing-side*Math.PI/2);
      if(d>2300)s.throttle=0.78; else if(d<1100)s.throttle=-0.25; else s.throttle=0.18;
      s.order=d>2300?'Close to gunnery range':d<1100?'Open the range':'Hold broadside';
    } else {
      s.desiredAngle=bearing;
      if(d>1900)s.throttle=1; else if(d<650)s.throttle=-0.55; else s.throttle=0.34;
      s.order=d<650?'Brake and avoid overshoot':(Math.abs(closing)>900?'Match vector':'Keep bow on target');
    }
  }
  applySystems(s,dt){
    recalc(s);
    for(const m of s.modules){m.active=false;m.cooldownLeft=Math.max(0,(m.cooldownLeft||0)-dt)}
    for(const sh of aliveMods(s,'shield'))sh.charge=Math.min(sh.capacity,sh.charge+sh.recharge*dt);
    let powerBudget=aliveMods(s,'reactor').reduce((a,m)=>a+m.power*(m.hp/m.maxHp),0);
    const angleErr=wrap(s.desiredAngle-s.angle); const turnCmd=clamp(angleErr*1.8-s.omega*1.4,-1,1);
    const throttle=s.throttle;
    for(const eng of aliveMods(s,'engine')){
      if(powerBudget<eng.powerUse*0.2)continue;
      const [dx,dy]=rot(Math.cos(eng.dir),Math.sin(eng.dir),s.angle);
      const [rx,ry]=rot(eng.x,eng.y,s.angle);
      const torqueSign=Math.sign(cross(rx,ry,dx,dy));
      const forwardness=dot(dx,dy,Math.cos(s.angle),Math.sin(s.angle));
      let cmd=0;
      if(Math.abs(torqueSign)>0.1)cmd += Math.max(0,turnCmd*torqueSign)*0.72;
      if(throttle>=0 && forwardness>0.45)cmd += throttle;
      if(throttle<0 && forwardness<-0.45)cmd += -throttle;
      cmd=clamp(cmd,0,1);
      if(cmd<0.03)continue;
      const use=eng.powerUse*cmd; if(use>powerBudget)cmd*=powerBudget/use;
      powerBudget-=eng.powerUse*cmd;eng.active=true;eng.output=cmd;
      const F=eng.force*cmd*(0.45+0.55*eng.hp/eng.maxHp);
      s.vx += dx*F/s.mass*dt; s.vy += dy*F/s.mass*dt;
      s.omega += cross(rx,ry,dx*F,dy*F)/s.inertia*dt;
    }
    s.x+=s.vx*dt;s.y+=s.vy*dt;s.angle=wrap(s.angle+s.omega*dt);
    this.fireWeapons(s,this.enemy(s),powerBudget);
  }
  fireWeapons(s,e,powerBudget){
    if(!e||e.dead)return;
    const dx=e.x-s.x,dy=e.y-s.y,d=len(dx,dy),bearing=Math.atan2(dy,dx);
    for(const w of s.modules.filter(m=>(m.type==='gun'||m.type==='laser')&&m.hp>0&&!m.disabled)){
      if(w.cooldownLeft>0||powerBudget<w.powerUse)continue;
      const aim=wrap(s.angle+(w.mountDir||0)); const err=Math.abs(wrap(bearing-aim));
      const arc=w.type==='gun'?0.32:0.24;
      if(err>arc)continue;
      if(w.type==='gun'){
        if(w.ammo<=0)continue;
        const lead=interceptAngle(s,e,w.muzzle); if(Math.abs(wrap(lead-aim))>arc)continue;
        const spread=this.rng.range(-0.010,0.010); const shotAng=lead+spread; const [mx,my]=localToWorld(s,w);
        const rvx=Math.cos(shotAng)*w.muzzle,rvy=Math.sin(shotAng)*w.muzzle;
        this.projectiles.push({team:s.team,owner:s,x:mx,y:my,vx:s.vx+rvx,vy:s.vy+rvy,mass:w.projectileMass,damage:w.damage,r:1.2,ttl:G.projectileTTL});
        const ix=-w.projectileMass*rvx,iy=-w.projectileMass*rvy;s.vx+=ix/s.mass;s.vy+=iy/s.mass;
        const [rx,ry]=rot(w.x,w.y,s.angle);s.omega+=cross(rx,ry,ix,iy)/s.inertia;
        w.ammo--;s.shots++;
      } else {
        if(d>w.range)continue;
        this.hit(s,e,w.damage,'laser',w);s.shots++;s.hits++;
        const energy=w.damage*1.0e6; const impulse=energy/G.c; s.vx-=Math.cos(aim)*impulse/s.mass;s.vy-=Math.sin(aim)*impulse/s.mass;
      }
      w.cooldownLeft=w.cooldown;powerBudget-=w.powerUse;
    }
  }
  updateProjectiles(dt){for(const p of this.projectiles){p.px=p.x;p.py=p.y;p.x+=p.vx*dt;p.y+=p.vy*dt;p.ttl-=dt}this.projectiles=this.projectiles.filter(p=>p.ttl>0&&!p.dead)}
  collisions(){
    for(const p of this.projectiles){for(const s of this.ships){if(s.dead||s.team===p.team)continue;
      const ax=p.px??p.x, ay=p.py??p.y, bx=p.x, by=p.y, abx=bx-ax, aby=by-ay;
      const denom=abx*abx+aby*aby||1; const u=clamp(((s.x-ax)*abx+(s.y-ay)*aby)/denom,0,1);
      const hx=ax+abx*u, hy=ay+aby*u;
      if(len(hx-s.x,hy-s.y)<=s.radius){
      const ivx=p.mass*p.vx,ivy=p.mass*p.vy;s.vx+=ivx/s.mass;s.vy+=ivy/s.mass;const rx=hx-s.x,ry=hy-s.y;s.omega+=cross(rx,ry,ivx,ivy)/s.inertia;
      this.hit(p.owner,s,p.damage,'shell',null,{x:hx,y:hy});p.owner.hits++;p.dead=true;break;
    }}}
  }
  hit(attacker,target,damage,kind,weapon,impact=null){
    const sourceAng=Math.atan2(attacker.y-target.y,attacker.x-target.x);
    const incidenceShield=Math.abs(wrap(sourceAng-target.angle));
    const shield=aliveMods(target,'shield').find(sh=>sh.arc==='front'?incidenceShield<Math.PI/3:sh.arc==='side'?Math.abs(incidenceShield-Math.PI/2)<Math.PI/3:true);
    let remain=damage;
    if(shield&&shield.charge>0){const absorb=Math.min(shield.charge,remain);shield.charge-=absorb;remain-=absorb}
    if(remain<=0)return;
    const incidence=Math.abs(wrap(sourceAng-target.angle));
    const frontalHit=incidence<Math.PI/3;
    const sideHit=Math.abs(incidence-Math.PI/2)<Math.PI/3;
    const armor=aliveMods(target,'armor').find(a=>a.arc==='front'?frontalHit:a.arc==='side'?sideHit:true);
    if(armor&&armor.hp>0){
      const stopped=Math.min(remain*(armor.absorb||0.6), armor.hp);
      armor.hp-=stopped; remain-=stopped; attacker.damageDone+=stopped;
      if(armor.hp<=0)this.log(`${target.name}: ${armor.id} armour has been penetrated.`);
    }
    if(remain<=0)return;
    const ix=impact?impact.x:target.x+Math.cos(sourceAng)*target.radius*0.7, iy=impact?impact.y:target.y+Math.sin(sourceAng)*target.radius*0.7;
    const local=rot(ix-target.x,iy-target.y,-target.angle);
    const candidates=target.modules.filter(m=>m.hp>0).map(m=>({m,d:Math.hypot(m.x-local[0],m.y-local[1])})).sort((a,b)=>a.d-b.d);
    const chosen=(this.rng.next()<0.7?candidates[0]:candidates[Math.min(candidates.length-1,Math.floor(this.rng.next()*4))])?.m;
    if(!chosen)return;const before=chosen.hp; chosen.hp=Math.max(0,chosen.hp-remain);attacker.damageDone+=Math.min(before,remain);
    if(chosen.hp===0){this.log(`${target.name}: ${chosen.id} destroyed by ${attacker.name}.`); if(chosen.type==='reactor'&&this.rng.next()<0.18){const blast=220;for(const m of target.modules)if(m.hp>0)m.hp=Math.max(0,m.hp-blast*this.rng.range(0.15,0.65));this.log(`${target.name}: reactor cascade damages nearby systems.`)}}
  }
  checkDeaths(){
    for(const s of this.ships){if(s.dead)continue;const hull=s.modules.find(m=>m.id==='keel');const bridge=aliveMods(s,'bridge').length;const reactor=aliveMods(s,'reactor').length; if(!hull||hull.hp<=0||!bridge||(!reactor&&aliveMods(s,'engine').length===0)){s.dead=true;this.log(`${s.name} is combat ineffective.`)}}
    const living=this.ships.filter(s=>!s.dead);if(living.length<=1){this.winner=living[0]?.team||'draw';if(living[0])living[0].kills++;}
  }
  summary(){return {time:this.t,winner:this.winner,ships:this.ships.map(s=>({name:s.name,team:s.team,dead:s.dead,mass:s.mass,shots:s.shots,hits:s.hits,damage:s.damageDone,speed:len(s.vx,s.vy),omega:s.omega,modules:s.modules.map(m=>({id:m.id,type:m.type,hp:m.hp,maxHp:m.maxHp,ammo:m.ammo,charge:m.charge}))}))}}
}

export function runBattle(seed=1,maxSteps=6000){const b=new Battle(buildBroadsideFrigate('A'),buildPursuitFrigate('B'),seed);for(let i=0;i<maxSteps&&!b.winner;i++)b.step();return b.summary()}
