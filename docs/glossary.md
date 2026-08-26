# Glossary — terms, features & concepts

> Central quick-reference for the terms, features, and concepts used in this project (extracted from `spatiotemporal-compositionality`, `README`, and the design discussions). Columns: "term / one-line meaning / where it lands in the project".

---

## 1. DSH / Cordis core concepts

| Term | One-line meaning | Project implementation point |
|---|---|---|
| spatiotemporal compositionality | space (who sees whom) + time (who lives/dies when) + anchor contract | the core of the novelty claim |
| plugin / plugin row | in DSH "everything is a plugin"; capabilities are declared as rows in a composition | a capability = one plugin row |
| composition / cordis.yml | the file declaring plugin rows, defining what an agent/preset looks like | the production preset's `agent.cordis.yml` |
| scope / layer | where capabilities sit: global → preset standing → agent → arm layer | end-effector instances mount on arm scopes, sensors on the perception slot; tool visibility inherits down the parent chain |
| parent-chain inheritance | the registration view inherits downward | the agent sees preset capabilities |
| nearest-wins (shadowing) | same-name: the nearest registration wins (a DSH mechanism) | this project isolates same-name instances by arm scope |
| isolate realm | one private instance per mounted session; same-type services don't clash (a DSH mechanism) | this project isolates same-type instances by arm scope |
| events propagate upward | ancestor listeners hear descendant events, never the reverse | the observation agent subscribes to add/remove events |
| apply / effect / dispose | Cordis lifecycle: register → attach effects → precisely undo | unmount = dispose reclaims exactly |
| Fiber | where a plugin's side effects hang; lives with the plugin | `ctx.on`/`ctx.effect` attach to the current Fiber |
| anchor contract | the registration's context determines both visibility and lifecycle | rules out "visible but dead / alive but invisible" |
| dynamic plugin | in-process temporary plugin (`cordis_define/run/update/stop/undefine`), gone on restart; the sandbox ctx hides framework internals (e.g. `ctx.plugin`) | demo capability tools, workflow panels, ad-hoc probes |
| plugin / package / run | the dynamic-plugin version timeline: instance / immutable code version / activation attempt | the production form uses capability version dirs + mount handles for swap/rollback |
| out-of-tree plugin | persistent, publishable npm plugin package (`dsh plugin add`); in this project only a distribution shell for capability dirs | public distribution; unpacked into the capability repo, then the mount flow |
| capability repo directory | the first-class deliverable of a capability: `repo/<cap>/<version>/{host.js, manifest.json}`, zero-dependency | `src/capabilities/repo/` |
| capability mount service | host-resident plugin: admission checks (sha256 + kind routing) + arm/slot context bookkeeping + ctx.plugin/dispose on the contexts; the only write path = web panel RPC; **registers no agent tools** | `src/capabilities/mount_service/` |
| arm scope | one sub-scope per arm (createScope(armManagerCtx, armKey, {parent: session agent scope}), one set per session): end-effector instances mount here, same-name instances never cross-talk | the hot-plug space anchor |
| arm manager | in-session plugin: builds the arm scopes and the perception slot for every session and registers the contexts (event-driven + lazy rebuild); provides arm_status/take_object | `src/presets/robo` |
| arm_status / take_object | the agent's two tools: perceive whether an arm is ready / have the arm take the object (strategy inside the instance) | hardware-difference shielding |
| profile / preset | profile = app-level boot config; preset = agent-level composition (a directory) | the `robo` preset = out-of-the-box robot agent |
| tool | an agent-callable capability; contract = name/description/parameters/output/execute | agent tools arm_status/take_object; end-effector instances register same-name manipulate |
| host / client halves | a plugin's in-process (Node) and browser halves | the web panel plugin's two halves |
| Slots | seats for injecting UI into the web GUI (e.g. `conversation.input.dock`) | mounting points of the web panels |
| Client↔Host RPC | client calls host via `host.call` on methods registered by `harness.handle` | this project's panel client calls the host's /cap-mount routes via same-origin fetch |
| Inspect providers | query runtime interfaces before writing a plugin (`cordis_inspect_list/query/self`) | runtime-first, no hardcoding |
| tools/change event | broadcast when a tool is registered/unregistered | the "event notification" reliability point |

## 2. Hot-plugging & reliability terms

