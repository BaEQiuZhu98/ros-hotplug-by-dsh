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

## Repository layout (current phase: demos only, no src / eval yet)

```
ros-hotplug-by-dsh/
├── README.zh.md / README.md        # this file (zh / en)
├── docs/                           # design / novelty / glossary / spatiotemporal / disclosure-log
├── plugins/                        # archived dynamic Cordis plugins (next-demo / sync-docs)
└── demo/                           # tutorial dirs (see demo/README.md)
    ├── 00-dsh-quickstart/
    ├── 01-what-is-agent/
    ├── 02-ai-coding/
    ├── 03-dsh-concepts/
    ├── 04-dsh-plugin/
    ├── 05-dsh-spatiotemporal/
    ├── 06-ros2-mujoco-env/
    ├── 07-rigid-transform/
    ├── 08-kinematics/
    ├── 09-trajectory-control/
    ├── 10-ros2-basics/
    ├── 11-cpp-control/
    ├── 12-dsh-ros-bridge/
    ├── 13-hotplug/                 # ★ flagship demo: capability hot-plugging (with reliability design)
    ├── 14-vision/                  # optional
    └── 15-imitation/               # optional
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
| Zero-trust pipeline (cloud sign/encrypt - device verify/decrypt) | Verify manifest / hash before mounting a capability; reject invalid ones |
| Active/standby redundancy + multi-version coexistence | One capability supports multiple coexisting versions |
| Grayscale upgrade + zero downtime | `update` grayscale-switches to a new version, agent-unaware |
| Second-level auto rollback | Auto-rollback to the previous version if activation fails |
| Pub/sub event notification | Capability add/remove broadcasts events; agent perceives via subscription |
| Hardware-difference shielding layer (decoupling) | Capability abstraction: same-type end-effectors shadow by name; upper layers unaware |
| 99.9% availability / no leaks | `isolate` realm isolation + Cordis dispose for exact cleanup |

See [`docs/design.md`](docs/design.md) section 8.

---

## Quick start

> Start from [`demo/00-dsh-quickstart`](demo/00-dsh-quickstart): install DSH → set the key → run the first agent; the robotics part starts at [`demo/06-ros2-mujoco-env`](demo/06-ros2-mujoco-env) with the ROS2 + MuJoCo environment.

## Disclosure & evidence

> First public commit, FreeTSA timestamp receipts, and publication links: see [`docs/disclosure-log.md`](docs/disclosure-log.md).
