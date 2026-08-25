# ros-hotplug-by-dsh

> **One-liner**: Be the first to apply DeepSeek Harness (DSH) *spatiotemporal compositionality* to **hot-plugging of embodied-robot capabilities**, with a **reproducible implementation + tutorial-grade demos**.

---

## Personal profile (corrected · important)

| Dimension | Status |
|---|---|
| **Strengths (already have)** | C / Python / Linux systems programming; distributed systems; real-time forwarding & protocol-stack optimization; high-availability & security-sensitive systems (active/standby redundancy, grayscale upgrade, second-level auto rollback, 99.9% availability, zero-trust pipeline, pub/sub decoupling); AI-assisted engineering; delivery ownership |
| **Robotics knowledge** | **= 0** (no ROS, kinematics, control, or simulation) |
| **LLM knowledge** | **= 0** (no LLM theory, training, or agent development) |

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
│   ├── bridge/                     #   bridge contract v1.1 + thin SDK
│   └── sim/                        #   MuJoCo models & scenes
├── plugins/                        # archived dynamic Cordis plugins (next-demo / sync-docs)
└── demo/                           # tutorial dirs (see demo/README.md)
    ├── 00-dsh-quickstart/ ... 15-imitation/
    └── 13-hotplug/                 # ★ flagship demo: capability hot-plugging (with reliability design)
```

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

Mapping reliability engineering practice onto the hot-plug demo (`demo/13-hotplug`):

| Engineering practice | This project's counterpart |
|---|---|
| Integrity hash verification (signature extension TBD) | Verify manifest / hash before mounting a capability; reject invalid ones |
| Multi-version coexistence | One capability supports multiple coexisting versions |
| Version swap + zero downtime | unmount old instance + mount new instance, agent-unaware (grayscale not in demo scope) |
| Auto rollback on failure (with a brief swap window) | Auto-restore the old instance if a swap fails (best effort, explicit alert on restore failure) |
| Pub/sub event notification | Capability add/remove broadcasts events; agent perceives via subscription |
| Hardware-difference shielding layer (decoupling) | Capability abstraction: same-type end-effectors shadow by name; upper layers unaware |
| Exact resource reclamation (mechanism verifiable, not an SLA metric) | arm-scope isolation + Cordis dispose for exact cleanup |

See [`docs/design.md`](docs/design.md) section 8.

---

## Roadmap (future work, recorded here)

- **Restart reconciliation**: after a DSH-side restart, rebuild mount records from sim_bridge physical state (today "reset all" or re-creating the session works around it).
- **Simulation realism**: future sim uses physically real suction/gripper + ball (contact detection, the ball follows the end-effector once grasped), to give "success rate" physical meaning.
- **Evaluation suite eval/**: hotplug five-criteria automation / robot public-baseline comparison / agent vs oracle vs random.
- **Panel persistence**: tsdown build for the client half, restored automatically on restart.
- **native_swap measurement**: timing comparison of native ROS2 end-effector swap (measured, never prefilled).

## Quick start

> Start from [`demo/00-dsh-quickstart`](demo/00-dsh-quickstart): install DSH → set the key → run the first agent; the robotics part starts at [`demo/06-ros2-mujoco-env`](demo/06-ros2-mujoco-env) with the ROS2 + MuJoCo environment.

## Disclosure & evidence

> First public commit, FreeTSA timestamp receipts, and publication links: see [`docs/disclosure-log.md`](docs/disclosure-log.md).
