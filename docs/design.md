# Project design document — ros-hotplug-by-dsh

> This is the project's **single design document** (merged from the former root DESIGN, simulator-choice, and eval-baselines, and substantially expanded).
> Evidence & receipts: see [`disclosure-log.md`](disclosure-log.md) and `timestamps/` (**keep untouched**); status-quo analysis & highlights: [`novelty.md`](novelty.md); DSH mechanism deep-dive: [`spatiotemporal-compositionality.md`](spatiotemporal-compositionality.md).

---

## 1. Title & one-liner

**Embodied-robot capability hot-plugging based on DSH spatiotemporal compositionality (ros-hotplug-by-dsh)**

Using DSH's spatiotemporal compositionality as the composition primitive for robot capability hot-plugging: **layered visibility in space, precise birth/death in time**.

## 2. Abstract

- **Problem**: embodied robots need runtime add/remove/replace of capabilities (swap end-effector, add sensor, upgrade skill); existing solutions either require restarts, only manage hardware/component layers, or are decoupled from the LLM agent decision layer.
- **Method**: use DSH spatiotemporal compositionality (layered scopes + Cordis lifecycle + version timeline) as the **capability orchestration layer** on top of ROS2; each robot capability becomes a DSH plugin tool; hot-plugging = scope registration/deregistration.
- **Result**: implement and verify four indicators — **mount-and-see, unmount-and-reclaim, same-name isolation, agent-unaware** — plus reliability design (verification, multi-version, grayscale, rollback, event notification).

## 3. Motivation & background

- Real robots swap end-effectors (gripper ↔ suction), add sensors, upgrade skills between tasks; ideally without restart, downtime, or affecting other capabilities.
- Existing "reconfigurable" work mostly focuses on the hardware or ROS component layer, decoupled from upper-layer "agent decisions"; LLM/agent robot frameworks mostly focus on "single tasks", lacking precise lifecycle management for capability hot-plugging.
- Hence a set of "upper-layer capability orchestration" primitives is needed: mount = immediately usable; unmount = precise reclamation; same-name isolation; versioned grayscale/rollback.

## 4. Novelty claim (precise boundary)

### 4.1 One-sentence claim

> **The first to apply DSH spatiotemporal compositionality (layered scopes + Cordis lifecycle) to hot-plugging of embodied-robot capabilities, with a reproducible implementation and evaluation.**

### 4.2 Three components (all required)

| Component | Content |
|---|---|
| **Mechanism** | DSH layered scopes + parent-chain inheritance + nearest-wins + `isolate` realm + Cordis `dispose` + version timeline (plugin/package/run) |
| **Scenario** | embodied-robot capability hot-plugging: end-effectors (gripper ↔ suction), sensors, skills |
| **Implementation** | reproducible `demo/13-hotplug` (and the `src/` engineering), with reliability design and evaluation |

### 4.3 Explicitly not claimed

