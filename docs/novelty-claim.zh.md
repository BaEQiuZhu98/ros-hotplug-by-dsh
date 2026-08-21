# Novelty Claim — 新颖性主张（精确边界）

> 本文是「占坑」的核心声明文档，与 [`../DESIGN.zh.md`](../DESIGN.zh.md) 第 4 节同源，展开为可独立引用的一页。

---

## 一句话主张

> **率先将 DeepSeek Harness（DSH）的时空组合性（分层作用域 + Cordis 生命周期）应用于具身机器人能力的热插拔，并给出可复现实现与验证。**

## 主张的三个构成要件

新颖性不是「某个词」，而是三者的**结合**：

| 要件 | 内容 |
|---|---|
| **机制（Mechanism）** | DSH 的分层作用域（scope）+ 父链继承 + nearest-wins + `isolate` realm + Cordis `dispose` + 版本时序（plugin/package/run） |
| **场景（Scenario）** | 具身机器人的能力热插拔：末端执行器（夹爪 ↔ 吸盘）、传感器、技能的运行时增删换 |
| **实现（Implementation）** | 可复现的 `demo/13-hotplug`，含可靠性设计（校验/多版本/灰度/回滚/事件/隔离/回收） |

**三者缺一不可**：少了「机制」变成普通机器人热插拔；少了「场景」变成纯 DSH 机制演示；少了「实现」变成无法验证的猜想。

## 明确不主张（边界）

| 不主张 | 原因 | 依据 |
|---|---|---|
| 发明「时空组合性」 | 是 DSH（Cordis + scope）既有机制 | DSH 源码/文档 |
| 第一个做「机器人热插拔」 | 早有 ROS2 生命周期节点、AICA、Eclipse Muto 等 | 见 [`prior-art.zh.md`](prior-art.zh.md) |
| 第一个做「agent 控制 ROS」 | 早有 OpenRAL、RoboNeuron 等 | 见 [`prior-art.zh.md`](prior-art.zh.md) |
| 硬件层/硬实时/电气安全热插拔 | 本项目只覆盖软件能力层 | 见 DESIGN 第 10 节局限 |

## 为什么这样定边界

过度主张会被一眼看穿并反噬信誉；过窄主张又失去意义。正确口径是：**「这套机制 × 这个场景 × 这个实现」这个具体结合，目前未见于公开资料**。这样既诚实、又可验证、又保留足够的差异化空间。

## 如何验证主张成立

| 验证点 | 方法 |
|---|---|
| 未见于公开资料 | 定期检索（关键词见下），并记录检索日期与结果 |
| 可复现 | 任何人按 `demo/13-hotplug` 的 README 能跑通并复现四项指标 |
| 时间优先 | 以 [`disclosure-log.zh.md`](disclosure-log.zh.md) 中的 commit hash + 时间戳 + 推送为准 |

**建议定期检索的关键词**（中英）：
`DSH 时空组合性 机器人 热插拔`、`DSH spatiotemporal hot-plug robot`、`DeepSeek Harness robotics hot-plug`、`Cordis scope robot reconfiguration`。

## 主张的表述升级路径

- 阶段一（现在）：内部/仓库声明，措辞如上。
- 阶段二：公开博客/社区，保留「率先」但附上近邻对比。
- 阶段三：arXiv 预印本，改学术措辞（去掉「率先」，改为「我们提出/We present」，以可验证实验为准）。
