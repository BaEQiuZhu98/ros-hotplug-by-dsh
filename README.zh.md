# ros-hotplug-by-dsh

> **一句话定位**：率先将 DeepSeek Harness（DSH）的「时空组合性」应用于**具身机器人能力的热插拔**，并给出**可复现实现 + 教学级 demo**。

---

## 作者背景

| 维度 | 现状 |
|---|---|
| **强项** | C / Python / Linux 底层；分布式系统；实时转发与协议栈优化；高可用与安全敏感系统（主备冗余、灰度升级、异常秒级回滚、99.9% 可用性、零信任安全流水线、发布/订阅解耦）；AI 辅助研发工程化；项目交付 |
| **机器人与大模型知识** | 沿 demo 教学路线（demo/00 起）从零学起，覆盖 ROS2 / 运动学 / 仿真 / DSH agent 开发 |

> **定位**：用「系统工程 + 可靠性」的强项切入「具身机器人软件 × DSH agent」这个交叉点。所有机器人与大模型知识，一律在 demo 中按顺序从零学起，本项目不做任何「默认你已经会」的假设。

---

## 新颖性主张（一句话）

> **率先将 DSH 的时空组合性（分层作用域 + Cordis 生命周期）应用于具身机器人能力的热插拔，并给出可复现实现与验证。**

- 不主张「发明时空组合性」（那是 DSH 的机制）。
- 不主张「第一个做机器人热插拔」（ROS2 生命周期节点、AICA 等早已存在）。
- 主张的是「**这套机制 × 这个场景 × 这个实现**」的结合与可复现验证。

详细边界见 [`docs/design.zh.md`](docs/design.zh.md)。

---

## 仓库结构

```
ros-hotplug-by-dsh/
├── README.zh.md / README.md        # 本文件（中 / 英）
├── docs/                           # design(设计) / novelty(现状与亮点) / glossary(名词概念) / 时空组合性 / disclosure-log
├── src/                            # 源码工程(见 src/README.zh.md)
│   ├── capabilities/               #   能力仓库(repo) + 挂载服务(mount_service) + 规范 + 挂载守卫
│   ├── presets/robo/               #   机器人任务 agent preset(persona + observer + skills)
│   ├── ros2/                       #   sim_bridge(双臂仿真桥) + cpp_control(1kHz 控制)
│   ├── bridge/                     #   桥接契约 + 薄 SDK
│   └── sim/                        #   MuJoCo 模型与场景
├── eval/                           # 评测(robot / agent / hotplug / tests)
├── plugins/                        # 动态 Cordis 插件归档
└── demo/                           # 教学目录（见 demo/README.zh.md）
    ├── 00-dsh-quickstart/ ... 13-hotplug/
    └── 13-hotplug/                 # ★ 旗舰 demo：机器人能力热插拔（含可靠性设计）
```

---

## 当前实现概览

- **能力仓库 + 挂载服务**：grasp 1.0.0/1.1.0/1.2.0、suction 1.0.0（末端类）与 camera_detect 1.0.0（传感器类）；
  挂载前 sha256 准入 + kind 路由，运行时挂/卸不重启，失败回滚，同名实例按臂作用域隔离。
- **能力面板（人的唯一写入口）**：臂/感知下拉框装配、全部复位与单臂复位（含关节回原位）、
  拿小球行（选臂或不指定臂，发给 agent 执行）、小球位置设定与显示、折叠展开。
- **robo agent preset**：agent 只感知 ready 与执行 take_object，不感知末端实现细节；
  视觉能力挂载后执行链自动注入小球位置（盲抓 → 精准），卸载自动回退，视觉异常 fail-open。
- **桥接契约 + SDK**：tool_config / ball_position / touch_command / move_to（收敛完成式）/
  home_command / reset_command + /joint_state 回传（joints/tools/ball/ee）。
- **评测**：pytest 门禁 + bridge 实时套件 + /tmp 隔离驱动套件（见 eval/tests/README.zh.md）。

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
| 完整性哈希校验 | 能力挂载前 manifest / 哈希校验，不合法拒绝挂载 |
| 多版本共存 | 同一能力多版本并存（能力仓库版本目录） |
| 升级切换 + 业务零中断 | 卸载旧实例 + 挂载新实例，agent 无感 |
| 失败自动回滚（存在短暂切换窗口） | 换挂失败自动恢复旧实例（尽力，恢复失败显式告警） |
| 发布/订阅事件通知 | 能力增删广播事件，agent 通过订阅感知 |
| 硬件差异屏蔽层（解耦） | 能力抽象层：同型末端执行器同名遮蔽、上层无感 |
| 资源精确回收 | 臂作用域隔离 + Cordis dispose 精确回收 |

详见 [`docs/design.zh.md`](docs/design.zh.md) 第 8 节。

---

## 路线图（未来会做，记录于此）

- **仿真真实性**：后续仿真采用真实物理形态的吸盘 + 夹爪 + 小球（接触判定、抓取后球随末端运动），支撑评测的「成功率」语义。
- **评测扩展**：agent vs oracle vs random 自动化评测。

## 快速开始

> 从 [`demo/00-dsh-quickstart`](demo/00-dsh-quickstart) 开始：装 DSH → 配 key → 跑通第一个 agent；机器人部分从 [`demo/06-ros2-mujoco-env`](demo/06-ros2-mujoco-env) 搭 ROS2 + MuJoCo 环境。

## 披露与留证

> 首次公开 commit、FreeTSA 时间戳回执、发布链接见 [`docs/disclosure-log.zh.md`](docs/disclosure-log.zh.md)。
