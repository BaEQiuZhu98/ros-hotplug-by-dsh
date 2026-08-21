# demo — Learning Path (DSH first, robotics later)

> Design principle: **learn DSH (including AI coding) with minimal demos first, then use DSH to accelerate the robotics part, and finally tie both together in `13-hotplug`.** Each demo is a minimal, runnable, independently verifiable example; demos do not share code, but knowledge strictly accumulates.

Every demo directory follows the same four-part README:
**What you learn → How to run → What to observe → How it relates to the final goal**.

---

## Phase A — DSH & Agent mental model (learn the tool first, then use it to accelerate robotics)

| # | Dir | What you learn | Observable output | Relation to final goal |
|---|---|---|---|---|
| 00 | `00-dsh-quickstart` | DSH install, headless/web modes, first agent | an agent conversation | runtime base for all later demos |
| 01 | `01-what-is-agent` | LLM basics, tool calling, ReAct loop, structured output | agent calls toy tools to finish a multi-step task, printing think→act→observe trace | the decision-brain principle underlying the DSH agent |
| 02 | `02-ai-coding` | AI-assisted development with DSH: skills, structured docs, progressive disclosure, code review | a "project knowledge" skill + an AI-reviewed snippet | reproduces your Huawei "AI-assisted engineering" experience; used to accelerate all robotics demos |
| 03 | `03-dsh-concepts` | everything-is-a-plugin, Cordis, profile/preset/composition, tool/skill | a "capability = plugin row" diagram + a preset copy | builds the DSH mental model |
| 04 | `04-dsh-plugin` | create a plugin, register tools (`ctx.tools`/`harness.registerTool`), host/client | a custom tool callable by the agent | satisfies the hard "create a plugin" requirement |
| 05 | `05-dsh-spatiotemporal` | scope/layer/realm (space) + lifecycle/version (time) + anchor contract | demos: scope shadowing, isolate isolation, dispose reclamation | ★ the novelty core; the theoretical foundation of `13-hotplug` |

## Phase B — Robotics fundamentals (learn from zero, with DSH assistance)

| # | Dir | What you learn | Observable output | Relation to final goal |
|---|---|---|---|---|
| 06 | `06-ros2-mujoco-env` | ROS2 + MuJoCo install, env isolation, toolchain | talker↔listener + a MuJoCo scene | robotics runtime base |
| 07 | `07-rigid-transform` | rotation matrix / Euler / **quaternion** / homogeneous transform + MuJoCo scene | Franka moves + three pose representations convert consistently | first robotics cornerstone |
| 08 | `08-kinematics` | FK/DH, IK (analytic + numeric Jacobian) | target pose → joint angles → drive to goal | theoretical core of motion control |
| 09 | `09-trajectory-control` | joint trapezoid / Cartesian line / SLERP + PID + control loop | three trajectory comparison curves + tracking error | core skill for robotics software roles |
| 10 | `10-ros2-basics` | node/topic/service/action/tf, rclpy nodes | rqt_graph shows connected nodes | robotics middleware layer |
| 11 | `11-cpp-control` | rclcpp migration + control-rate/latency measurement | C++ vs Python performance comparison | the hardest gate for robotics software roles |

## Phase C — Fusion & flagship

| # | Dir | What you learn | Observable output | Relation to final goal |
|---|---|---|---|---|
| 12 | `12-dsh-ros-bridge` | DSH plugin calling ROS2 via rosbridge | one agent instruction → arm motion | bridges DSH ↔ ROS2 |
| 13 | `13-hotplug` | **★ capability hot-plugging + reliability design** (verification/multi-version/grayscale/rollback/event/isolation/reclaim) | add/remove end-effector tools at runtime, agent-unaware | **flagship demo; the implementation of the novelty claim** |
| 14 | `14-vision` (optional) | VLM / SAM visual localization | locate target objects visually | moves toward VLA |
| 15 | `15-imitation` (optional) | behavior cloning BC + data loop | inference-only vs trained-policy comparison | adds AI training capability |

---

## Recommended order

```
00 → 01 → 02 → 03 → 04 → 05          (Phase A: DSH mental model)
                          ↓
06 → 07 → 08 → 09 → 10 → 11          (Phase B: robotics, with DSH assistance)
                          ↓
12 → 13                              (Phase C: fusion + flagship)
                          ↓
14 / 15 (optional, after 13)
```

**Critical path (required)**: `00→…→05 → 06→…→11 → 12 → 13`.
**Optional bonuses**: `14` (vision), `15` (imitation learning).

> Note: for every robotics demo in Phase B, prefer completing it with the "AI coding + skills" learned in Phase A — this closes the loop between "learning the tool" and "using the tool" while accelerating the robotics learning.
