# demo/09 — Trajectory control

## Build the intuition first (start here if new)

demo 08 taught "given a target position, solve joint angles (IK)". This chapter answers two new questions:

1. **How to move "smoothly"**: a start and an end are not enough — you must also decide where it is and how fast it moves at every instant. That is "**trajectory generation**".
2. **How to make sure it actually tracks**: gravity, inertia, and friction make the real thing drift, so you correct the effort using the error. That is "**PID closed-loop control**".

### Three trajectories (same trip, three ways to move)
- **Joint trapezoid**: each joint's velocity is trapezoid-shaped (accelerate → cruise → decelerate), no jerk at start/stop.
- **Cartesian straight line**: the tip moves a straight line in space (linear position interpolation).
- **SLERP**: orientation interpolates with quaternions at constant angular velocity, staying a valid pose every step.

### PID = correct using the error
- **P (proportional)**: correct with effort proportional to the current error.
- **I (integral)**: accumulate past error to kill the steady-state "always off by a constant" error.
- **D (derivative)**: react to how fast the error is changing, damping overshoot and oscillation.

### The control loop (closed loop)
```
target trajectory → error → PID → torque → robot (simulation) → actual angle → error again → ...
```
This is "feedback": not "compute once and be done", but continuously measure and correct.

## What you learn

- Trapezoidal velocity trajectory generation (accelerate / cruise / decelerate).
- Cartesian linear interpolation and quaternion SLERP.
- What each PID term does, verified in closed-loop simulation.
- PID torque control of a MuJoCo pendulum tracking a trajectory, and its tracking error.

## How to run

Prerequisites: `python3` + `numpy` + `mujoco` (installed in demo 06).

### 1. Pure math: trajectory generation + PID simulation (headless, no mujoco)
```bash
python3 trajectory.py
```
Prints in order: the trapezoid table, linear interpolation, SLERP, and PID step tracking (error converges to 0).

### 2. Pendulum PID trajectory tracking (headless)
```bash
python3 control.py
```
Prints a "target angle vs actual angle" table and the max tracking error.

### 3. Pendulum tracks a back-and-forth swing (interactive window, needs a display)
```bash
python3 control.py --view
```

## What to observe

1. **trajectory.py**: the trapezoid velocity rises, holds, then falls; SLERP's angle grows linearly with unit norm; in the PID demo, P-only leaves a fixed offset while adding I drives the error to 0.
2. **control.py**: the pendulum's actual angle hugs the target trajectory with a small max tracking error (gravity is cancelled by PID).
3. Try setting `Ki` to 0 in `control.py` (PD only) and see whether a fixed offset appears during the hold phase — that is what the integral term does.

## How it relates to the final goal

- This is a core robotics-software skill: real arms are all "trajectory generation + closed-loop control".
- demo 11 (C++ control) will re-implement this Python control loop with rclcpp at high rate.
- In demo 13's hot-plugging, re-planning a trajectory after swapping end-effectors also builds on this trajectory/control foundation.
