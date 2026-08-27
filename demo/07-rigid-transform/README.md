[中文](README.zh.md) | English

# demo/07 — Rigid transforms

## Build the intuition first (start here if new)

demo 07 teaches one thing: **how to describe "position + orientation" with math, and relay "turn + step" across a chain of joints to find where the tip is.**

### Position = 3 numbers
A phone's position in a room is fully described by three numbers `[x, y, z]` (from the wall, the floor, the door). That is "position".

### Orientation needs 3 more numbers
At the same position, the phone can be upright / sideways / face-up — so position alone is not enough. **Position (3 numbers) + orientation (3 numbers) = pose, 6 degrees of freedom** in total, which fully describes a rigid body.

"Orientation" has three equivalent spellings (the same thing in different packaging, like `0.5 = 1/2 = 50%`):

| Spelling | One-line meaning | Analogy |
|---|---|---|
| rotation matrix | a 3×3 table stating where the new axes point | an orientation manual |
| Euler angles | how much to rotate about X / Y / Z | tilt head, turn, tilt sideways |
| quaternion | a 4-number package | a zip of orientation |

### Transform = turn once + step once
Converting "a position seen from the lectern" into "seen from your seat" is a "transform": **translation** (walk a few steps) + **rotation** (turn around). Finding the arm tip is relaying "turn once + step once" from the base to the tip — that is **forward kinematics (FK)**.

## What you learn

- The three pose representations (rotation matrix / Euler / quaternion) convert back and forth without losing information.
- Homogeneous transform: combine "rotation + translation" into one 4×4 that does "turn then move" at once.
- Forward kinematics (FK): given joint angles, relay transforms to compute the tip pose, and verify against MuJoCo.

## How to run

Prerequisites: `python3` + `numpy` + `mujoco` (installed in demo 06).

### 1. Pure math: build the intuition (headless, no mujoco needed)
```bash
python3 transforms.py
```
Prints the four layers — position → orientation → transform → packaging. Run this first.

### 2. Arm FK verification (headless)
```bash
python3 arm.py
```
Prints a "hand-computed FK tip position vs MuJoCo position" table.

### 3. Arm moving (interactive window, needs a display)
```bash
python3 arm.py --view
```

## What to observe

1. **transforms.py**: the same rotation converts back and forth between matrix / quaternion with max error around `1e-16` (no information lost).
2. **arm.py**: the hand-computed FK tip position / orientation matches MuJoCo's built-in result almost exactly (error around `1e-15`).
3. **--view**: the two-joint arm swings and the tip traces an arc in the X-Z plane.

## How it relates to the final goal

- demo 08's FK / DH and demo 09's trajectory control build on this "frame transform" foundation.
- demo 12's "tip pose → joint angles" is FK inverted (IK), using the same homogeneous transforms.
- Quaternions are the standard pose representation in MuJoCo / ROS2 (tf); this demo lays that foundation.
