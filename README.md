# Fleet Physics — first-pass prototype

Open `index.html` through any simple local web server (ES modules are used). For example: `python3 -m http.server 8000` and browse to `http://localhost:8000`.

## What is implemented
- Newtonian 2D spaceflight: force, mass, acceleration, velocity, angular momentum; no top speed.
- Component-built frigates with component mass and HP.
- Thrusters have positions and fixed thrust directions. Off-axis thrust creates torque.
- Main/reverse/lateral thrusters can be damaged independently.
- Guns fire physical projectiles that inherit ship velocity.
- Gun recoil applies equal/opposite linear impulse and off-centre guns impart angular momentum.
- Projectile impacts impart momentum/angular momentum to the target.
- Swept collision detection for very fast shells.
- Directional shield arcs and regenerating shield charge.
- Directional armour that absorbs damage before internal modules.
- Individual component damage and destruction, including reactors, engines, weapons and bridges.
- Ammunition tracking and weapon cooldowns.
- Reactor power budget used by engines/shields/weapons.
- Commander-level AI: broad orders such as close, hold broadside, open range, match vector and keep bow on target.
- Browser visualiser plus a 100-battle button.
- Deterministic Node benchmark (`npm run benchmark`) for balance testing.

## Starting designs
### Resolute-class broadside frigate
Heavy hull and belt armour, side shield, six broadside guns, relatively weak manoeuvring. It tries to hold the target roughly 90 degrees off its bow.

### Vigilant-class pursuit frigate
Lighter hull, frontal shield/armour, two high-velocity bow guns, a bow laser, strong main engines and lateral/retro thrusters. It tries to keep its nose on the target.

## Current 500-battle result
- Resolute: 1 win
- Vigilant: 497 wins
- Draw: 2
- Mean fight duration: ~18.5 seconds

That imbalance is intentionally left visible for the next design pass rather than tuning around it blindly. The immediate question is whether frontal regenerating shields are too powerful, whether broadside ships need much larger salvos/range, or whether tactical AI needs to exploit vector changes and shield arcs more intelligently.

## Deliberate first-pass simplifications
- 2D rather than 3D.
- Ships are approximated as circular collision envelopes while modules have local positions.
- No structural breakup, heat model, crew, repair parties, missile guidance, magazines, fuel/propellant, sensors, ECM, carriers or fleet command yet.
- Lasers use effectively instantaneous hits; photon recoil is included but tiny.
- Armour is arc-based rather than geometric ray-tracing through plating.