Inventing "spatiotemporal compositionality" (it is DSH's mechanism); "first robot hot-plugging" (ROS2 lifecycle nodes, AICA exist); "first agent controlling ROS" (OpenRAL exists); hardware/real-time/electrical-safety hot-plugging (this project covers the software capability layer only).

### 4.4 Verification & escalation path

- Not seen in public sources: periodic searches recorded (keywords in `novelty.md`).
- Reproducible: anyone can run `demo/13-hotplug` and reproduce the four indicators.
- Temporal priority: commit hash + timestamps + push in `disclosure-log.md`.
- Wording escalation: internal statement (now) → public blog → arXiv (drop "first", experiments decide).

## 5. Status quo & related work (summary)

Existing solutions manage either "process/node" (ROS2 lifecycle/composable), "component graph" (AICA/Muto), or "skill calls" (OpenRAL), but none binds "visible to whom now (space)", "when born, when precisely reclaimed (time)", and "how to grayscale/rollback versions" to the same anchor. The authoritative survey [Software Reconfiguration in Robotics (EMSE 2024)](https://link.springer.com/article/10.1007/s10664-024-10596-9) likewise observes that existing reconfiguration stays at the "structure/behavior" layer, lacking a link to the upper task/decision layer.

> Full argument (per-item comparison + DSH advantages + convergent table): see [`novelty.md`](novelty.md).

## 6. Core concept: DSH spatiotemporal compositionality (brief)

- **Space axis (who sees whom)**: planes (host process-level / agent preset per-session), scope parent chain (registration view inherits downward, nearest-wins shadowing, events propagate upward), `isolate` realm.
- **Time axis (who lives/dies when)**: Cordis lifecycle (apply/effect/dispose), standing mount/generation, dynamic plugin version timeline (plugin instance / immutable package / run activation attempt).
- **Anchor contract**: the registration's context determines both its visibility and lifecycle, ruling out "visible but dead / alive but invisible".

> Full mechanism: [`spatiotemporal-compositionality.md`](spatiotemporal-compositionality.md).

---

## 7. System design

### 7.1 Layered architecture

```
[task / natural-language command: "grab the ball"]
        ↓
DSH Agent (perception + strategy + decision, no low-level control)
        ↓ tool call (capability tools: grasp / suction / detect ...)  ← hot-plugging lives here
DSH capability layer (bridge contract via rosbridge)
        ↓ WebSocket ↔ ROS2 topics
ROS2 control layer (C++ high-rate control node + Python simulation bridge)
        ↓
MuJoCo simulation (two arms + end-effectors + scenes) / real robot (swap hardware_interface)
```

### 7.2 The agent's role: perception & adaptation (important correction)

- **The agent does NOT control which end-effector it has.** Mounting/swapping is done by the human / platform / ops (an external event).
- The agent's role:
  1. **Perceive**: which end-effector capabilities are currently available (tool table / capability state query / `tools/change` events);
  2. **Reason**: for the **same command** (e.g. "grab the ball", with no "use the gripper" qualifier), adaptively pick the strategy and computation — gripper present → grasp strategy; suction present → suction strategy; none → report "no end-effector, cannot grab";
  3. **Execute**: call the capability tool that is currently available.
- On a hot-plug event: the agent perceives it → updates its view → **the same command afterwards automatically switches strategy**. That is the full meaning of "agent-unaware + adaptive".

### 7.3 One complete interaction (the demo's target behavior)

1. Scene: two arms + a ball, both arms bare.
2. User: "**grab the ball**". Agent perceives: no end-effector → replies "no end-effector, cannot grab".
3. Human/platform hot-plugs: mount the gripper capability on arm A.
4. User again: "**grab the ball**". Agent perceives: gripper available → grasp strategy → calls `grasp` → arm A's tip turns red and moves to the ball (grasp).
5. Human/platform hot-plugs: swap gripper for suction (unmount grasp, mount suction).
6. User a third time: "**grab the ball**". Agent perceives: suction available → suction strategy → calls `suction` → tip turns blue and moves to the ball (suction).

> The highlight: **the same command, three different strategy choices matched to the current end-effector state**; the agent is unaware throughout, and the robot never stops.

### 7.4 Multi-agent design

- **Task agent** (main): perception + strategy + capability tool calls.
- **Observation/ops agent**: subscribes to capability add/remove events & state, reports "current capability set / hot-plug log".
- **Evaluation subagents**: delegated to run `eval/`.

### 7.5 Hot-plugging mechanism

| Operation | Mechanism | Effect |
|---|---|---|
| Mount capability | register a plugin tool in the robot scope | immediately visible/callable by the agent |
| Unmount capability | dispose the plugin | precisely reclaim its subscriptions/connections, agent-unaware |
| Replace capability | multi-version coexistence + `update` grayscale switch | old/new coexist, smooth switch |
| Same-name isolation | `isolate` realm | two gripper/suction instances don't cross-talk |
| Failure rollback | `run` (current) vs `update` (target) | auto-rollback to old version on activation failure |
| Change perception | event broadcast + agent subscription | the agent automatically perceives add/remove |

---

## 8. Reliability design (engineering practice → project)

| Engineering practice | This project's counterpart | Verification |
|---|---|---|
| Zero-trust pipeline | verify manifest/hash before mount; reject invalid | tampered manifest → rejected |
| Active/standby + multi-version | one capability, multiple coexisting versions | v1/v2 registered simultaneously without conflict |
| Grayscale upgrade + zero downtime | `update` grayscale switch, agent-unaware | task unaffected during switch |
| Second-level auto rollback | auto-rollback to previous version on failure | inject fault → auto-rollback |
| Pub/sub event notification | capability add/remove broadcasts events; agent subscribes | event received on mount/unmount |
| Hardware-difference shielding | capability abstraction; same-type shadow by name | two end-effectors shadow correctly |
| High availability / no leaks | isolate + dispose for exact cleanup | no residue after unmount |

### 8.1 Mechanism & landing per point

| # | Point | DSH mechanism | demo 13 proof |
|---|---|---|---|
| 1 | zero-trust/hash | mount guard (app) + scope registration | tampered hash → `mount_guard` rejects |
| 2 | multi-version | immutable packages coexist | v1/v2/v3 packages coexist, no overwrite |
| 3 | grayscale | `update` switch | tool name unchanged during v1→v2, agent-unaware |
| 4 | rollback | `run` vs `update` | bad v3 fails → old version still running |
| 5 | event | `tools/change` broadcast + subscription | listener receives the event |
| 6 | same-name shadowing | nearest-wins + isolate realm | two same-type capabilities don't cross-talk (composition layer) |
| 7 | no leaks | isolate + Cordis dispose | no residual RPC/subscription/state after unmount |

> Zero-trust threat model: a capability may come from **external distribution** or be **generated by the agent on the fly** (an LLM can hallucinate or be prompt-injected), and may be **tampered in storage/transit**. Hence "treat every mount as untrusted, verify before mounting": the hash proves "not modified", the signature (optional) proves "truly from someone" — i.e. the "cloud sign/encrypt → device verify/decrypt" pipeline. demo 13 ships the hash loop first.

---

## 9. Simulation platform choice

**Conclusion: stay with MuJoCo; Isaac Sim/Isaac Lab and Gazebo are "switch-when-triggered" options, not now.**

| Axis | MuJoCo | Gazebo | Isaac Sim + Isaac Lab |
|---|---|---|---|
| Physics speed/accuracy | ★★★★★ | ★★★ | ★★★★ |
| ROS2 integration | none native (own bridge/rosbridge — our selling point) | ★★★★★ gazebo_ros | ★★★ NVIDIA ecosystem |
| Sensors/rendering | RGB/depth, not photo-real | camera/lidar/IMU | photo-real |
| Learning curve | ★★★★★ | ★★ | ★ |
| Hardware (WSL2 + 6GB) | ★★★★★ CPU headless | ★★★ RAM-hungry | ★ needs recent NVIDIA |

Three reasons for MuJoCo: ① the main line is motion control (MuJoCo's strength); ② zero background needs fast observable output (inline XML + `mj_step`); ③ 6GB VRAM + WSL2 hard constraint.

**Switch triggers**: demo 14/15 (vision/imitation) → Isaac Sim + Isaac Lab; emphasizing full-stack ROS/sensors/navigation → Gazebo. Use MuJoCo Menagerie models.

---

## 10. Source engineering & deliverables

### 10.1 Directory layout

```
ros-hotplug-by-dsh/
├── src/
│   ├── capabilities/              # ★ hot-plug capabilities + end-effector configs
│   │   ├── capability-spec.md     #    capability dev spec (template + contract)
│   │   ├── mount_guard.py         #    pre-mount hash verification (zero-trust)
│   │   ├── grasp/  suction/  detect/
│   ├── presets/robo/              #    agent.cordis.yml (isolate composition) + persona + skills
│   ├── ros2/
│   │   ├── cpp_control/           #    C++ high-rate control node (1kHz, PID)
│   │   └── sim_bridge/            #    Python simulation bridge (MuJoCo + rclpy)
│   ├── bridge/
│   │   ├── contract.md            #    topic/message schema (versioned)
│   │   └── bridge_client.py       #    rosbridge client (SDK base)
│   └── sim/                       #    visualization assets
│       ├── models/                #    MJCF: arms/gripper/suction/ball
│       └── scenes/
├── eval/                          # ★ evaluation
│   ├── robot/  agent/  hotplug/  native_swap/
├── demo/  docs/  plugins/
```

### 10.2 Deliverable overview (L0~L6)

| Layer | Deliverable | Form | Purpose |
|---|---|---|---|
| L0 | public GitHub repo | repo | overall carrier + evidence chain |
| L1 | capability packages (out-of-tree) | npm packages | one capability per end-effector/sensor, installable |
| L2 | agent preset | directory | out-of-the-box robot agent config |
| L3 | robot-side packages | ROS2 colcon packages | control node + simulation bridge |
| L4 | bridge contract + SDK | doc + Python lib | external API (the only self-made API) |
| L5 | evaluation suite | eval/ scripts | one-command metrics |
| L6 | evidence & docs | docs/ | claim/comparison/baselines/receipts |

### 10.3 L1 capability packages (out-of-tree — the hot-plug carrier)

- **Packages**: `@ros-hotplug/dsh-plugin-grasp`, `-suction`, `-detect` (one per end-effector/sensor).
- **Contents**: `package.json` (`dsh` field declaring host entry + optional client entry), `src/host.js` (tool implementation), `manifest.json` (metadata+sha256), optional `client/` (panel UI), `README.md`.
- **Function**: register a capability tool (grasp/suction/detect) whose `execute` drives ROS2 via the bridge; manifest for pre-mount verification; versions for upgrade/rollback.
- **API form**: **DSH's standard Tool contract** (`{name, description, parameters(JSON Schema), output{schema,render}, execute(args)}`) — we use DSH's existing interface, no new protocol.
- **Out-of-tree vs dynamic**: demos use dynamic plugins (in-process, temporary); out-of-tree is the persistent, publishable, versioned, safety-semantic deliverable form. **Hot-plugging is DSH's mechanism; the out-of-tree package is the carrier being hot-plugged.**

### 10.4 L2 runtime carrier (agent preset)

- **Form**: a **directory** (`~/.dsh/.agent-presets/robo/`), not an npm package.
- **Contents**: `agent.cordis.yml` (composition: capability package rows + **isolate groups** + event listeners), persona ("perceive end-effector state, adapt strategy, no low-level control"), skills.
- **Function**: after install, choose "robo" when creating a session in `dsh web` → an out-of-the-box robot task agent; plus an observation agent and evaluation subagents.
- **API form**: **cordis.yml composition declarations** + persona/skill text.

### 10.5 L3 robot side (ROS2 packages)

- **Packages**: `cpp_control` (C++/rclcpp), `sim_bridge` (Python/rclpy + MuJoCo).
- **Function**: `cpp_control` = 1kHz control loop, PID, trajectory tracking, latency measurement; `sim_bridge` = subscribes bridge commands, drives MuJoCo, `--view` visualization, publishes state feedback (the production form of demo 12/13's `arm_server.py`/`two_arm_server.py`).
- **API form**: ROS2 message contract (see L4).
- **Hand-written vs existing**: teaching/eval **hand-written** (learn principles, measure precisely); for a real robot, swap in `ros2_control`/`MoveIt2` per the contract, and the sim bridge can be replaced by `mujoco_ros2_control` (maintained by ros-controls). Hand-written and ready-made don't conflict — L3's interface is left replaceable, which is the adaptability point.

### 10.6 L4 bridge contract (external API — the only self-made API)

**Layer 1: message contract (`bridge/contract.md`, versioned)**

```text
contract v1.x
  topic /tool_config        type std_msgs/String  payload "ARM:TOOL"    semantics: switch end-effector
  topic /ball_position      type std_msgs/String  payload "x,y"         semantics: set ball position
  topic /touch_command      type std_msgs/String  payload "A"|"B"       semantics: pick arm to touch ball
  topic /capability_command type std_msgs/String  payload "grasp"|"suction"  semantics: activate capability (path A)
  topic /joint_state        type ...              payload ...           semantics: state feedback
```

**Layer 2: thin Python SDK (shared by capability developers & DSH plugin hosts)**

```python
class Bridge:
    def set_tool(self, arm, tool) -> dict:      # validates arm∈{A,B}, tool∈{grasp,suction,none}; returns {ok, error}
    def set_ball(self, x, y) -> dict:           # validates numeric; returns {ok, error}
    def touch(self, arm) -> dict:
    def query_capabilities(self) -> dict:       # read current capability set from feedback
```

Design points: validation lives in the SDK (capability devs don't rewrite it); rosbridge details are hidden; every client (DSH plugin host / Python script) uses the same SDK.

### 10.7 Four principles of extensibility & adaptability

1. **Standard capability interface**: capability = tool + manifest + SDK; adding an end-effector follows the `capability-spec.md` template without touching the framework.
2. **Versioned message contract**: schema documented; both ends evolve independently.
3. **Packages decoupled from presets**: packages don't depend on presets; presets only compose.
4. **Same interface for sim & real robot**: swap only the L3 bottom (`ros2_control hardware_interface`); L1/L2/L4 untouched.

---

## 11. Evaluation method

### 11.1 Dimensions

- **Robot dimension (`eval/robot`)**: IK accuracy/success/time, three trajectory interpolation comparisons, control rate/jitter/latency — against the §11.2 public baselines.
- **AI orchestration dimension (`eval/agent`)**: agent vs script oracle vs random, success rate + steps — proving "agent adaptive orchestration matters".
- **Hot-plug dimension (`eval/hotplug`)**: the five §11.3 acceptance criteria.
- **Scenario-level comparison (`eval/native_swap`)**: same two-arm MuJoCo scene, "native ROS2 end-effector swap (stop node → edit config → restart → rewire)" vs "this project's hot-plug (mount/unmount)", measuring time and manual steps — **must be measured, never prefilled**.

### 11.2 Robot-side public baselines

| Dimension | Baseline / typical | Source |
|---|---|---|
| Control rate | 1 kHz (industrial de-facto standard) | NTNU thesis (robot loop at 1kHz) |
| Jitter/latency | µs-level jitter, <1ms per cycle | same |
| IK solving | IKFast µs-level; KDL ms-level (50~80% success); TRAC-IK 95%+; QuIK <100µs | MoveIt docs / QuIK / GeoFIK |
| IK error | analytic ~1e-12; numeric ~1e-6 | general numerics |
| Trajectory tracking | well-tuned position error <1mm order | engineering norm |
| Repeatability (real robot, reference) | industrial ±0.01~0.1mm; Franka ±0.1mm | product specs |

### 11.3 Hot-plug acceptance

| Metric | Acceptance |
|---|---|
| Mount-and-see | agent can call the new tool immediately after mount |
| Unmount-and-reclaim | no residual subscription/connection after unmount (teardown observable) |
| Same-name isolation | two same-type capabilities register without conflict, no cross-talk |
| Agent-unaware switch | task success rate unchanged during `update` |
| Failure rollback | auto-rollback after injected fault; old capability still usable |

### 11.4 To-be-measured (never prefilled)

- "Native ROS2 end-effector swap" time/steps: no public data; must be measured in our own scene.
- Agent adaptive-strategy success rate/steps: only after running `eval/agent`.

---

## 12. Limitations & future

- Only the software capability layer; hardware (electrical/connection), hard real-time, safety boundaries out of scope.
- Future: real hardware (`ros2_control hardware_interface`), cross-process/machine hot-plugging, integration with data loop / world models (demo 14/15).

## 13. Disclosure & timestamps

First public commit, FreeTSA receipts, publication links: see [`disclosure-log.md`](disclosure-log.md) (do not touch `docs/timestamps/`).

## 14. References

- Software Reconfiguration in Robotics (EMSE 2024): https://link.springer.com/article/10.1007/s10664-024-10596-9
- AICA: https://docs.aica.tech/docs/concepts/building-blocks/components/ · https://aica-technology.github.io/modulo/
- OpenRAL: https://discourse.openrobotics.org/t/openral-the-agentic-harness-for-physical-ai-ros-2-native/56352
- MuJoCo Menagerie: https://github.com/google-deepmind/mujoco_menagerie
- mujoco_ros2_control: https://github.com/ros-controls/mujoco_ros2_control
- IK baselines: MoveIt IK docs · QuIK · GeoFIK (arXiv:2503.03992)
- DSH: https://github.com/deepseek-ai/deepseek-harness
