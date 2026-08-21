# Prior Art — related-work comparison

> Purpose: demonstrate "I know the landscape, and I differ from it." This lists the most relevant existing work and states how this project differs.

---

## Summary table

| Work | Category | Relation to this project | Difference (this project's unique anchor) |
|---|---|---|---|
| **ROS2 lifecycle / composable nodes** | ROS component lifecycle | the official robot-side "partial hot-plug" mechanism | manages node state only; no agent visibility, same-type isolation, or version grayscale/rollback |
| **AICA** | component-based reconfigurable robotics | declarative components + runtime reconfiguration | hardware/component layer; no LLM/agent orchestration layer |
| **Eclipse Muto** | dynamic ROS stack orchestration | runtime ROS component orchestration | AV deployment orchestration, not agent-layer capability hot-plugging |
| **OpenRAL** | ROS2-native agentic harness | closest (agent + ROS2) | this project's unique anchor = the specific "DSH spatiotemporal compositionality" primitive |
| **RoboNeuron** | foundation models × ROS modularity | bridges foundation models and ROS | model integration; no precise hot-plug lifecycle |
| **Nautilus** | plug-and-play robot learning | "plug-and-play" idea | focuses on prompt→robot learning, not runtime capability orchestration |
| **MCP (Model Context Protocol)** | generic tool protocol | standard for dynamic tool registration | a protocol standard; no scope/lifecycle orchestration semantics |
| **dsh-ios (DSH plugin)** | DSH hardware-hot-plug-flavored plugin | puts USB iPhone / simulator in conversation | evidence DSH can do hardware hot-plug, but not embodied-robot capability orchestration |

---

## Per-item notes & sources

### 1. ROS2 lifecycle / composable nodes
- **What**: ROS2 official managed nodes (state machine: unconfigured → inactive → active → finalized) and composable nodes (runtime component loading).
- **Difference**: manages node state; this project manages capability visibility + lifecycle — especially the "visible to the agent" layer, which ROS2 does not address.
- Source: [ROS2 docs — Managed Nodes](https://docs.ros.org/en/humble/Tutorials/Intermediate/Managed-Nodes/Managed-Nodes.html)

### 2. AICA
- **What**: a ROS2-based component-based, reconfigurable robotics framework with declarative application descriptions, component lifecycle, hardware-interface abstraction, and runtime reconfiguration.
- **Difference**: focuses on component/hardware layer; this project adds the LLM-agent decision layer + DSH spatiotemporal compositionality.
- Source: [AICA application concepts](https://docs.aica.tech/docs/concepts/aica-applications/), [AICA hardware interfaces](https://github.com/aica-technology/api/blob/8238b0784a98c4db53d77de8a39c0c78eb347974/docs/docs/concepts/05-building-blocks/05-hardware-interfaces.md)

### 3. Eclipse Muto
- **What**: dynamic ROS software stack orchestration for autonomous vehicles.
- **Difference**: deployment orchestration scenario; this project is agent-layer capability hot-plugging.
- Source: [Eclipse Muto in Action](https://www.classcentral.com/course/youtube-eclipse-muto-in-action-359949)

### 4. OpenRAL
- **What**: self-described "agentic harness for physical AI, ROS2-native."
- **Difference**: directionally closest; this project's unique anchor is the specific "DSH spatiotemporal compositionality" mechanism, not a generic agentic harness.
- Source: [OpenRAL — Open Robotics Discourse](https://discourse.openrobotics.org/t/openral-the-agentic-harness-for-physical-ai-ros-2-native/56352)

### 5. RoboNeuron
- **What**: a modular framework linking foundation models and ROS.
- **Difference**: model integration; no precise hot-plug lifecycle.
- Source: [RoboNeuron](https://www.emergentmind.com/papers/2512.10394)

### 6. Nautilus
- **What**: from "one prompt" to "plug-and-play robot learning."
- **Difference**: focuses on learning/data, not runtime capability orchestration.
- Source: [Nautilus](https://ar5iv.labs.arxiv.org/html/2605.11665)

### 7. MCP (Model Context Protocol)
- **What**: a standard protocol for connecting LLMs to external tools/data sources.
- **Difference**: a protocol standard; no scope/lifecycle orchestration semantics.
- Source: [MCP official site](https://modelcontextprotocol.io)

### 8. dsh-ios (DSH plugin)
- **What**: a DSH plugin putting a live iOS simulator + USB-connected iPhone into the conversation (21 agent tools).
- **Difference**: evidence that "DSH + hardware plug-and-play" is feasible, but not embodied-robot capability orchestration.
- Source: [dsh-ios](https://github.com/ZSeven-W/dsh-ios)

---

## DSH itself as the foundation (not prior art, the substrate)

- DSH is an "everything is a plugin" agent runtime; even the agent loop can be hot-swapped:
  - [DeepSeek Harness: "everything is a plugin" as the new agent foundation](https://developer.aliyun.com/article/1756806)
  - [DeepSeek Harness: even the loop can be hot-swapped](https://cloud.tencent.cn/developer/article/2726144)

---

## Conclusion

This project is neither "the first robot hot-plugging" nor "the first agent controlling ROS"; it is the **reproducible implementation of the specific "DSH spatiotemporal compositionality" primitive in the "robot capability hot-plugging" scenario**. The differentiation comes from the combination of mechanism × scenario × implementation, not from any single dimension.
