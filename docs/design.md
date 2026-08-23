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

### 7.1 Scope hierarchy

```
layer 0  global (machine)        host-composition mounts, inherited by every agent
   ├─ sim_bridge (ROS2 process)     physical truth: arms/joints/end-effectors/ball state
   ├─ capability mount service      admission checks + arm bookkeeping + instance registry; registers no agent tools
   ├─ web panel (host + client)     the only write path (mount/unmount end-effectors)
   └─ tools registry (host service) the layer container for tool registrations

layer 1  agent (task agent)      robo preset mount (per session)
   ├─ persona                  "perceive end-effector state, decide adaptively, no low-level control, no end-effector detail"
   ├─ arm manager               pre-creates armA, armB scopes in-session, registers the arm contexts, provides arm_status/take_object
   ├─ observer                  subscribes to tools/change, reports the capability set
   ├─ arm_status tool           perception entry: is this arm ready (has a usable end-effector)
   └─ take_object tool          execution entry: have this arm take the object (strategy inside the instance)

layer 2  arms armA / armB      createScope(agentCtx, 'armA' / 'armB'), pre-created empty at session start
   └─ the arm's end-effector capability instance (mount/unmount happen on this layer)

layer 3  end-effector instance  strategy-bearing capability plugin (§10.3), mounted on an arm layer:
   ├─ armA mounts grasp  -> grasp-strategy instance (registers same-name tool `manipulate`)
   └─ armB mounts suction -> suction-strategy instance (registers same-name tool `manipulate`)
```

The hot-plugged object is the **strategy-bearing end-effector capability instance**, living and dying on an arm scope; same-name instances are isolated by scope and never cross-talk.

### 7.2 Scopes & visibility

- Layer-0 registrations are visible to every agent (global inheritance).
- Arm layers sit below the agent; **child layers do not float up** into the tool table: the agent does not see end-effector instances directly, and reaches them via `arm_status` / `take_object` (§7.5); queries resolve per arm scope (the existing `tools.get(name, armKey)` semantics).
- armA and armB are two sibling scopes: same-name `manipulate` instances are independent, never shadow each other, never cross-talk.
- Events propagate upward: arm-layer mount/unmount fire `tools/change`, which the observer at the agent layer receives.

### 7.3 capabilities admission checks (a rule table, not a scope)

| Question | Answer |
|---|---|
| **May** this end-effector be mounted (integrity / provenance) | mount_guard: host.js sha256 vs manifest; mismatch → reject |
| What is this arm **allowed** to mount | rule table in the mount service: allowed end-effector types per arm + same-arm dedup/replace rules |
| What is mounted now | per-arm records {arm, cap, version, instance handle} |
| **Where** it lands, when it lives/dies, who sees it | the scope (arm layer), not the rule table |

The table only says allow/reject and never holds instances. Order: sha256 → rule table → landing (arm-scope registration).

### 7.4 The agent's role: perception & adaptation

- The agent neither controls **which end-effector it has** nor **perceives end-effector implementation details** (gripper vs suction stays inside the instance): mounting/swapping is done by the human / platform / ops (an external event); the agent only perceives **whether an arm has a usable end-effector**.
- The agent has **no mount permission**: the only write path is the web panel (human click) → capability mount service; the agent's tool table contains no mount/unmount tools (§7.11).
- The agent's job:
  1. **Perceive**: call `arm_status(arm)` for a readiness boolean (model-agnostic);
  2. **Decide**: for the **same command** (e.g. "grab the ball", no "use the gripper" qualifier): arm ready → call `take_object(arm)`; not ready → report "no end-effector, cannot grab";
  3. **Execute**: call `take_object(arm)`; the grasp/suction strategy runs inside the current end-effector instance.
- On a hot-plug event: the agent perceives → updates its view → **the same command afterwards automatically switches strategy** (same API, new instance). That is the full meaning of "agent-unaware + adaptive".

### 7.5 Agent tool interface (end-effector details hidden)

| Tool | Semantics | Returns |
|---|---|---|
| `arm_status(arm)` | perception: is this arm ready | `{ready: true/false}`; false carries a reason (no end-effector / physical mismatch) |
| `take_object(arm)` | execution: have this arm take the object | structured result (success/failure + reason) |

