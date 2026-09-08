import {Battle,recalc} from './sim.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const cross=(ax,ay,bx,by)=>ax*by-ay*bx;
const dot=(ax,ay,bx,by)=>ax*bx+ay*by;
const rot=(x,y,a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
const alive=(s,type)=>s.modules.filter(m=>m.type===type&&m.hp>0&&!m.disabled);

// Replaces the simple heading controller with a damped angular-rate controller.
// The helmsman first decides how fast the ship should rotate, then commands engines
// to reach that angular rate. Attitude correction takes priority over translation
// when a damaged/asymmetric engine layout would otherwise worsen a spin.
Battle.prototype.applySystems=function(s,dt){
  recalc(s);
  for(const m of s.modules){m.active=false;m.output=0;m.cooldownLeft=Math.max(0,(m.cooldownLeft||0)-dt)}
  for(const sh of alive(s,'shield'))sh.charge=Math.min(sh.capacity,sh.charge+sh.recharge*dt);

  let powerBudget=alive(s,'reactor').reduce((a,m)=>a+m.power*(m.hp/m.maxHp),0);
  const angleErr=wrap(s.desiredAngle-s.angle);
  const desiredOmega=clamp(angleErr*.72,-.42,.42);
  const omegaErr=desiredOmega-s.omega;
  const turnCmd=clamp(omegaErr*3.4,-1,1);
  s.desiredOmega=desiredOmega;
  s.angularControlDemand=turnCmd;

  for(const eng of alive(s,'engine')){
    if(powerBudget<eng.powerUse*.2)continue;
    const [dx,dy]=rot(Math.cos(eng.dir),Math.sin(eng.dir),s.angle);
    const [rx,ry]=rot(eng.x,eng.y,s.angle);
    const torque=cross(rx,ry,dx,dy);
    const torqueSign=Math.sign(torque);
    const forwardness=dot(dx,dy,Math.cos(s.angle),Math.sin(s.angle));

    let translation=0;
    if(s.throttle>=0&&forwardness>.45)translation=s.throttle;
    if(s.throttle<0&&forwardness<-.45)translation=-s.throttle;

    // If translational thrust would make the requested angular correction worse,
    // throttle it back temporarily. This is especially important after one engine
    // or one broadside has been destroyed.
    if(Math.abs(torqueSign)>.1&&turnCmd*torqueSign<0&&Math.abs(turnCmd)>.12){
      translation*=1-Math.min(.9,Math.abs(turnCmd)*.9);
    }

    let steering=0;
    if(Math.abs(torqueSign)>.1&&turnCmd*torqueSign>0){
      steering=Math.abs(turnCmd)*.92;
    }
    let cmd=clamp(translation+steering,0,1);
    if(cmd<.025)continue;

    const requested=eng.powerUse*cmd;
    if(requested>powerBudget)cmd*=powerBudget/requested;
    powerBudget-=eng.powerUse*cmd;
    eng.active=true;eng.output=cmd;
    const F=eng.force*cmd*(.45+.55*eng.hp/eng.maxHp);
    s.vx+=dx*F/s.mass*dt;s.vy+=dy*F/s.mass*dt;
    s.omega+=cross(rx,ry,dx*F,dy*F)/s.inertia*dt;
  }

  s.x+=s.vx*dt;s.y+=s.vy*dt;s.angle=wrap(s.angle+s.omega*dt);
  this.fireWeapons(s,this.enemy(s),powerBudget);
};

const baseFireWeapons=Battle.prototype.fireWeapons;

function gunRecoilTorque(gun){
  // Recoil impulse points opposite the projectile direction in ship-local axes.
  const a=gun.mountDir||0;
  return cross(gun.x,gun.y,-Math.cos(a),-Math.sin(a));
}

// Fire control treats recoil as another attitude-control actuator. It does not fire
// guns blindly just to rotate: a gun still needs the normal target solution. But
// when the ship is correcting a meaningful spin, fire control favours guns whose
// recoil helps and can briefly hold guns whose recoil would make that spin worse.
Battle.prototype.fireWeapons=function(s,e,powerBudget){
  if(!e||e.dead)return baseFireWeapons.call(this,s,e,powerBudget);
  const demand=s.angularControlDemand||0;
  const angleErr=wrap(s.desiredAngle-s.angle);
  const correcting=Math.abs(demand)>.28&&(Math.abs(s.omega)>.045||Math.abs(angleErr)>.09);
  if(!correcting)return baseFireWeapons.call(this,s,e,powerBudget);

  const bearing=Math.atan2(e.y-s.y,e.x-s.x);
  const guns=s.modules.filter(m=>m.type==='gun'&&m.hp>0&&!m.disabled&&(m.ammo??1)>0&&(m.cooldownLeft||0)<=0);
  const favourable=guns.filter(g=>{
    const tau=gunRecoilTorque(g);
    const aim=wrap(s.angle+(g.mountDir||0));
    return Math.sign(tau)===Math.sign(demand)&&Math.abs(wrap(bearing-aim))<.42;
  });
  const dangerousSpin=Math.abs(s.omega)>.24;
  if(!favourable.length&&!dangerousSpin)return baseFireWeapons.call(this,s,e,powerBudget);

  const restore=[];
  for(const g of guns){
    const tau=gunRecoilTorque(g);
    if(Math.abs(tau)<1e-6)continue;
    if(Math.sign(tau)!==Math.sign(demand)){
      restore.push([g,g.disabled]);g.disabled=true;
    }
  }
  try{return baseFireWeapons.call(this,s,e,powerBudget)}
  finally{for(const [g,was] of restore)g.disabled=was}
};
