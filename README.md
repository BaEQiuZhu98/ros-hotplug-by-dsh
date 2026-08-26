# ros-hotplug-by-dsh

> **One-liner**: Be the first to apply DeepSeek Harness (DSH) *spatiotemporal compositionality* to **hot-plugging of embodied-robot capabilities**, with a **reproducible implementation + tutorial-grade demos**.

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
├── LICENSE / .gitignore
├── src/                            # source engineering (see src/README.zh.md)
│   ├── setup.sh                    #    one-shot install (path centralization: mount row / panel pkg / robo preset)
│   ├── capabilities/               #    ★ capability repo + mount service + spec
│   │   ├── capability-spec.md      #      capability dev spec (template + manifest + mount flow)
│   │   ├── mount_service/          #      capability mount service (host-resident: sha256 admission + kind routing + arm/slot context bookkeeping + resident bridge daemon)
│   │   ├── repo/                   #      capability repo directory (first-class deliverable): grasp/1.0.0|1.1.0|1.2.0, suction/1.0.0, camera_detect/1.0.0
│   │   └── pack.sh                 #      optional distribution shell: repo dir → npm tarball
│   ├── packages/                   #    out-of-tree npm packages (installed into profile node_modules)
│   │   └── cap-mount-panel/        #      capability panel (dual-face: host /cap-mount route + client tsdown bundle)
│   ├── presets/                    #    runtime carrier
│   │   └── robo/                   #      robot task agent preset (composition + persona + skills)
│   │       └── arm_manager/        #        out-of-tree arm-manager package (arm scopes / perception slot + tools)
│   ├── ros2/                       #    robot side (colcon packages; build/install/log are build artifacts, not committed)
│   │   ├── cpp_control/            #     C++ 1kHz scalar PID loop + rate/jitter/compute-time measurement
│   │   └── sim_bridge/             #     Python simulation bridge (MuJoCo + rclpy)
│   ├── bridge/                     #    bridge contract
│   │   ├── contract.md             #      topic/message schema (v1.2)
│   │   └── bridge_client.py        #     rosbridge client (thin SDK)
│   └── sim/                        #    visualization assets
│       ├── models/                 #     MJCF: two_arm_scene.xml (two arms + ball)
│       └── scenes/                 #     preset scene notes
├── eval/                           # ★ evaluation
│   ├── robot/                      #   IK timing magnitude (against public baselines)
│   ├── agent/                      #   task set & criteria (agent vs oracle vs random evaluation)
│   ├── hotplug/                    #   hot-plug acceptance suites (assemble-env.sh + drivers + fixtures)
│   ├── tests/                      #   pytest gates & live suites
│   ├── lib/                        #   robenv + result aggregation (summary.py)
│   └── results/                    #   run records (run-* dirs, not committed)
├── demo/                           # tutorial dirs (00~13, see demo/README.md)
├── docs/                           # design / novelty / glossary / spatiotemporal / disclosure-log (+ timestamps)
└── plugins/                        # dynamic plugin archive (two workflow plugins)
```

---

## Current implementation overview

- **Capability repo + mount service**: grasp 1.0.0/1.1.0/1.2.0 and suction 1.0.0 (end-effector class), camera_detect 1.0.0 (sensor class); sha256 admission + kind routing before mount, runtime mount/unmount with no restart, failure rollback, same-name instances isolated by arm scope.
- **Capability panel (the human's only write path)**: arm/perception dropdowns for assembly, reset-all and per-arm reset (including joints home), take-ball row (choose an arm or none; the message goes to the agent for execution), ball position set & display, collapse/expand.
- **robo agent preset**: the agent only perceives `ready` and executes `take_object`, never end-effector implementation details; mounting the vision capability injects the ball position into the execution chain (blind grab → precise), unmounting falls back automatically, and vision failures fail open.
- **Bridge contract + SDK**: tool_config / ball_position / touch_command / move_to (convergence-completing) / home_command / reset_command + /joint_state feedback (joints/tools/ball/ee).
- **Evaluation**: pytest gates + bridge live suite + /tmp isolated driver suites (see eval/tests/README.zh.md).
- **Known boundaries**: mount records are process memory — re-mount in the panel after a DSH-side restart; the panel write path is unauthenticated, targeting a single-user trusted environment (see design §7.11/§12).

## Verified environment

- DSH: Cordis `4.0.1`, `@deepseek-ai/dsh-scope` `0.1.0-rc.7` (the core mechanisms rely on their scope/lifecycle APIs; pre-release upstream makes no compatibility promise — re-check against the runtime `cordis_inspect` after upgrades).
- ROS2 Humble + rosbridge_server; MuJoCo/roslibpy/numpy live in the project venv `/root/venvs/robo`.

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