- The agent's decision surface is a single `ready` boolean; its prompt carries no end-effector model knowledge. Adding an end-effector (screwdriver, welder) never changes the persona or the tool interface.
- End-effector implementation details (grasp/suction strategies) live entirely inside the instances; observability and explanation come from observer logs and sim_bridge state feedback (not from the agent's output).
- Each arm's instance registers the same tool name `manipulate`, isolated by arm scope; the agent never calls it directly — `take_object(arm)` resolves the current instance on that arm's scope and dispatches.

### 7.6 Multi-agent

- **Task agent** (main): perception + decision + `take_object` calls.
- **Observation agent**: subscribes to `tools/change` and state feedback, reports "current capability set / hot-plug log" (reliability point "event notification").
- **Evaluation subagents**: delegated to run `eval/`.

### 7.7 Initial state

**After process startup (dsh web + rosbridge + sim_bridge)**: sim_bridge has both arms straight, end-effectors none (grey), ball at home; the mount service reads the capability repo inventory and the rule table, with nothing mounted; the panel renders the inventory and two empty arm rows.

**After creating a robo session (agent initialization)**: persona/observer/arm_status/take_object are ready; the arm manager pre-creates two **empty** arm scopes (mount points in place, no instances). "grab the ball" now truthfully reports "no end-effector, cannot grab".

### 7.8 Mounting an end-effector (example: arm A gets grasp@1.0.0)

| # | Who | Does what |
|---|---|---|
| 1 | human (panel client) | clicks "arm A -> grasp@1.0.0" → host.call arm_mount{arm:A, cap:grasp, version:1.0.0} |
| 2 | panel host | validates args → forwards mount(cap, version, {arm}) to the capability mount service |
| 3 | mount service | **admission**: read repo dir → sha256 vs manifest (mismatch → reject, stop) |
| 4 | mount service | **rule table**: arm A already has cap@version → reject (same-arm dedup); has another tool → unmount first (replace); empty → allow |
| 5 | mount service | dynamic-import host.js (the strategy-bearing plugin module), ready to mount on the arm contexts |
| 6 | mount service | ctx.plugin(plugin) on the registered **armA context (scope)** → apply registers the `manipulate` instance (same name, armA layer); fiber.await confirms activation; failure → dispose & reject |
| 7 | mount service | record {armA: grasp@1.0.0, handle}; tools/change broadcast (observer updates the capability report) |
| 8 | panel host | mount ok → physical assembly set_tool(A, grasp) (sim_bridge turns arm A's tip red; physical failure only warns, never rolls back a successful registration) |
| 9 | panel client | refresh: arm A row highlights grasp@1.0.0 |
| 10 | agent | next arm_status(A) = {ready: true}; take_object(A) runs the grasp strategy |

Unmount is symmetric: panel click → mount service looks up the arm handle → fiber.dispose on the armA context (instance removed, armB unaffected) → panel set_tool(A, none) (tip resets) → refresh.

### 7.9 The grab-ball flow (example: "have arm A take the ball")

Precondition: arm A has grasp (grasp strategy), arm B has suction (suction strategy).

| # | Who | Does what |
|---|---|---|
| 1 | human (panel client) | clicks "arm A -> take the ball" → inputActions sends the message "have arm A take the ball" (the panel neither judges nor executes) |
| 2 | agent | receives the command; persona drives: perceive first → arm_status(A) |
| 3 | arm manager/observer | per-arm-scope query returns {ready: true} |
| 4 | agent | decides: arm A ready → call take_object(arm: 'A') |
| 5 | in-session dispatch | resolves the current `manipulate` instance on the armA scope → calls instance.execute() |
| 6 | instance (grasp strategy) | perceives the physical end-effector (must match, else error; never changes assembly) → runs the grasp strategy (approach/grasp/verify) → SDK → rosbridge → sim_bridge |
| 7 | sim_bridge | solves IK, arm A rotates to touch the ball, updates /joint_state feedback |
| 8 | instance | state verification (feedback confirms the tip engaged) → structured result |
| 9 | agent | reports truthfully (what it perceived / did / the result) |

**Branches**:

- Arm A bare: arm_status(A) = {ready: false} → agent reports "arm A has no end-effector, cannot take".
- Mounted but physically mismatched: instance errors at step 6 → agent reports truthfully.
- Same command after a swap: once the panel swaps A to suction, the same "have arm A take the ball" → arm_status(A) still ready → take_object(A) → the instance is now the suction strategy → the agent unknowingly switches strategy.

### 7.10 Hot-plugging mechanism

| Operation | Mechanism | Effect |
|---|---|---|
| Mount end-effector | after admission, register the instance on the **arm scope** at runtime (`ctx.plugin`) | effective immediately, **no restart** |
| Unmount end-effector | arm-layer `fiber.dispose()` (async, exact cleanup) | precisely reclaims its subscriptions/connections; the other arm is unaffected |
| Replace end-effector | unmount old instance + mount new (repo version dirs coexist) | agent-unaware; the same take_object automatically switches strategy |
| Same-name isolation | arm scopes: same-name manipulate instances coexist, each with its own lifecycle | two end-effector instances never cross-talk |
| Failure rollback | a failed new instance keeps the old handle, the old instance stays | the old end-effector keeps working |
| Change perception | event broadcast (tools/change) + agent subscription | the agent automatically perceives add/remove |

### 7.11 Write/read path separation (the human is the only writer)

```
write path (only one):  human ──click──► web panel ──RPC──► capability mount service (admission + mount/unmount on the arm contexts)
read path (agents):     task agent ──► arm_status (perceive) + take_object (execute, read-only use)
                        observation agent ──► tools/change events + state feedback (read-only subscribe, report the capability set)
```

- The capability mount service and the arm manager are **composition-mounted real plugins**, not dynamic-sandbox plugins: the dynamic sandbox ctx hides framework internals such as `ctx.plugin`/`fiber`, which mounting/unmounting needs.
- Mounting and unmounting are asynchronous: after `ctx.plugin` returns the apply has not finished; after `dispose` returns cleanup has not finished. Mount waits for `fiber.await()`; unmount awaits dispose completion.
- The agent has no mount/unmount tools = scope-level isolation, not persona persuasion.

### 7.12 One complete interaction (the demo's target behavior)

1. Scene: two arms + a ball, both arms bare.
2. User: "**grab the ball**". Agent perceives: both arm_status not ready → replies "no end-effector, cannot grab".
3. Human hot-plugs: panel mounts the grasp capability (grasp strategy instance) on arm A.
4. User again: "**grab the ball**". Agent perceives: arm A ready → calls `take_object(A)` → the instance runs the grasp strategy → arm A's tip turns red and moves to the ball (grasp).
5. Human hot-plugs: panel swaps arm A from grasp to suction (unmount old instance, mount the suction strategy instance).
6. User a third time: "**grab the ball**". Agent perceives: arm A still ready → calls `take_object(A)` again → the instance is now the suction strategy → tip turns blue and moves to the ball (suction).

> The highlight: **the same command and the same API, three results matched to the current end-effector state**; the agent is unaware throughout, the robot never stops, and the agent never learns the "gripper/suction" implementation details.

---


## 8. Reliability design (engineering practice → project)

| Engineering practice | This project's counterpart | Verification |
|---|---|---|
| Zero-trust pipeline | verify manifest/hash before mounting an end-effector; reject invalid | tampered manifest → rejected |
| Active/standby + multi-version | one end-effector capability, multiple coexisting versions (repo version dirs) | same-arm version swap, per-arm different versions, no conflict |
| Version swap + zero downtime | unmount old instance + mount new instance, agent-unaware | task unaffected during the switch |
| Second-level auto rollback | a failed new instance keeps the old handle, the old instance stays | inject fault → old end-effector keeps working |
| Pub/sub event notification | end-effector add/remove broadcasts events; agent subscribes | event received on mount/unmount |
| Hardware-difference shielding | the agent only perceives `ready`; grasp/suction strategies stay inside instances | same API auto-switches strategy after an end-effector swap |
| High availability / no leaks | arm-scope isolation + dispose for exact cleanup | no residue after unmount |

### 8.1 Mechanism & landing per point

| # | Point | DSH mechanism | Proof |
|---|---|---|---|
| 1 | zero-trust/hash | mount guard (inside the mount service) + arm-scope registration | tampered hash → rejected |
| 2 | multi-version | repo version directories coexist | arms can mount different versions, no overwrite |
| 3 | version swap | unmount old instance + mount new instance | API unchanged during the switch, agent-unaware |
| 4 | failure rollback | a failed new instance keeps the old handle | bad version fails to mount → old end-effector keeps working |
| 5 | event | `tools/change` broadcast + subscription | listener receives the event |
| 6 | same-name isolation | arm scopes: same-name manipulate instances coexist | two arms with the same end-effector never cross-talk |
| 7 | no leaks | arm scope + Cordis dispose | no residual subscription/state after unmount |

> Zero-trust threat model: a capability may come from **external distribution** or be **generated by the agent on the fly** (an LLM can hallucinate or be prompt-injected), and may be **tampered in storage/transit**. Hence "treat every mount as untrusted, verify before mounting": the hash proves "not modified", the signature (optional) proves "truly from someone" — i.e. the "cloud sign/encrypt → device verify/decrypt" pipeline. The project ships the hash loop first.

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
│   ├── capabilities/              # ★ capability repo + mount service + spec
│   │   ├── capability-spec.md     #    capability dev spec (template + manifest + mount flow)
│   │   ├── mount_guard.py         #    pre-mount hash verification (zero-trust)
│   │   ├── mount_service/         #    capability mount service (host-resident: admission + arm bookkeeping; web panel included)
│   │   ├── repo/                  #    capability repo directory (first-class deliverable): grasp/1.0.0/{host.js, manifest.json} ...
│   │   └── pack.sh                #    optional distribution shell: repo dir → npm tarball
│   ├── presets/                   #    runtime carrier
│   │   └── robo/                  #    agent.cordis.yml (persona + observer + arm manager + arm_status/take_object + skills)
│   ├── ros2/                      #    robot side (colcon packages)
│   │   ├── cpp_control/           #    C++ high-rate control node (1kHz, PID)
│   │   └── sim_bridge/            #    Python simulation bridge (MuJoCo + rclpy)
│   ├── bridge/                    #    bridge contract
│   │   ├── contract.md            #    topic/message schema (versioned)
│   │   └── bridge_client.py       #    rosbridge client (SDK base)
│   └── sim/                       #    visualization assets
│       ├── models/                #    MJCF: arms/gripper/suction/ball
│       └── scenes/                #    preset scenes
├── eval/                          # ★ evaluation
│   ├── robot/  agent/  hotplug/
│   └── native_swap/               #   native ROS2 end-effector swap measurement (to-be-measured experiment)
├── demo/                          #   teaching (00~13, the evidence chain)
├── docs/                          #   this design doc + highlights + mechanism + receipts
└── plugins/                       #   dynamic plugin archive (workflow helpers)
```

### 10.2 Deliverable overview (L0~L6)

| Layer | Deliverable | Form | Purpose |
|---|---|---|---|
| L0 | public GitHub repo | repo | overall carrier + evidence chain |
| L1 | capability (repo directory + mount system) | directory + resident plugin | one strategy-bearing instance per end-effector, runtime mount/unmount (the hot-plug body) |
| L2 | agent preset | directory | out-of-the-box robot agent config (perceives and executes only) |
| L3 | robot-side packages | ROS2 colcon packages | control node + simulation bridge |
| L4 | bridge contract + SDK | doc + Python lib | external API (the only self-made API) |
| L5 | evaluation suite | eval/ scripts | one-command metrics |
| L6 | evidence & docs | docs/ | claim/comparison/baselines/receipts |

### 10.3 L1 capability & mount system (the hot-plug body)

- **First-class deliverable = the capability repo directory**: `repo/<capability>/<version>/{host.js, manifest.json}`. host.js is a zero-dependency ESM `{apply, inject, name}` plugin; manifest.json records metadata + host.js sha256.
- **Capability = a strategy-bearing end-effector instance**: each capability is the complete unit of "end-effector hardware + driving strategy" (grasp = grasp strategy, suction = suction strategy). Its apply registers the same-name `manipulate` tool **on an arm scope**; execute implements the strategy (perceive physical match → run strategy steps → state verification) and **never changes assembly**.
- **npm out-of-tree = optional distribution shell**: `pack.sh` turns a repo directory into a tarball; installing unpacks it into the repo and follows the same mount flow (install ≠ mount).
- **Capability mount service (mount_service)**: host-resident plugin (composition-mounted, not a dynamic sandbox). Duties = **admission checks** (mount_guard hash + rule table: allowed end-effector types / same-arm dedup / replace) + **arm bookkeeping** (per-arm {arm, cap, version}); the actual `ctx.plugin`/`fiber.dispose` runs on the armA/armB contexts (scopes) registered by the in-session arm manager (§7.1). Write path = web panel RPC; **registers no agent tools**.
- **API form**: DSH's standard Tool contract; hot-plugging is DSH's runtime mount mechanism (ctx.plugin/dispose), and the repo directory is the carrier being hot-plugged.

### 10.4 L2 runtime carrier (agent preset)

- **Form**: a **directory** (`~/.dsh/.agent-presets/robo/`), not an npm package.
- **Contents**: `agent.cordis.yml` (composition: persona row + observer row + **arm-manager row** (pre-creates armA/armB scopes in-session and registers the arm contexts) + arm_status/take_object tool rows + skills mounting; **no capability rows** — assembly belongs to the mount system, the preset only perceives and executes), persona ("perceive end-effector state, decide adaptively, no low-level control, no end-effector detail"), skills.
- **Function**: after install, choose "robo" when creating a session → an out-of-the-box robot task agent; the observer subscribes to `tools/change` and reports the capability set.
- **API form**: cordis.yml composition declarations (plugin rows/scopes) + persona/skill text.

### 10.5 L3 robot side (ROS2 packages)

- **Packages**: `cpp_control` (C++/rclcpp), `sim_bridge` (Python/rclpy + MuJoCo).
- **Function**: `cpp_control` = 1kHz control loop, PID, trajectory tracking, latency measurement; `sim_bridge` = subscribes bridge commands, drives MuJoCo, `--view` visualization, publishes state feedback (the production form of demo 12/13's `arm_server.py`/`two_arm_server.py`).
- **API form**: ROS2 message contract (see L4).
- **Hand-written vs existing**: teaching/eval **hand-written** (learn principles, measure precisely); for a real robot, swap in `ros2_control`/`MoveIt2` per the contract, and the sim bridge can be replaced by `mujoco_ros2_control` (maintained by ros-controls). Hand-written and ready-made don't conflict — L3's interface is left replaceable, which is the adaptability point.

### 10.6 L4 bridge contract (external API — the only self-made API)

**Layer 1: message contract (`bridge/contract.md`, versioned)**

```text
contract v1.x (full definition in bridge/contract.md)
  topic /tool_config    type std_msgs/String  payload "ARM:TOOL"   semantics: switch end-effector
  topic /ball_position  type std_msgs/String  payload "x,y"        semantics: set ball position
  topic /touch_command  type std_msgs/String  payload "A"|"B"      semantics: pick arm to touch ball
  topic /reset_command  type std_msgs/String  payload "reset"      semantics: reset everything
  topic /joint_state    type std_msgs/String  payload JSON          semantics: state feedback
```

**Layer 2: thin Python SDK (shared by capability instances & DSH plugin hosts)**

```python
class Bridge:
    def set_tool(self, arm, tool) -> dict:      # validates arm∈{A,B}, tool∈{grasp,suction,none}; returns {ok, error}
    def set_ball(self, x, y) -> dict:           # validates numeric; returns {ok, error}
    def touch(self, arm) -> dict:
    def reset(self) -> dict:                    # reset everything
    def query_capabilities(self) -> dict:       # read current state from feedback
```

Design points: validation lives in the SDK (capability devs don't rewrite it); rosbridge details are hidden; every client (DSH plugin host / Python script) uses the same SDK.

### 10.7 Four principles of extensibility & adaptability

1. **Standard capability interface**: capability = strategy-bearing instance + manifest; the agent only sees arm_status/take_object; adding an end-effector follows the `capability-spec.md` template without touching the framework or the agent interface.
2. **Versioned message contract**: schema documented; both ends evolve independently.
3. **Capabilities decoupled from presets**: capabilities don't depend on presets (presets neither assemble nor perceive end-effector models, only `ready`); presets don't depend on specific capabilities.
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
| Mount-and-see | the agent immediately perceives ready and can act after mount (no restart) |
| Unmount-and-reclaim | no residual subscription/connection after unmount (teardown observable) |
| Same-name isolation | two arms mounting the same end-effector register without conflict, no cross-talk |
| Agent-unaware switch | end-effector/version swap keeps the same API, strategy switches automatically, task success rate unchanged |
| Failure rollback | a failed new instance leaves the old end-effector usable |


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
