# Prior Art — 近邻工作对比

> 目的：证明「我知道现状、我区别于现状」。本文列出与本项目最相关的既有工作，并说明本项目与它们的区别。

---

## 对比总表

| 工作 | 类别 | 与本项目的关系 | 区别（本项目的独特锚点） |
|---|---|---|---|
| **ROS2 生命周期节点 / 可组合节点** | ROS 组件生命周期 | 机器人侧「局部热插拔」的官方机制 | 只管理节点状态机，不解决「agent 可见性、同型能力隔离、版本灰度/回滚」 |
| **AICA** | 组件化可重构机器人框架 | 声明式组件 + 运行时重配 | 偏硬件/组件层，不含 LLM/agent 编排层 |
| **Eclipse Muto** | 动态 ROS 软件栈编排 | 运行时编排 ROS 组件 | 偏无人车部署编排，非「agent 决策层的能力热插拔」 |
| **OpenRAL** | ROS2 原生 agentic harness | 与本文最接近（agent + ROS2） | 本文独特锚点 = 「DSH 时空组合性」这套具体组合原语 |
| **RoboNeuron** | 基础模型 × ROS 模块化框架 | 连接基础模型与 ROS | 偏模型接入，未强调热插拔的精确生命周期 |
| **Nautilus** | plug-and-play 机器人学习 | 「即插即用」思路 | 聚焦「从提示到机器人学习」，非运行时能力编排 |
| **MCP（Model Context Protocol）** | 通用工具协议 | 动态注册工具的标准 | 是协议标准，不含作用域/生命周期编排语义 |
| **dsh-ios（DSH 插件）** | DSH 硬件热插拔味插件 | 把 USB iPhone/模拟器放进对话 | 佐证 DSH 能做硬件热插拔，但非具身机器人能力编排 |

---

## 逐项说明与来源

### 1. ROS2 生命周期节点 / 可组合节点
- **是什么**：ROS2 官方的 managed nodes（状态机：unconfigured → inactive → active → finalized）与 composable nodes（运行时加载组件）。
- **与本项目的区别**：它管理「节点状态」，本项目管理「能力的可见性与生命周期」——尤其是「对 agent 可见」这一层，ROS2 本身不关心。
- 来源：[ROS2 官方文档 — Managed Nodes](https://docs.ros.org/en/humble/Tutorials/Intermediate/Managed-Nodes/Managed-Nodes.html)

### 2. AICA
- **是什么**：基于 ROS2 的组件化、可重构机器人框架，提供声明式应用描述、组件生命周期、硬件接口抽象，支持运行时重配。
- **与本项目的区别**：聚焦组件/硬件层；本项目叠加的是「LLM agent 决策层」+「DSH 时空组合性」。
- 来源：[AICA 应用概念](https://docs.aica.tech/docs/concepts/aica-applications/)、[AICA 硬件接口](https://github.com/aica-technology/api/blob/8238b0784a98c4db53d77de8a39c0c78eb347974/docs/docs/concepts/05-building-blocks/05-hardware-interfaces.md)

### 3. Eclipse Muto
- **是什么**：动态 ROS 软件栈编排，面向自动驾驶车辆的运行时组合。
- **与本项目的区别**：部署编排场景；本项目是「agent 决策层的能力热插拔」。
- 来源：[Eclipse Muto in Action](https://www.classcentral.com/course/youtube-eclipse-muto-in-action-359949)

### 4. OpenRAL
- **是什么**：自称「physical AI 的 agentic harness，ROS2 原生」。
- **与本项目的区别**：方向上最接近；本项目的独特锚点是「DSH 时空组合性」这一具体机制，而非笼统的 agentic harness。
- 来源：[OpenRAL — Open Robotics Discourse](https://discourse.openrobotics.org/t/openral-the-agentic-harness-for-physical-ai-ros-2-native/56352)

### 5. RoboNeuron
- **是什么**：模块化框架，连接基础模型与 ROS。
- **与本项目的区别**：偏模型接入；未强调热插拔的精确生命周期。
- 来源：[RoboNeuron](https://www.emergentmind.com/papers/2512.10394)

### 6. Nautilus
- **是什么**：从「一个提示」到「即插即用机器人学习」。
- **与本项目的区别**：聚焦学习/数据，非运行时能力编排。
- 来源：[Nautilus](https://ar5iv.labs.arxiv.org/html/2605.11665)

### 7. MCP（Model Context Protocol）
- **是什么**：LLM 与外部工具/数据源连接的标准协议。
- **与本项目的区别**：是协议标准，不含作用域/生命周期编排语义。
- 来源：[MCP 官网](https://modelcontextprotocol.io)

### 8. dsh-ios（DSH 插件）
- **是什么**：把「实时 iOS 模拟器 + USB 连接 iPhone」放进对话的 DSH 插件（21 个 agent 工具）。
- **与本项目的区别**：佐证「DSH + 硬件即插即用」可行，但非具身机器人能力编排。
- 来源：[dsh-ios](https://github.com/ZSeven-W/dsh-ios)

---

## 关于 DSH 本身的背景（非近邻，是底座）

- DSH 是「一切皆插件」的 agent 运行框架，连 agent loop 都能热插拔：
  - [DeepSeek Harness：当「一切皆插件」成为 Agent 的新底座](https://developer.aliyun.com/article/1756806)
  - [DeepSeek Harness：连 Loop 都能热插拔](https://cloud.tencent.cn/developer/article/2726144)

---

## 结论

本项目不做「第一个机器人热插拔」，也不做「第一个 agent 控制 ROS」，而是做**「DSH 时空组合性」这一具体组合原语在「机器人能力热插拔」场景下的可复现实现**。差异化来自「机制 × 场景 × 实现」的结合，而非任何单一维度。
