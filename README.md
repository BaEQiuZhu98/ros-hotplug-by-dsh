# ros-hotplug-by-dsh

> **One-liner**: Be the first to apply DeepSeek Harness (DSH) *spatiotemporal compositionality* to **hot-plugging of embodied-robot capabilities**, with a **reproducible implementation + tutorial-grade demos**.

---

## Author background

| Dimension | Status |
|---|---|
| **Strengths** | C / Python / Linux systems programming; distributed systems; real-time forwarding & protocol-stack optimization; high-availability & security-sensitive systems (active/standby redundancy, grayscale upgrade, second-level auto rollback, 99.9% availability, zero-trust pipeline, pub/sub decoupling); AI-assisted engineering; delivery ownership |
| **Robotics & LLM knowledge** | learned from zero along the demo path (starting at demo/00), covering ROS2 / kinematics / simulation / DSH agent development |

> **Positioning**: use the "systems engineering + reliability" strengths to enter the intersection of *embodied robot software × DSH agent*. **Every piece of robotics and LLM knowledge is learned from zero, in demo order** — this project makes no assumption that you already know anything.

---

## Novelty claim (one sentence)

> **The first to apply DSH spatiotemporal compositionality (layered scopes + Cordis lifecycle) to hot-plugging of embodied-robot capabilities, with a reproducible implementation and evaluation.**

- Does *not* claim to have invented spatiotemporal compositionality (that is DSH's mechanism).
- Does *not* claim to be first at robot hot-plugging (ROS2 lifecycle nodes, AICA, etc. already exist).
- Claims the combination of **this mechanism × this scenario × this implementation**, reproducibly verified.

See [`docs/design.md`](docs/design.md) for the precise boundary.

---

## Repository layout

```
ros-hotplug-by-dsh/
├── README.zh.md / README.md        # this file (zh / en)
├── docs/                           # design / novelty / glossary / spatiotemporal / disclosure-log
├── src/                            # source engineering (see src/README.zh.md)
│   ├── capabilities/               #   capability repo (repo/) + mount service (mount_service/) + spec + mount guard
│   ├── presets/robo/               #   robot task agent preset (persona + observer + arm manager + arm_status/take_object)
│   ├── ros2/                       #   sim_bridge (two-arm sim bridge) + cpp_control (1kHz control)
│   ├── bridge/                     #   bridge contract + thin SDK
│   └── sim/                        #   MuJoCo models & scenes
├── eval/                           # evaluation (robot / agent / hotplug / tests)
├── plugins/                        # archived dynamic Cordis plugins
└── demo/                           # tutorial dirs (see demo/README.md)
    ├── 00-dsh-quickstart/ ... 13-hotplug/
    └── 13-hotplug/                 # ★ flagship demo: capability hot-plugging (with reliability design)
```

---

## Current implementation overview

- **Capability repo + mount service**: grasp 1.0.0/1.1.0/1.2.0 and suction 1.0.0 (end-effector class), camera_detect 1.0.0 (sensor class); sha256 admission + kind routing before mount, runtime mount/unmount with no restart, failure rollback, same-name instances isolated by arm scope.
- **Capability panel (the human's only write path)**: arm/perception dropdowns for assembly, reset-all and per-arm reset (including joints home), take-ball row (choose an arm or none; the message goes to the agent for execution), ball position set & display, collapse/expand.
- **robo agent preset**: the agent only perceives `ready` and executes `take_object`, never end-effector implementation details; mounting the vision capability injects the ball position into the execution chain (blind grab → precise), unmounting falls back automatically, and vision failures fail open.
- **Bridge contract + SDK**: tool_config / ball_position / touch_command / move_to (convergence-completing) / home_command / reset_command + /joint_state feedback (joints/tools/ball/ee).
- **Evaluation**: pytest gates + bridge live suite + /tmp isolated driver suites (see eval/tests/README.zh.md).

---

## Demo learning path (DSH first, robotics later)

Core logic: **learn DSH (including AI coding) first, then use DSH to accelerate the robotics part, and finally tie both together with hot-plugging.**

See [`demo/README.md`](demo/README.md) for the per-demo breakdown. Order:

1. What is an agent
2. Better AI coding
3. DSH concepts
4. DSH plugin
5. DSH spatiotemporal compositionality
6. → only then robotics: ROS2 / rigid transforms / kinematics / trajectory control / ROS2 nodes / C++ control
7. → finally `demo/13-hotplug` ties DSH and robotics into the flagship demo

---

## Reliability design overview

Mapping reliability engineering practice onto capability hot-plugging (`demo/13-hotplug` tutorial + `src/` engineering):

| Engineering practice | This project's counterpart |
|---|---|
| Integrity hash verification | Verify manifest / hash before mounting a capability; reject invalid ones |
| Multi-version coexistence | One capability supports multiple coexisting versions |
| Version swap + zero downtime | unmount old instance + mount new instance, agent-unaware |
| Auto rollback on failure (with a brief swap window) | Auto-restore the old instance if a swap fails (best effort, explicit alert on restore failure) |
| Pub/sub event notification | Capability add/remove broadcasts events; agent perceives via subscription |
| Hardware-difference shielding layer (decoupling) | Capability abstraction: same-type end-effectors shadow by name; upper layers unaware |
| Exact resource reclamation | arm-scope isolation + Cordis dispose for exact cleanup |

See [`docs/design.md`](docs/design.md) section 8.

---

## Roadmap (future work, recorded here)

- **Simulation realism**: future sim uses physically real suction/gripper + ball (contact detection, the ball follows the end-effector once grasped), to give "success rate" physical meaning.
- **Evaluation extension**: automated agent vs oracle vs random evaluation.

## Quick start

> Start from [`demo/00-dsh-quickstart`](demo/00-dsh-quickstart): install DSH → set the key → run the first agent; the robotics part starts at [`demo/06-ros2-mujoco-env`](demo/06-ros2-mujoco-env) with the ROS2 + MuJoCo environment.

## Disclosure & evidence

> First public commit, FreeTSA timestamp receipts, and publication links: see [`docs/disclosure-log.md`](docs/disclosure-log.md).
