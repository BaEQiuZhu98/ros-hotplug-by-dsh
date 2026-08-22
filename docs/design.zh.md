# 项目设计文档 — ros-hotplug-by-dsh

> 本文是本项目的**唯一设计文档**。
> 证据与留痕见 [`disclosure-log.zh.md`](disclosure-log.zh.md) 与 `timestamps/`（**保持原样，勿动**）；现状分析与项目亮点见 [`novelty.zh.md`](novelty.zh.md)；DSH 时空组合性机制详解见 [`spatiotemporal-compositionality.zh.md`](spatiotemporal-compositionality.zh.md)。

---

## 1. 标题与一句话

**基于 DSH 时空组合性的具身机器人能力热插拔（ros-hotplug-by-dsh）**

将 DSH 的「时空组合性」用作机器人能力热插拔的组合原语：**空间上分层可见，时间上精确生灭**。

## 2. 摘要

- **问题**：具身机器人需要运行时增删/替换能力（换末端执行器、加传感器、升级技能），但现有方案要么绑定重启、要么只管硬件/组件层、要么与 LLM agent 决策层脱节。
- **方法**：以 DSH 时空组合性（分层作用域 + Cordis 生命周期 + 版本时序）作为**能力编排层**，叠加在 ROS2 之上；把每个机器人能力封装为 DSH 插件工具，热插拔 = 作用域注册/撤销。
- **结果**：实现并验证四项指标——**插入即见、拔出即回收、同名不串台、agent 无感**；并叠加可靠性设计（校验、多版本、灰度、回滚、事件通知）。

## 3. 动机与背景

- 真实机器人在不同任务间要换末端执行器（夹爪 ↔ 吸盘）、加传感器、升级感知/技能；理想情况是**不重启、不停机、不影响其他能力**。
- 已有「可重构」工作多聚焦硬件层或 ROS 组件层，与上层「agent 决策」脱节；而 LLM/agent 机器人框架又多聚焦「单次任务」，缺少能力热插拔的精确生命周期管理。
- 因此需要一套「上层能力编排」原语：挂载一个能力 = 立即可用；卸载 = 资源精确回收；同名能力互不串台；版本可灰度可回滚。

## 4. 新颖性主张（精确边界）

### 4.1 一句话主张

> **率先将 DeepSeek Harness（DSH）的时空组合性（分层作用域 + Cordis 生命周期）应用于具身机器人能力的热插拔，并给出可复现实现与验证。**

### 4.2 主张的三个构成要件（缺一不可）

| 要件 | 内容 |
|---|---|
| **机制** | DSH 的分层作用域 + 父链继承 + nearest-wins + `isolate` realm + Cordis `dispose` + 版本时序（plugin/package/run） |
| **场景** | 具身机器人的能力热插拔：末端执行器（夹爪 ↔ 吸盘）、传感器、技能的运行时增删换 |
| **实现** | 可复现的 `demo/13-hotplug`（及源码工程 `src/`），含可靠性设计与评测 |

### 4.3 明确不主张（边界）

| 不主张 | 原因 |
|---|---|
| 发明「时空组合性」 | 是 DSH（Cordis + scope）既有机制 |
| 第一个做「机器人热插拔」 | ROS2 生命周期节点、AICA、Eclipse Muto 等早已存在 |
| 第一个做「agent 控制 ROS」 | OpenRAL、RoboNeuron 等已有 |
| 硬件层/硬实时/电气安全热插拔 | 本项目只覆盖「软件能力层」 |

### 4.4 主张的验证与升级路径

- 未见于公开资料：定期检索并记录（关键词见 `novelty.zh.md`）。
- 可复现：按 `demo/13-hotplug` README 能跑通并复现四项指标。
- 时间优先：以 `disclosure-log.zh.md` 的 commit hash + 时间戳 + 推送为准。
- 表述升级：内部声明（现在）→ 公开博客 → arXiv 学术措辞（去掉「率先」，以实验为准）。

## 5. 现状分析与近邻工作（要点）

