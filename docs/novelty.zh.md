# 现状分析与项目亮点

> 目的：分析现有机器人热插拔方法的局限（论文/源码/架构依据），并说清本项目的亮点与主张边界。原 `hotplug-methods`、`prior-art`、`novelty-claim` 三文档合并于此。

---

## 1. 现状：现有热插拔方法的局限

### 1.1 ROS2 生命周期节点 / 可组合节点（官方机制，但最薄）

- **机制**：`LifecycleNode` 是状态机（`unconfigured → inactive → active → finalized`），管节点自身起停；composable node 可在运行时容器里 load/unload。
- **局限**：粒度是「进程/节点」而非「能力」；没有「对上层可见性」语义；没有同型隔离；没有版本语义（灰度/回滚全手写）。
- 来源：[ROS2 生命周期与组件化](https://panav.gitbook.io/robotics-handbook/ros-2/lifecycle-and-composition)、[What are lifecycle/composable nodes for](https://robotics.stackexchange.com/questions/115208/what-are-lifecycle-nodes-and-composable-nodes-for)。

### 1.2 AICA（组件化可重构框架，工业界代表）

- **机制**：声明式应用（YAML）+ 组件生命周期 + 运行时重配；底层 `Modulo` 是 C++ 组件运行时。
- **局限**：重构发生在「组件/应用图」层，偏硬件/组件编排，不含 LLM/agent 决策层；其动态性是图的重解析，而非「把能力工具精确挂/卸到某作用域并让 agent 立即感知」。
- 来源：[AICA Components](https://docs.aica.tech/docs/concepts/building-blocks/components/)、[Modulo](https://aica-technology.github.io/modulo/)。

### 1.3 OpenRAL（与本文最接近，诚实点名）

- **机制**：ROS2 原生 agentic harness，把 ROS2 能力封装成 **rskill** 暴露给 LLM agent 当工具调用。
- **局限**：解决了「让 agent 调 ROS2」，但提供的是 skill 库 + 调用协议，**没有 DSH 那套「分层作用域 + isolate realm + Cordis dispose」的组合原语**——「工具化」上重叠，「空间可见性 + 时间精确生灭 + 版本时序」锚点上不具备。
- 来源：[OpenRAL — agentic harness for physical AI](https://discourse.openrobotics.org/t/openral-the-agentic-harness-for-physical-ai-ros-2-native/56352)。

### 1.4 通用软件热插拔（跨域，粒度不对）

- K8s 灰度/金丝雀/蓝绿、OSGi、dlopen/pluginlib、Erlang 热码替换：粒度是「服务/进程/类」，没有「能力对 agent 可见」的语义，且强绑定部署系统。

### 1.5 学术综述定论

[Software Reconfiguration in Robotics (EMSE 2024)](https://link.springer.com/article/10.1007/s10664-024-10596-9) 系统性梳理了机器人软件重构的几大类（动态软件产品线、基于模型、组件化等），指出的共性缺口：**重构停留在「结构/行为」层，缺乏与上层任务/决策层的衔接，缺乏统一的运行时安全与一致性保证**。

> 收敛成一句话：现有方案要么管「进程/节点」，要么管「组件图」，要么管「skill 调用」，但没有一个把「此刻对谁可见（空间）」「何时生、何时被精确回收（时间）」「如何多版本灰度/回滚」三者绑在同一个锚点上。

---

## 2. 近邻工作对比总表

| 工作 | 类别 | 与本项目的关系 | 区别（本项目的独特锚点） |
|---|---|---|---|
| ROS2 生命周期/可组合节点 | ROS 组件生命周期 | 机器人侧「局部热插拔」官方机制 | 只管理节点状态机，不解决 agent 可见性、同型隔离、灰度回滚 |
| AICA | 组件化可重构机器人框架 | 声明式组件 + 运行时重配 | 偏硬件/组件层，不含 LLM/agent 编排层 |
| Eclipse Muto | 动态 ROS 软件栈编排 | 运行时编排 ROS 组件 | 偏无人车部署编排，非 agent 决策层的能力热插拔 |
| OpenRAL | ROS2 原生 agentic harness | 与本文最接近（agent + ROS2） | 本文独特锚点 = 「DSH 时空组合性」这套具体组合原语 |
| RoboNeuron | 基础模型 × ROS 模块化 | 连接基础模型与 ROS | 偏模型接入，未强调热插拔的精确生命周期 |
| Nautilus | plug-and-play 机器人学习 | 「即插即用」思路 | 聚焦「从提示到机器人学习」，非运行时能力编排 |
| MCP | 通用工具协议 | 动态注册工具的标准 | 是协议标准，不含作用域/生命周期编排语义 |
| dsh-ios | DSH 硬件热插拔味插件 | 把 USB iPhone/模拟器放进对话 | 佐证 DSH 能做硬件热插拔，但非具身能力编排 |

---

## 3. 本项目亮点：DSH 时空组合性 × 能力热插拔（源码/架构依据）

### 3.1 空间轴：作用域 + isolate realm（谁看得见谁）

- 能力按分层作用域摆放（全局 → preset 常驻 → 每 agent），注册视图**向下继承、最近者胜**；`isolate` realm 让同型能力**每挂载会话一份私有实例，不串台**。
- **优势**：挂载 = 立刻对 agent 可见；同型能力同名不冲突。其它方案没有这个原语。

### 3.2 时间轴：Cordis 生命周期（谁在何时生灭）

- 插件 `apply(ctx)` 的一切副作用挂在当前 Fiber，`ctx.on`/`ctx.effect` 返回 disposer；停止/更新/移除按序 teardown。
- **优势**：卸载 = 精确回收连接/订阅/状态。ROS2 生命周期节点只给状态机、不保证回收。

### 3.3 版本时序：plugin / package / run（灰度 + 回滚）

- plugin（实例）/ package（不可变版本）/ run（激活尝试）三级语义：`cordis_define` 追加不可变 package，`update` 灰度切版，失败可 `run` 回滚。
- **优势**：多版本共存 + 灰度 + 回滚内建，不是应用层手写。

### 3.4 锚点契约：可见性 = 生命周期（核心差异）

- DSH 核心不变量：**注册的上下文同时决定这项注册的可见性与生命周期**，杜绝「看得见却已死 / 活着却看不见」两类 bug。其它方案靠应用层约定，DSH 机制层保证。

### 3.5 与 agent 决策层同构

- DSH 本身是 agent 框架（工具表 scoped + dynamic），热插拔发生在「agent 的能力工具」层，直接对上「agent 无感切换」；能力增删经 `tools/change` 等事件广播，agent 订阅感知。

> 机制完整详解见 [`spatiotemporal-compositionality.zh.md`](spatiotemporal-compositionality.zh.md)。

---

## 4. 收敛对比表

| 方案 | 管到哪一层 | 作用域可见性 | 精确回收 | 版本回滚 | 对上 agent |
|---|---|---|---|---|---|
| ROS2 lifecycle / composable | 进程/节点 | ✗ | ✗（靠自律） | ✗（手写） | ✗ |
| AICA | 组件图 | ✗ | 部分 | ✗ | ✗ |
| OpenRAL | skill 调用 | ✗ | ✗ | ✗ | ✓ |
| **DSH 时空组合性** | **能力工具** | **✓ isolate / nearest-wins** | **✓ dispose** | **✓ package / run** | **✓** |

---

## 5. 主张边界

### 5.1 一句话主张

> **率先将 DSH 的时空组合性（分层作用域 + Cordis 生命周期）应用于具身机器人能力的热插拔，并给出可复现实现与验证。**

### 5.2 三个构成要件（缺一不可）

| 要件 | 内容 |
|---|---|
| 机制 | DSH 分层作用域 + nearest-wins + isolate realm + Cordis dispose + 版本时序 |
| 场景 | 具身机器人能力热插拔（末端执行器/传感器/技能） |
| 实现 | 可复现的 `demo/13-hotplug` + 源码工程 + 评测 |

### 5.3 明确不主张

不主张发明「时空组合性」（DSH 既有机制）；不主张「第一个机器人热插拔」（ROS2/AICA 早有）；不主张「第一个 agent 控制 ROS」（OpenRAL 等）；不主张硬件层/硬实时/电气安全热插拔。

### 5.4 验证与升级路径

- 未见于公开资料：定期检索（关键词：`DSH 时空组合性 机器人 热插拔`、`DSH spatiotemporal hot-plug robot`、`DeepSeek Harness robotics hot-plug`、`Cordis scope robot reconfiguration`）并记录日期与结果。
- 可复现：按 `demo/13-hotplug` README 跑通并复现四项指标。
- 时间优先：以 `disclosure-log.zh.md` 的 commit hash + 时间戳 + 推送为准。
- 表述升级：内部声明（现在）→ 公开博客 → arXiv（去掉「率先」，以实验为准）。

## 6. 关于 DSH 本身（底座，非近邻）

- DSH 是「一切皆插件」的 agent 运行框架，连 agent loop 都能热插拔：
  - [DeepSeek Harness：当「一切皆插件」成为 Agent 的新底座](https://developer.aliyun.com/article/1756806)
  - [DeepSeek Harness：连 Loop 都能热插拔](https://cloud.tencent.cn/developer/article/2726144)
