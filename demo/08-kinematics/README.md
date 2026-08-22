# demo/08 — Kinematics

## Build the intuition first (start here if new)

demo 07 taught forward kinematics (FK): **given joint angles, find where the tip is**. This chapter goes the other way.

### Forward FK vs inverse IK
- **FK**: I know each joint angle, ask "where did the hand reach".
- **IK**: I want the hand to reach a point, ask "what angle should each joint turn to".

IK is what a robot actually does all day — placing the tip at a target relies on it.

### Why IK is hard
FK is "compute forward": angles → one unique tip position. IK is "compute backward": position → possibly **several** joint angles (elbow-up and elbow-down both reach the same point), or possibly **no solution** (target too far, beyond reach).

### Two solvers
- **Analytic**: for simple arms (like a two-link) solve a closed form with the law of cosines — fast and exact, but only certain structures have one.
- **Numerical**: guess an angle, see how far the tip is from the target, then use the "Jacobian" to turn that error back into a joint correction, iterating closer. Complex arms (7-axis) have no closed form and all use this.

## What you learn

- DH parameters: describe one joint with 4 numbers (a/α/d/θ) and multiply them per joint to get FK.
- FK: joint angles → tip position (demo 07 upgraded to the industry-standard DH form).
- IK analytic: the law-of-cosines solution for a two-link arm.
- IK numeric: Jacobian + damped least-squares iteration.
- Velocity-level IK + proportional control: turn the position error into joint velocity so the arm chases the target (a prelude to demo 09's trajectory control).

## How to run

Prerequisites: `python3` + `numpy` + `mujoco` (installed in demo 06).

### 1. Pure math: FK / IK solve & verify (headless, no mujoco needed)
```bash
python3 kinematics.py
```
Give a target, solve joint angles with analytic (both poses) and numeric methods, then verify by plugging back into FK.

### 2. IK drives the arm to the target (headless)
```bash
python3 ik_demo.py
```
Prints a "target → joint angles → MuJoCo tip" table; error should be near zero.

### 3. Arm tracks a target (interactive window, needs a display)
```bash
python3 ik_demo.py --view
```
A green sphere (the target) orbits a circle quickly, and the arm chases it with proportional control driven by the position error (with a joint speed limit, so it lags).

## What to observe

1. **kinematics.py**: one target has two analytic solutions (elbow-up / down), and the numeric solution converges to one of them; plugging back into FK gives near-zero error.
2. **ik_demo.py**: the solved joint angles make MuJoCo's tip error near zero, proving "drive to target" holds.
3. **Unreachable**: when the target exceeds reach, the analytic solver returns `None` (detects no solution).
4. **Chasing**: when the target moves fast, the arm can't keep up and lags, tracing a "pursuit curve" instead of the target circle — that is "speed difference → trajectory difference".

## How it relates to the final goal

- This is the core of motion control: demo 09's trajectory control first needs "given tip pose → solve joint angles".
- demo 12's "one agent instruction → arm motion" is, underneath, IK turning a target pose into joint angles.
- The numeric Jacobian is a general tool in robot control (velocity-level inverse, impedance control) and will be reused later.
