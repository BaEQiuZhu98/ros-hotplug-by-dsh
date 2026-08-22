# ros-hotplug-by-dsh

> **一句话定位**：率先将 DeepSeek Harness（DSH）的「时空组合性」应用于**具身机器人能力的热插拔**，并给出**可复现实现 + 教学级 demo**。

---

## 个人画像（修正版 · 重要）

| 维度 | 现状 |
|---|---|
| **强项（已具备）** | C / Python / Linux 底层；分布式系统；实时转发与协议栈优化；高可用与安全敏感系统（主备冗余、灰度升级、异常秒级回滚、99.9% 可用性、零信任安全流水线、发布/订阅解耦）；AI 辅助研发工程化；项目交付 |
| **机器人知识** | **= 0**（无 ROS、无运动学、无控制、无仿真经验） |
| **大模型知识** | **= 0**（无 LLM 原理、无训练、无 agent 开发经验） |

> **定位**：用「系统工程 + 可靠性」的强项切入「具身机器人软件 × DSH agent」这个交叉点。**所有机器人与大模型知识，一律在 demo 中按顺序从零学起**，本项目不做任何「默认你已经会」的假设。

---

## 新颖性主张（一句话）

> **率先将 DSH 的时空组合性（分层作用域 + Cordis 生命周期）应用于具身机器人能力的热插拔，并给出可复现实现与验证。**

- 不主张「发明时空组合性」（那是 DSH 的机制）。
- 不主张「第一个做机器人热插拔」（ROS2 生命周期节点、AICA 等早已存在）。
- 主张的是「**这套机制 × 这个场景 × 这个实现**」的结合与可复现验证。

详细边界见 [`docs/design.zh.md`](docs/design.zh.md)。

---

## 仓库结构（当前阶段：demo 证据链 + src 源码工程；eval 待建）

```
ros-hotplug-by-dsh/
├── README.zh.md / README.md        # 本文件（中 / 英）
├── docs/                           # design(设计) / novelty(现状与亮点) / glossary(名词概念) / 时空组合性 / disclosure-log
├── src/                            # 源码工程(阶段 0~2 已落地, 见 src/README.zh.md)
│   ├── capabilities/               #   能力仓库(repo) + 挂载服务(mount_service) + 规范 + 挂载守卫
│   ├── presets/robo/               #   机器人任务 agent preset(persona + observer + skills)
│   ├── ros2/                       #   sim_bridge(双臂仿真桥) + cpp_control(1kHz 控制)
│   ├── bridge/                     #   桥接契约 v1.0 + 薄 SDK
│   └── sim/                        #   MuJoCo 模型与场景
├── plugins/                        # 动态 Cordis 插件归档（next-demo / sync-docs）
└── demo/                           # 教学目录（见 demo/README.zh.md）
    ├── 00-dsh-quickstart/ ... 15-imitation/
    └── 13-hotplug/                 # ★ 旗舰 demo：机器人能力热插拔（含可靠性设计）
```

---

## demo 教学路线（DSH 优先，机器人靠后）

核心逻辑：**先学会用 DSH（含 AI Coding），再用 DSH 辅助完成机器人部分，最后用「热插拔」把两者串联。**

完整逐段说明见 [`demo/README.zh.md`](demo/README.zh.md)。顺序如下：

1. **Agent 是什么**
2. **如何更好地 AI Coding**
3. **DSH 概念**
4. **DSH Plugin**
5. **DSH 时空组合性**
6. → 之后才进入机器人：ROS2 / 刚体变换 / 运动学 / 轨迹控制 / ROS2 节点化 / C++ 控制
7. → 最后 `demo/13-hotplug` 把 DSH 与机器人串联成旗舰 demo

---

## 可靠性设计概览

把工程上的可靠性实践，逐条映射到能力热插拔（`demo/13-hotplug` 教学演示 + `src/` 源码工程）：

| 工程实践 | 本项目落点 |
|---|---|
| 零信任安全流水线（云端签名/加密 - 设备验签/解密） | 能力挂载前 manifest / 哈希校验，不合法拒绝挂载 |
| 主备冗余 + 多版本共存 | 同一能力多版本并存（能力仓库版本目录） |
| 升级切换 + 业务零中断 | 卸载旧能力 + 挂载新能力，agent 无感（灰度不做，用户决策） |
| 异常秒级自动回滚 | 新能力激活失败则旧句柄保留，旧能力仍在 |
| 发布/订阅事件通知 | 能力增删广播事件，agent 通过订阅感知 |
| 硬件差异屏蔽层（解耦） | 能力抽象层：同型末端执行器同名遮蔽、上层无感 |
| 99.9% 高可用 / 资源不泄漏 | `isolate` realm 隔离 + Cordis dispose 精确回收 |

详见 [`docs/design.zh.md`](docs/design.zh.md) 第 8 节。

---

## 快速开始

> 从 [`demo/00-dsh-quickstart`](demo/00-dsh-quickstart) 开始：装 DSH → 配 key → 跑通第一个 agent；机器人部分从 [`demo/06-ros2-mujoco-env`](demo/06-ros2-mujoco-env) 搭 ROS2 + MuJoCo 环境。

## 披露与留证

> 首次公开 commit、FreeTSA 时间戳回执、发布链接见 [`docs/disclosure-log.zh.md`](docs/disclosure-log.zh.md)。
