# Status-quo analysis & project highlights

> Purpose: analyze the limitations of existing robot hot-plugging methods (with papers/source/architecture evidence), and state this project's highlights and claim boundary. Merged from the former `hotplug-methods`, `prior-art`, and `novelty-claim`.

---

## 1. Status quo: limitations of existing hot-plugging methods

### 1.1 ROS2 lifecycle / composable nodes (official, but thinnest)

- **Mechanism**: `LifecycleNode` is a state machine (`unconfigured → inactive → active → finalized`) managing a node's start/stop; composable nodes can be load/unloaded in a runtime container.
- **Limits**: granularity is "process/node", not "capability"; no "visibility to the upper layer" semantics; no same-type isolation; no version semantics (grayscale/rollback all hand-written).
- Sources: [ROS2 lifecycle & composition](https://panav.gitbook.io/robotics-handbook/ros-2/lifecycle-and-composition), [What are lifecycle/composable nodes for](https://robotics.stackexchange.com/questions/115208/what-are-lifecycle-nodes-and-composable-nodes-for).

### 1.2 AICA (component-based reconfigurable framework, industry representative)

- **Mechanism**: declarative applications (YAML) + component lifecycle + runtime reconfiguration; `Modulo` is a C++ component runtime underneath.
- **Limits**: reconfiguration happens at the "component/application graph" layer, hardware/component-leaning, with no LLM/agent decision layer; its dynamism is graph re-parse/assembly, not "mounting a capability tool into a scope precisely and making the agent perceive it immediately".
- Sources: [AICA Components](https://docs.aica.tech/docs/concepts/building-blocks/components/), [Modulo](https://aica-technology.github.io/modulo/).

### 1.3 OpenRAL (closest; named honestly)

- **Mechanism**: a ROS2-native agentic harness wrapping ROS2 capabilities as **rskill**s exposed to an LLM agent as tool calls.
- **Limits**: it solves "let the agent call ROS2", but offers a skill library + call protocol, **not DSH's "layered scopes + isolate realm + Cordis dispose" composition primitive** — overlapping on "tool-ification", but lacking the anchor of "spatial visibility + precise temporal teardown + version timeline".
- Source: [OpenRAL — agentic harness for physical AI](https://discourse.openrobotics.org/t/openral-the-agentic-harness-for-physical-ai-ros-2-native/56352).

### 1.4 Generic software hot-plugging (cross-domain, wrong granularity)

- K8s grayscale/canary/blue-green, OSGi, dlopen/pluginlib, Erlang hot code reload: granularity is "service/process/class", with no "capability visible to the agent" semantics, and tightly coupled to deployment systems.

### 1.5 The academic survey's verdict

[Software Reconfiguration in Robotics (EMSE 2024)](https://link.springer.com/article/10.1007/s10664-024-10596-9) systematically organizes the major families (dynamic software product lines, model-based, component-based, …) and points to a shared gap: **reconfiguration mostly stays at the "structure/behavior" layer, lacking a link to the upper task/decision layer, and lacking unified runtime safety and consistency guarantees**.

> In one sentence: existing solutions manage either "process/node", "component graph", or "skill call", but none binds "visible to whom now (space)", "when born, when precisely reclaimed (time)", and "how to grayscale/rollback versions" to the same anchor.

---

## 2. Related-work comparison table

| Work | Category | Relation to this project | Difference (this project's unique anchor) |
|---|---|---|---|
| ROS2 lifecycle/composable nodes | ROS component lifecycle | official robot-side "partial hot-plug" | manages node state only; no agent visibility, same-type isolation, grayscale/rollback |
| AICA | component-based reconfigurable robotics | declarative components + runtime reconfiguration | hardware/component layer; no LLM/agent orchestration layer |
| Eclipse Muto | dynamic ROS stack orchestration | runtime ROS component orchestration | AV deployment orchestration, not agent-layer capability hot-plugging |
| OpenRAL | ROS2-native agentic harness | closest (agent + ROS2) | this project's unique anchor = the specific "DSH spatiotemporal compositionality" primitive |
| RoboNeuron | foundation models × ROS modularity | bridges foundation models and ROS | model integration; no precise hot-plug lifecycle |
| Nautilus | plug-and-play robot learning | "plug-and-play" idea | focuses on prompt→robot learning, not runtime capability orchestration |
| MCP | generic tool protocol | standard for dynamic tool registration | a protocol standard; no scope/lifecycle orchestration semantics |
| dsh-ios | DSH hardware-hot-plug-flavored plugin | puts USB iPhone / simulator in conversation | evidence DSH can do hardware hot-plug, but not embodied-robot capability orchestration |

---

## 3. Project highlights: DSH spatiotemporal compositionality × capability hot-plugging (source/architecture evidence)

### 3.1 Space axis: scopes + isolate realm (who sees whom)

- End-effector capability instances sit on per-arm scopes below the agent (global → agent → arm → instance); the agent perceives only a `ready` boolean and executes through `take_object`, while the grasp/suction strategies live inside the instances; sibling arm scopes let same-name instances coexist without cross-talk.
- **Advantage**: mounting = immediately effective and agent-visible; same-name end-effectors never conflict. Other solutions lack this primitive.

### 3.2 Time axis: Cordis lifecycle (who lives and dies when)

- A plugin's `apply(ctx)` hangs every side effect on the current Fiber, with disposers returned by `ctx.on`/`ctx.effect`; stop/update/remove tears them down in order.
- **Advantage**: unmount = precise reclamation of connections/subscriptions/state. ROS2 lifecycle nodes give only a state machine, not guaranteed reclamation.

### 3.3 Version timeline: repo versions + mount handles (swap + rollback)

- The capability repo stores immutable code under version directories; the mount system holds per-arm handles: swap = unmount old + mount new (a failed new instance keeps the old handle = rollback).
- **Advantage**: multi-version coexistence + version swap + rollback are built-in, not hand-written. (Grayscale traffic-splitting is not part of the demo scope.)

### 3.4 Anchor contract: visibility = lifecycle (the core difference)

- DSH's core invariant: **the registration's context determines both its visibility and its lifecycle**, ruling out "visible but already dead / alive but invisible". Other solutions need application-level conventions; DSH guarantees it at the mechanism level.

### 3.5 Homogeneous with the agent decision layer

- DSH is itself an agent framework (the tool table is scoped + dynamic), so hot-plugging happens at the "agent's capability tool" layer, directly meeting "agent-unaware switch"; capability add/remove broadcasts events (`tools/change`), which the agent subscribes to.

> Full mechanism: [`spatiotemporal-compositionality.md`](spatiotemporal-compositionality.md).

---

## 4. Convergent comparison table

| Solution | Layer it manages | Scope visibility | Precise reclamation | Version rollback | Aligns with agent |
|---|---|---|---|---|---|
| ROS2 lifecycle / composable | process/node | ✗ | ✗ (self-discipline) | ✗ (hand-written) | ✗ |
| AICA | component graph | ✗ | partial | ✗ | ✗ |
| OpenRAL | skill call | ✗ | ✗ | ✗ | ✓ |
| **DSH spatiotemporal compositionality** | **capability tool** | **✓ isolate / nearest-wins** | **✓ dispose** | **✓ package / run** | **✓** |

---

## 5. Claim boundary

### 5.1 One-sentence claim

> **The first to apply DSH spatiotemporal compositionality (layered scopes + Cordis lifecycle) to hot-plugging of embodied-robot capabilities, with a reproducible implementation and evaluation.**

### 5.2 Three components (all required)

| Component | Content |
|---|---|
| Mechanism | DSH layered scopes + nearest-wins + isolate realm + Cordis dispose + version timeline |
| Scenario | embodied-robot capability hot-plugging (end-effectors / sensors / skills) |
| Implementation | reproducible `demo/13-hotplug` + source engineering + evaluation |

### 5.3 Explicitly not claimed

Not inventing "spatiotemporal compositionality" (DSH's mechanism); not "first robot hot-plugging" (ROS2/AICA exist); not "first agent controlling ROS" (OpenRAL exists); not hardware/real-time/electrical-safety hot-plugging.

### 5.4 Verification & escalation path

- Not seen in public sources: periodic searches recorded (keywords: `DSH 时空组合性 机器人 热插拔`, `DSH spatiotemporal hot-plug robot`, `DeepSeek Harness robotics hot-plug`, `Cordis scope robot reconfiguration`).
- Reproducible: run `demo/13-hotplug` and reproduce the four indicators.
- Temporal priority: commit hash + timestamps + push in `disclosure-log.md`.
- Wording escalation: internal statement (now) → public blog → arXiv (drop "first", experiments decide).

## 6. DSH itself as the foundation (substrate, not prior art)

- DSH is an "everything is a plugin" agent runtime; even the agent loop can be hot-swapped:
  - [DeepSeek Harness: "everything is a plugin" as the new agent foundation](https://developer.aliyun.com/article/1756806)
  - [DeepSeek Harness: even the loop can be hot-swapped](https://cloud.tencent.cn/developer/article/2726144)