| Term | One-line meaning | Project implementation point |
|---|---|---|
| capability / capability instance | the complete unit of end-effector hardware + driving strategy (grasp = grasp strategy, suction = suction strategy) | strategy-bearing instances on arm scopes |
| mount / unmount | the mount service registers/deregisters a capability instance on the arm contexts (scopes) at runtime (`ctx.plugin` / `fiber.dispose`) | mount service + arm manager |
| manifest | capability metadata + code hash | used by the pre-mount check |
| mount guard | the gate that verifies the hash before mounting (zero-trust) | `src/capabilities/mount_service/host.js` (inline sha256 in `loadPlugin`) |
| zero-trust / hash check | treat every mount as untrusted; verify before mounting | tampered manifest → rejected |
| multi-version coexistence | several version directories of one capability coexist | arms can mount different versions |
| version swap | unmount old instance + mount new; arm_status/take_object semantics unchanged, agent-unaware | arm-scope unmount + mount |
| rollback | the mount service auto-restores the old instance on a failed swap | injected bad version → old end-effector restored |
| event notification | capability add/remove broadcasts; the agent subscribes | observation agent + `tools/change` |
| same-name isolation / hardware-difference shielding | same-name instances of same-type capabilities are isolated by arm scope, no cross-talk | two gripper instances |
| no leaks | arm scope + Cordis dispose reclaim exactly | no residue after unmount |
| mount-and-see / unmount-and-reclaim / same-name isolation / agent-unaware switch / failure rollback | the five acceptance indicators | eval hotplug dimension |

## 3. Robotics / simulation / control terms

| Term | One-line meaning | Project implementation point |
|---|---|---|
| ROS2 / rclpy / rclcpp | the robot middleware and its Python/C++ client libraries | demo 10/11 |
| node / topic / service / action / TF | the five elements of the ROS2 computation graph | demo 10 |
| latched topic | the middleware keeps the last message; late subscribers still receive it | static TF broadcast |
| rosbridge / roslibpy | ROS2's WebSocket bridge and its Python client | demo 12/13 bridge layer |
| MuJoCo model/data/mj_step | static model / runtime data / stepping | all simulation demos |
| MJCF / mocap / Menagerie | scene format / runtime-positioned body / official model zoo | scenes and ready-made Franka |
| rotation matrix / Euler / quaternion / axis-angle | four spellings of orientation (equivalent) | demo 07 |
| homogeneous transform (SE(3)) | rotation+translation combined into one 4×4 | demo 07 |
| DH parameters | four parameters (a/α/d/θ) per joint | demo 08 |
| FK / IK | joint angles→tip / tip→joint angles | demo 08 |
| Jacobian | maps joint velocity to tip velocity; inverts error into correction | demo 08 numeric IK |
| velocity-level IK | one step turning position error into joint velocity | demo 08/12 tracking |
| trapezoid trajectory / Cartesian line / SLERP | three trajectory interpolations | demo 09 |
| PID (P/I/D) | proportional/integral/derivative closed-loop control | demo 09/11 |
| 1kHz control loop | the de-facto industrial arm control rate | demo 11 baseline |
| jitter / latency | loop-interval variance / per-cycle compute time | demo 11 measurement |
| repeatability | real-robot return-to-point deviation (industrial ±0.01~0.1mm) | eval reference |

## 4. Architecture & deliverable terms

| Term | One-line meaning | Project implementation point |
|---|---|---|
| L0~L6 deliverables | repo / capability (repo + mount system) / preset / robot packages / bridge contract / eval / docs | design doc §10 |
| capability (repo dir) | one end-effector/sensor = one capability dir (host.js + manifest + version); the npm package is an optional distribution shell | `src/capabilities/repo/*` |
| capability mount service | host-resident plugin: manifest checks + runtime mount/unmount; the only write path (web panel) | `src/capabilities/mount_service` |
| agent preset (robo) | out-of-the-box robot agent config directory (composition+persona+skills, **no capability rows**) | `src/presets/robo` |
| simulation bridge (sim_bridge) | robot-side Python package: subscribes bridge commands, drives MuJoCo, visualizes, feeds back | `src/ros2/sim_bridge` |
| control node (cpp_control) | robot-side C++ package: 1kHz scalar PID + rate/jitter/compute-time measurement | `src/ros2/cpp_control` |
| bridge contract | the schema doc for topics/messages (current version v1.2) | `src/bridge/contract.md` |
| SDK (thin wrapper) | shared Python functional API for capability devs & plugin hosts (validation built in) | `src/bridge/bridge_client.py` |
| capability dev spec | adding a capability = writing a dir per the template + manifest; no framework changes | `src/capabilities/capability-spec.md` |
| three eval dimensions | robot / agent / hotplug | `eval/` |
| public baselines | verifiable figures: 1kHz, IK solver magnitudes, <1mm tracking | design doc §11.2 |
| agent perception & adaptation | the agent doesn't control its end-effector; it perceives the state and adapts strategy to the same command | design doc §7.4 |

## 5. agent / LLM terms (brief)

ReAct loop, CoT / reasoning_content, reasoning passback rule, token accounting & optimization, token-meter, compaction, agent creation, subagent delegation, goal loop, plan mode, multi-model routing, headless mode, permission/approval/sandbox, retry policy, MCP client, client plugin/slots — see `demo/README.zh.md`.