现有方案要么管「进程/节点」（ROS2 lifecycle/composable），要么管「组件图」（AICA/Muto），要么管「skill 调用」（OpenRAL），但没有一个把「此刻对谁可见（空间）」「何时生、何时被精确回收（时间）」「如何多版本灰度/回滚」绑在同一个锚点上。权威综述 [Software Reconfiguration in Robotics (EMSE 2024)](https://link.springer.com/article/10.1007/s10664-024-10596-9) 也指出：现有重构停留在「结构/行为」层，缺乏与上层任务/决策层的衔接。

> 完整论证（逐项对比 + DSH 优势 + 收敛对比表）见 [`novelty.zh.md`](novelty.zh.md)。

## 6. 核心概念：DSH 时空组合性（简述）

- **空间轴（谁看得见谁）**：平面（host 进程级 / agent preset 每会话）、作用域父链（注册视图向下继承、nearest-wins 遮蔽、事件放行向上扩展）、`isolate` realm。
- **时间轴（谁在何时生灭）**：Cordis 生命周期（apply/effect/dispose）、常驻挂载/世代、动态插件版本时序（plugin 实例 / package 不可变版本 / run 激活尝试）。
- **锚点契约**：注册的上下文同时决定「可见性」与「生命周期」，防止「看得见却已死 / 活着却看不见」。

> 完整机制详解见 [`spatiotemporal-compositionality.zh.md`](spatiotemporal-compositionality.zh.md)（demo/05 的完整版）。

---

## 7. 系统设计

### 7.1 分层架构

```
[任务/自然语言指令: "抓小球"]
        ↓
DSH Agent（感知 + 策略 + 决策，不做低层控制）
        ↓ 工具调用（能力工具: grasp / suction / detect ...） ← 热插拔发生在这里
DSH 能力层（经 rosbridge 的桥接契约）
        ↓ WebSocket ↔ ROS2 话题
ROS2 控制层（C++ 高频控制节点 + Python 仿真桥）
        ↓
MuJoCo 仿真（双臂 + 多末端执行器 + 场景） / 真机（换 hardware_interface）
```

### 7.2 agent 的角色：感知与自适应（重要修正）

- **agent 不控制「自己具备什么末端」**。末端的挂载/更换由**人 / 平台 / 运维**完成（外部事件）。
- **agent 也没有挂载权限**：挂载/卸载的唯一写入口是 web 面板（人点击）→ 能力挂载服务；agent 的工具表里根本没有挂/卸工具，物理上无法修改末端装配（写路径/读路径分离，见 §7.6）。
- agent 的角色是：
  1. **感知**：当前有哪些末端能力可用（工具表 / 能力状态查询 / `tools/change` 事件）；
  2. **推理**：对**同一个语言命令**（如「抓小球」，不含「用夹爪」这种限定），根据当前末端状态**自适应选择策略与计算方式**——有夹爪走夹取策略、有吸盘走吸附策略、没有末端则报告「当前没有末端执行器，无法抓取」；
  3. **执行**：调用当前可用的那个能力工具。
- 热插拔发生时：agent 收到事件 → 更新感知 → **之后同一条命令自动换策略**。这就是「agent 无感 + 自适应」的完整含义。

### 7.3 一次完整交互（演示的目标表现）

1. 场景：双臂 + 小球，两臂都无末端。
2. 用户：「**抓小球**」。agent 感知：无末端能力 → 回复「当前没有末端执行器，无法抓取」。
3. 人/平台热插拔：给臂 A 挂上夹爪能力。
4. 用户再说「**抓小球**」。agent 感知：夹爪可用 → 夹取策略 → 调 `grasp` → 臂 A 末端变红、移到小球（抓取）。
5. 人/平台热插拔：把夹爪换成吸盘（卸载 grasp、挂载 suction）。
6. 用户第三次说「**抓小球**」。agent 感知：吸盘可用 → 吸附策略 → 调 `suction` → 末端变蓝、移到小球（吸附）。

> 核心看点：**同一句命令，agent 三次给出与末端状态匹配的策略**；切换全程 agent 无感、机器人不停机。

### 7.4 多 agent 设计

- **任务 agent**（主）：感知 + 策略 + 调用能力工具（如上）。
- **观测/运维 agent**：订阅能力增删事件与状态，汇报「当前能力集合 / 热插拔日志」（支撑可靠性点「事件通知」）。
- **评测 subagent**：委托跑 `eval/`（对应「Subagent 委托」知识点）。

### 7.5 热插拔机制设计

| 操作 | 机制 | 效果 |
|---|---|---|
| 挂载能力 | 挂载服务校验 manifest 后在**机器作用域**运行时注册插件（`ctx.plugin`） | 立刻对 agent 可见可用，**不重启** |
| 卸载能力 | 挂载服务 `fiber.dispose()`（异步，精确回收） | 精确回收其订阅/连接，agent 无感 |
| 替换能力 | 卸载旧能力 + 挂载新能力（能力仓库按版本目录并存） | 切换期间 agent 无感 |
| 同名隔离 | isolate realm / 作用域遮蔽（nearest-wins） | 两个夹爪/吸盘实例互不串台 |
| 失败回滚 | 挂载服务保留旧句柄，新版本激活失败则旧能力仍在 | 旧能力不受影响 |
| 变化感知 | 事件广播（tools/change）+ agent 订阅 | agent 自动感知能力增删 |

### 7.6 写路径与读路径分离（唯一写者 = 人）

```
写路径(唯一):  人 ──点击──► web 面板 ──RPC──► 能力挂载服务 ──► 挂载/卸载/换版本
读路径(agent): 任务 agent ──► 工具表 + capability_status(只读感知, 自适应选策略)
               观测 agent ──► tools/change 事件(只读订阅, 汇报能力集)
```

- 能力挂载服务是**组合挂载的真实插件**（host 常驻行），不是动态沙箱插件：动态插件的沙箱 ctx 刻意隐藏 `plugin` 等框架内部，而挂载服务需要 `ctx.plugin`/`fiber.dispose` 这两条运行时挂/卸原语（即动态插件 `cordis_run` 的底层同款机制，已源码核实）。
- 挂载与卸载是异步动作：`ctx.plugin` 返回后 apply 尚未跑完，`dispose` 返回后回收尚未完成；挂载服务要返回「就绪」信号，卸载要 await dispose 完成。
- agent 拿不到挂/卸工具 = 作用域天然隔离，不靠 persona 规劝。

---

## 8. 可靠性设计（工程实践 → 项目）

| 工程实践 | 本项目落点 | 验证方式 |
|---|---|---|
| 零信任安全流水线 | 能力挂载前 manifest / 哈希校验，不合法拒绝 | 传入篡改 manifest → 拒绝挂载 |
| 主备冗余 + 多版本共存 | 同一能力多版本共存 | 同时注册 v1/v2 不冲突 |
| 灰度升级 + 业务零中断 | 卸载旧能力 + 挂载新能力，agent 无感 | 切换期间任务不中断 |
| 异常秒级自动回滚 | 新能力激活失败则旧句柄保留，旧能力仍在 | 注入故障 → 旧能力照常可用 |
| 发布/订阅事件通知 | 能力增删广播事件，agent 订阅感知 | 挂载/卸载时事件被收到 |
| 硬件差异屏蔽层 | 能力抽象层：同型末端同名遮蔽 | 两末端执行器同名遮蔽正确 |
| 高可用 / 资源不泄漏 | isolate 隔离 + dispose 精确回收 | 卸载后无残留连接/状态 |

### 8.1 各可靠性点的机制与落地

| # | 可靠性点 | DSH 机制 | 怎么证明 |
|---|---|---|---|
| 1 | 零信任/哈希校验 | 挂载守卫（挂载服务内）+ 机器作用域注册 | 篡改 manifest 哈希 → `mount_guard` 拒绝挂载 |
| 2 | 多版本共存 | 能力仓库版本目录并存 + 不可变包 | v1/v2/v3 并存、互不覆盖 |
| 3 | 换版切换 | 卸载旧能力 + 挂载新能力 | 切换期间工具名不变，agent 无感 |
| 4 | 失败回滚 | 挂载服务保留旧句柄，新版本激活失败旧能力仍在 | 注入坏版本 → 挂载失败 → 旧能力照常可用 |
| 5 | 事件通知 | `tools/change` 等事件广播 + 订阅 | 挂/卸时监听器收到事件 |
| 6 | 同名遮蔽 | nearest-wins + isolate realm | 两同型能力同名注册不串台 |
| 7 | 不泄漏 | isolate + Cordis dispose | 卸载后确认无残留订阅/状态 |

> **零信任/哈希校验的威胁模型**：能力可能来自**外部分发**或 **agent 现场生成**（大模型会幻觉、可被注入诱导），也可能在**存储/流转中被篡改**。因此「每次挂载都假设不可信，先验身再上机」——哈希证明「没被改过」，签名（可选加分项）证明「确实出自某人」，即「云端签名/加密 → 设备验签/解密」的零信任流水线。demo 13 先做哈希闭环，签名留作扩展。

---

## 9. 仿真平台选型

**结论：MuJoCo 定调不动；Isaac Sim/Isaac Lab 与 Gazebo 是「触发换」的备选，不是现在。**

| 维度 | MuJoCo | Gazebo | Isaac Sim + Isaac Lab |
|---|---|---|---|
| 物理速度/精度 | ★★★★★ | ★★★ | ★★★★ |
| ROS2 集成 | 无原生（自写桥/rosbridge，本项目卖点） | ★★★★★ gazebo_ros | ★★★ NVIDIA 生态 |
| 传感器/渲染 | RGB/深度，非照片级 | 相机/激光雷达/IMU | 照片级 |
| 学习曲线 | ★★★★★ | ★★ | ★ |
| 硬件门槛（WSL2 + 6GB） | ★★★★★ CPU 可 headless | ★★★ 吃内存 | ★ 需较新 NVIDIA |

选 MuJoCo 的三条理由：① 主线是运动控制（MuJoCo 强项）；② 0 基础要快速出可看输出（内联 XML + `mj_step`）；③ 6GB 显存 + WSL2 硬约束。

**触发换平台的时点**：demo 14/15（视觉/模仿学习）→ 上 Isaac Sim + Isaac Lab；要强调 ROS 全栈/传感器/导航 → 补 Gazebo。模型用 MuJoCo Menagerie（现成 Franka/Unitree）。

---

## 10. 源码工程与交付件

### 10.1 目录结构

```
ros-hotplug-by-dsh/
├── src/
│   ├── capabilities/              # ★ 能力仓库 + 挂载服务 + 规范
│   │   ├── capability-spec.md     #   能力开发规范(模板 + manifest + 挂载流程)
│   │   ├── mount_guard.py         #   挂载前哈希校验(零信任)
│   │   ├── mount_service/         #   能力挂载服务(host 常驻插件: 校验 + 运行时挂/卸; 唯一写入口)
│   │   ├── repo/                  #   能力仓库目录(一等交付件): grasp/1.0.0/{host.js, manifest.json} ...
│   │   └── pack.sh                #   可选发布外壳: 仓库目录打包成 npm tarball(公开分发用)
│   ├── presets/                   #   运行载体
│   │   └── robo/                  #   agent.cordis.yml(persona + observer + skills, 无能力行) + 技能
│   ├── ros2/                      #   机器人侧(colcon 包)
│   │   ├── cpp_control/           #   C++ 高频控制节点(1kHz, PID)
│   │   └── sim_bridge/            #   Python 仿真桥(MuJoCo + rclpy)
│   ├── bridge/                    #   桥接契约
│   │   ├── contract.md            #   话题/消息 schema(版本化)
│   │   └── bridge_client.py       #   rosbridge 客户端(SDK 底层)
│   └── sim/                       #   可视化仿真资源
│       ├── models/                #   MJCF: 单臂/双臂/夹爪/吸盘/小球
│       └── scenes/                #   预置场景
├── eval/                          # ★ 评测
│   ├── robot/                     #   IK/轨迹/频率(对照公开基线)
│   ├── agent/                     #   agent vs oracle vs random
│   ├── hotplug/                   #   热插拔 5 指标
│   └── native_swap/               #   ROS2 原生换末端实测(推迟待办, 用户决策 2026-08)
├── demo/                          #   教学(00~13, 证据链)
├── docs/                          #   本设计文档 + 亮点 + 机制 + 留痕
└── plugins/                       #   动态插件归档(工作流类)
```

### 10.2 交付件总览（L0~L6）

| 层 | 交付件 | 形态 | 作用 |
|---|---|---|---|
| L0 | GitHub 公开仓库 | repo | 总载体 + 证据链 |
| L1 | 能力（仓库目录 + 挂载服务） | 目录 + 常驻插件 | 每个末端/感知一个能力，运行时挂载/卸载（热插拔本体） |
| L2 | agent preset | 目录 | 开箱即用的机器人 agent 配置（只感知，不装配） |
| L3 | 机器人侧包 | ROS2 colcon 包 | 控制节点 + 仿真桥 |
| L4 | 桥接契约 + SDK | 文档 + Python 库 | 对外 API（唯一自造 API） |
| L5 | 评测套件 | eval/ 脚本 | 一键出指标 |
| L6 | 证据与文档 | docs/ | 主张/对比/基线/留痕 |

### 10.3 L1 能力与能力挂载服务（热插拔本体）

- **一等交付件 = 能力仓库目录**：`repo/<capability>/<version>/{host.js, manifest.json}`。host.js 是 ESM `{apply, inject, name}` 插件，**零依赖**（不 import 任何包，直接用注入服务 + 手写 Tool 契约）；manifest.json 记录元数据 + host.js 的 sha256。
- **npm 树外包 = 可选发布外壳**：`pack.sh` 把仓库目录打包成 tarball 分发到机器，解包进仓库后走**同一条挂载服务**，不再是「安装 = 挂载」。
- **挂载服务（mount_service）**：host 常驻插件（组合挂载，非动态沙箱）。`mount(cap, version)` = mount_guard 校验 sha256 → 动态 import host.js → `ctx.plugin(...)` 挂到机器作用域（工具立即可见）→ 返回句柄；`unmount(handle)` = `await fiber.dispose()`（精确回收）。写入口 = web 面板 RPC；**不注册任何 agent 工具**（agent 物理上无法挂/卸，§7.6）。
- **能力功能**：注册一个能力工具（grasp/suction/detect），`execute` 经桥驱动 ROS2。
- **API 形式**：**DSH 标准 Tool 契约**（`{name, description, parameters(JSON Schema), output{schema,render}, execute(args)}`）——用 DSH 现成接口，不造新协议。
- **三种形态的关系**：仓库目录 = 开发/本地验证；npm 树外包 = 发布外壳；动态插件 = 调试/一次性演示（沙箱禁框架内部，不能承载挂载服务）。**热插拔 = DSH 的运行时挂载机制（ctx.plugin/dispose），仓库目录是被热插拔的载体。**

### 10.4 L2 运行载体（agent preset）

- **形态**：一个**目录**（`~/.dsh/.agent-presets/robo/`），不是 npm 包。
- **内容**：`agent.cordis.yml`（组合：persona 行 + observer 行 + skills 挂载；**不含能力包行**——末端装配是机器事实，由挂载服务负责，preset 不决定）、persona（「感知末端状态，自适应选策略，不做低层控制」）、skills。
- **功能**：装上后 `dsh web` 新建会话选「robo」= 得到开箱即用的机器人任务 agent；观测插件订阅 `tools/change` 汇报能力集。
- **API 形式**：**cordis.yml 组合声明**（插件行/作用域）+ persona/skill 文本。

### 10.5 L3 机器人侧（ROS2 包）

- **包**：`cpp_control`（C++/rclcpp）、`sim_bridge`（Python/rclpy + MuJoCo）。
- **功能**：`cpp_control` = 1kHz 控制环、PID、轨迹跟踪、延迟测量；`sim_bridge` = 订阅桥指令、驱动 MuJoCo、`--view` 可视化、发布状态回传（demo 12/13 的 `arm_server.py`/`two_arm_server.py` 的正式版）。
- **API 形式**：ROS2 消息契约（见 L4）。
- **与现成框架的关系**：教学/评测**手写**（学原理、测精确）；接真机时按契约换用 `ros2_control`/`MoveIt2`、仿真桥可换 `mujoco_ros2_control`（ros-controls 组织维护，已查证）。手写与用现成不冲突——L3 接口留给现成框架替换，这正是适应性。

### 10.6 L4 桥接契约（对外 API，本项目唯一自造 API）

**第一层：消息契约（`bridge/contract.md`，版本化）**

```text
契约 v1.x
  话题 /tool_config   类型 std_msgs/String  载荷 "ARM:TOOL"  语义 切末端执行器
  话题 /ball_position 类型 std_msgs/String  载荷 "x,y"       语义 设置小球位置
  话题 /touch_command 类型 std_msgs/String  载荷 "A"|"B"     语义 选臂触碰小球
  话题 /capability_command 类型 std_msgs/String  载荷 "grasp"|"suction"  语义 激活能力(路径A)
  话题 /joint_state   类型 ...                载荷 ...         语义 状态回传(反馈)
```

**第二层：Python 薄 SDK（能力开发者/DSH 插件 host 共用）**

```python
class Bridge:
    def set_tool(self, arm, tool) -> dict:      # 校验 arm∈{A,B}, tool∈{grasp,suction,none}; 返回 {ok, error}
    def set_ball(self, x, y) -> dict:           # 校验数字; 返回 {ok, error}
    def touch(self, arm) -> dict:
    def query_capabilities(self) -> dict:       # 查当前能力集(读状态回传)
```

设计要点：校验在 SDK 层做（能力开发者免写校验）；rosbridge 细节全部隐藏；任何客户端（DSH 插件 host / Python 脚本）用同一份 SDK。

### 10.7 扩展性与适应性四原则

1. **能力接口标准化**：能力 = 工具 + manifest + SDK，加新末端按 `capability-spec.md` 模板写能力目录，不改框架；
2. **消息契约版本化**：schema 文档化，桥两端独立演进；
3. **能力与 preset 解耦**：能力不依赖 preset（preset 不装配能力，只感知）；preset 不依赖具体能力；
4. **仿真/真机同接口**：只换 L3 底层（`ros2_control hardware_interface`），L1/L2/L4 不动。

---

## 11. 评测方法

### 11.1 维度与做法

- **机器人维度（`eval/robot`）**：IK 精度/成功率/耗时、三种轨迹插值对比、控制频率/抖动/延迟——对照 §11.2 公开基线。
- **AI 编排维度（`eval/agent`）**：agent vs 脚本 oracle vs random，成功率 + 步数——证明「agent 自适应编排有意义」。
- **热插拔维度（`eval/hotplug`）**：§11.3 五项验收。
- **场景级对比（`eval/native_swap`）**：同一 MuJoCo 双臂场景，「ROS2 原生换末端（停节点→改配置→重启→重连）」vs「本项目热插拔（挂载/卸载）」，测耗时与人工步骤——**必须实测，不预填**。

### 11.2 机器人维度公开基线

| 维度 | 基线/典型值 | 来源 |
|---|---|---|
| 控制频率 | 1 kHz（工业臂事实标准） | NTNU 论文（robot loop at 1kHz） |
| 抖动/延迟 | 抖动 μs 级、单周期 <1ms | 同上 |
| IK 求解 | IKFast μs 级；KDL ms 级（成功率 50~80%）；TRAC-IK 95%+；QuIK <100μs | MoveIt 文档 / QuIK / GeoFIK |
| IK 误差 | 解析 ~1e-12；数值 ~1e-6 | 通用数值 |
| 轨迹跟踪 | 良好控制位置误差 <1mm 量级 | 工程惯例 |
| 重复定位精度（真机参考） | 工业臂 ±0.01~0.1mm；Franka ±0.1mm | 产品规格 |

### 11.3 热插拔验收（DESIGN 验证指标）

| 指标 | 验收标准 |
|---|---|
| 插入即见 | 挂载后 agent 立即能调用新工具（无需重启） |
| 拔出即回收 | 卸载后无残留订阅/连接（可观测 teardown） |
| 同名不串台 | 两个同型能力注册不冲突、调用不串 |
| agent 无感切换 | 换版（卸载旧/挂新）期间任务成功率不下降 |
| 失败回滚 | 新版本激活失败后旧能力仍可用 |

### 11.4 待实测项（禁止预填）

- 「纯 ROS2 原生换末端」的耗时/步骤：无公开数据，必须在我们的场景里实测。
- agent 自适应策略的成功率/步数：跑完 `eval/agent` 才有。

---

## 12. 局限与未来

- 只覆盖**软件能力层**热插拔；硬件层（电气/连接）、硬实时、安全边界不在本项目范围。
- 未来：真实硬件（`ros2_control hardware_interface`）、跨进程/跨机热插拔、与数据闭环/世界模型结合（demo 14/15）。

## 13. 披露与时间戳

首次公开 commit、FreeTSA 时间戳回执、发布链接见 [`disclosure-log.zh.md`](disclosure-log.zh.md)（`docs/timestamps/` 下回执**勿动**）。

## 14. 参考文献

- Software Reconfiguration in Robotics (EMSE 2024): https://link.springer.com/article/10.1007/s10664-024-10596-9
- AICA: https://docs.aica.tech/docs/concepts/building-blocks/components/ · https://aica-technology.github.io/modulo/
- OpenRAL: https://discourse.openrobotics.org/t/openral-the-agentic-harness-for-physical-ai-ros-2-native/56352
- MuJoCo Menagerie: https://github.com/google-deepmind/mujoco_menagerie
- mujoco_ros2_control: https://github.com/ros-controls/mujoco_ros2_control
- IK 基线: MoveIt IK 文档 · QuIK · GeoFIK (arXiv:2503.03992)
- DSH: https://github.com/deepseek-ai/deepseek-harness
