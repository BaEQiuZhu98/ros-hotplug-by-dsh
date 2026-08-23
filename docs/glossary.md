# Glossary — terms, features & concepts

> Central quick-reference for the terms, features, and concepts used in this project (extracted from `spatiotemporal-compositionality`, `README`, and the design discussions). Columns: "term / one-line meaning / where it lands in the project".

---

## 1. DSH / Cordis core concepts

| Term | One-line meaning | Project implementation point |
|---|---|---|
| spatiotemporal compositionality | space (who sees whom) + time (who lives/dies when) + anchor contract | the core of the novelty claim |
| plugin / plugin row | in DSH "everything is a plugin"; capabilities are declared as rows in a composition | a capability = one plugin row |
| composition / cordis.yml | the file declaring plugin rows, defining what an agent/preset looks like | the production preset's `agent.cordis.yml` |
| scope / layer | where capabilities sit: global → agent → arm → end-effector instance | arm scopes hold end-effector instances |
| parent-chain inheritance | the registration view inherits downward | the agent sees preset capabilities |
| nearest-wins (shadowing) | same-name: the nearest registration wins | same-type end-effectors shadow by name |
| isolate realm | one private instance per mounted session; same-type services don't clash | two gripper/suction instances don't cross-talk |
| events propagate upward | ancestor listeners hear descendant events, never the reverse | the observation agent subscribes to add/remove events |
| apply / effect / dispose | Cordis lifecycle: register → attach effects → precisely undo | unmount = dispose reclaims exactly |
| Fiber | where a plugin's side effects hang; lives with the plugin | `ctx.on`/`ctx.effect` attach to the current Fiber |
| anchor contract | the registration's context determines both visibility and lifecycle | rules out "visible but dead / alive but invisible" |
| dynamic plugin | in-process temporary plugin (`cordis_define/run/update/stop/undefine`), gone on restart | demo capability tools & workflow panels |
| plugin / package / run | version timeline: instance / immutable code version / activation attempt | multi-version, version swap, rollback |
| out-of-tree plugin | persistent, publishable npm plugin package | an optional distribution shell for capability repo directories |
| profile / preset | profile = app-level boot config; preset = agent-level composition (a directory) | the `robo` preset = out-of-the-box robot agent |
| tool | an agent-callable capability; contract = name/description/parameters/output/execute | agent tools arm_status/take_object; end-effector instances register same-name manipulate |
| host / client halves | a plugin's in-process (Node) and browser halves | the web panel plugin's two halves |
| Slots | seats for injecting UI into the web GUI (e.g. `conversation.input.dock`) | mounting points of the web panels |
| Client↔Host RPC | client calls host via `host.call` on methods registered by `harness.handle` | panel button → host runs the bridge script |
| Inspect providers | query runtime interfaces before writing a plugin (`cordis_inspect_list/query/self`) | runtime-first, no hardcoding |
| tools/change event | broadcast when a tool is registered/unregistered | the "event notification" reliability point |

## 2. Hot-plugging & reliability terms

| Term | One-line meaning | Project implementation point |
|---|---|---|
| capability / capability instance | the complete unit of end-effector hardware + driving strategy (grasp = grasp strategy, suction = suction strategy) | strategy-bearing instances on arm scopes |
| arm scope | one sub-scope per arm (createScope(agentCtx, 'armA'/'armB')): end-effector instances mount here, same-name instances never cross-talk | the hot-plug space anchor |
| arm manager | in-session plugin: pre-creates the two arm scopes, registers the arm contexts; provides arm_status/take_object | `src/presets/robo` |
| arm_status / take_object | the agent's two tools: perceive whether an arm is ready / have the arm take the object (strategy inside the instance) | hardware-difference shielding |
| mount / unmount | the mount service registers/deregisters a capability instance on an arm context (scope) at runtime (`ctx.plugin` / `fiber.dispose`) | mount service + arm manager |
| manifest | capability metadata + code hash | used by the pre-mount check |
| mount guard | the gate that verifies the hash before mounting (zero-trust) | `src/capabilities/mount_guard.py` |
| zero-trust / hash check | treat every mount as untrusted; verify before mounting | tampered manifest → rejected |
| signature (extension) | prove "truly from someone" = encrypt the hash | the "cloud sign/encrypt → device verify/decrypt" bonus |
| multi-version coexistence (active/standby) | several version directories of one capability coexist | arms can mount different versions |
| version swap | unmount old instance + mount new; arm_status/take_object semantics unchanged, agent-unaware | arm-scope unmount + mount |
| rollback | return to the previous version on failure | inject a bad version → `run` rolls back |
| event notification | capability add/remove broadcasts; the agent subscribes | observation agent + `tools/change` |
| same-name shadowing / hardware-difference shielding | same-type capabilities shadow by name, no cross-talk | two gripper instances |
| no leaks | isolate + dispose reclaim exactly | no residue after unmount |
| mount-and-see / unmount-and-reclaim / same-name isolation / agent-unaware | the four acceptance indicators | eval hotplug dimension |

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
| capability package (out-of-tree) | one end-effector/sensor = one installable npm package (tool+manifest+version) | `src/capabilities/*` |
| agent preset (robo) | out-of-the-box robot agent config directory (composition+persona+skill) | `src/presets/robo` |
| simulation bridge (sim_bridge) | robot-side Python package: subscribes bridge commands, drives MuJoCo, visualizes, feeds back | `src/ros2/sim_bridge` |
| control node (cpp_control) | robot-side C++ package: 1kHz loop / PID / latency measurement | `src/ros2/cpp_control` |
| bridge contract | versioned schema doc for topics/messages | `src/bridge/contract.md` |
| SDK (thin wrapper) | shared Python functional API for capability devs & plugin hosts (validation built in) | `src/bridge/bridge_client.py` |
| capability dev spec | adding a capability = writing a package per the template + manifest; no framework changes | `src/capabilities/capability-spec.md` |
| four eval dimensions | robot / agent / hotplug / native_swap | `eval/` |
| public baselines | verifiable figures: 1kHz, IK solver magnitudes, <1mm tracking | design doc §11.2 |
| agent perception & adaptation | the agent doesn't control its end-effector; it perceives the state and adapts strategy to the same command | design doc §7.2 |

## 5. agent / LLM terms (brief)

ReAct loop, CoT / reasoning_content, reasoning passback rule, token accounting & optimization, token-meter, compaction, agent creation, subagent delegation, goal loop, plan mode, multi-model routing, headless mode, permission/approval/sandbox, retry policy, MCP client, client plugin/slots — see the knowledge quick-reference in `demo/README.zh.md` (including the easily-confused pairs).
