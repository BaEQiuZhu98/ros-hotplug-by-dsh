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
- **结果**：实现并验证五项指标——**插入即见、拔出即回收、同名不串台、agent 无感切换、失败回滚**；并叠加可靠性设计（校验、多版本、事件通知）。

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
| **机制** | DSH 的分层作用域（臂作用域/感知槽） + 父链继承 + Cordis `dispose` + 能力版本目录与挂载句柄（换版/回滚） |
| **场景** | 具身机器人的能力热插拔：末端执行器（夹爪 ↔ 吸盘）、传感器、技能的运行时增删换 |
| **实现** | 可复现的 `demo/13-hotplug`（末端执行器类）与源码工程 `src/`（含传感器类视觉感知热插拔），含可靠性设计与评测 |

### 4.3 明确不主张（边界）

| 不主张 | 原因 |
|---|---|
| 发明「时空组合性」 | 是 DSH（Cordis + scope）既有机制 |
| 第一个做「机器人热插拔」 | ROS2 生命周期节点、AICA、Eclipse Muto 等早已存在 |
| 第一个做「agent 控制 ROS」 | OpenRAL、RoboNeuron 等已有 |
| 硬件层/硬实时/电气安全热插拔 | 本项目只覆盖「软件能力层」 |

### 4.4 主张的验证与升级路径

- 未见于公开资料：定期检索并记录（关键词见 `novelty.zh.md`）。
- 可复现：按 `demo/13-hotplug` README 能跑通并复现 §11.3 热插拔验收指标。
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

> 本节机制的接口以运行时 `cordis_inspect` 查询为准。项目验证环境: DSH 侧 Cordis `4.0.1`、
> `@deepseek-ai/dsh-scope` `0.1.0-rc.7`(rc 阶段上游不承诺兼容, 上游升级后需按运行时复核)。

### 7.1 作用域层级

```
层 0  全局(机器)            宿主组合挂载, 所有 agent 向下继承
   ├─ sim_bridge(ROS2 进程)     可视化回显(运动学正解状态, 非接触判定): 双臂关节/末端/小球状态
   ├─ 能力挂载服务(host 常驻)    准入检查 + 臂/槽上下文管理 + 实例注册; 不注册 agent 工具
   ├─ web 面板(host + client)   唯一写入口(装/卸末端与感知, 设定小球, 复位)
   └─ tools 注册表(宿主服务)     工具注册的层容器

层 1  agent(任务 agent)      robo preset 挂载(每会话)
   ├─ persona                  「感知末端状态, 自适应决策, 不做低层控制, 不感知末端实现细节」
   ├─ 臂管理器                  会话内为每个会话建立臂作用域与感知槽并注册上下文(事件驱动 +
   │                            执行时懒补建兜底), 提供 arm_status/take_object
   ├─ observer                  订阅 tools/change, 汇报能力集(观测能力)
   ├─ arm_status 工具           感知入口: 某臂是否具备可用末端
   ├─ take_object 工具          执行入口: 让某臂去拿东西(策略由末端实例决定)
   └─ 感知槽(perception, 标签 = agent key 本身)   sensor 类能力挂载点: detect_ball 对 agent 可见;
                                                  其拦截器沿父链命中臂层事件(视觉注入执行链)

层 2  机械臂 armA / armB     createScope(armManagerCtx, armKey, { parent: 会话 agent 作用域 }), 每个会话一套
   └─ 该臂的末端能力实例(挂/卸都发生在这层; 对 agent 不可见——父不视子)

层 3  末端实例              带策略能力插件(§10.3), 挂在臂层上:
   ├─ armA 挂 grasp  -> 夹取策略实例(同名注册 manipulate)
   └─ armB 挂 suction -> 吸附策略实例(同名注册 manipulate)
```

热插拔的对象 = **带策略的能力实例**(末端挂臂层、传感器挂感知槽), 在注册的上下文上生灭; 同名实例靠作用域隔离, 互不串台. 事件沿父链向上冒泡(臂层发出的执行链事件经 agent 层被感知槽拦截器命中), 工具/服务可见性沿父链向下继承——两条方向相反的语义共同构成分层。

### 7.2 作用域与可见性

- 层 0 注册的内容对所有 agent 可见(全局继承).
- 臂层在 agent 之下, **子层不上浮**到工具表: agent 不直接看到末端实例, 经 `arm_status` /
  `take_object` 访问(§7.5); 查询按臂作用域解析(`tools.get(name, armKey)` 的现成语义).
- armA 与 armB 是同级的两个作用域: 同名 manipulate 实例各自独立、互不遮蔽、互不串台.
- 事件放行向上扩展: 臂层挂/卸触发 tools/change, observer 在 agent 层收到.

### 7.3 capabilities 准入检查(配置表, 不是作用域)

| 问题 | 落点 |
|---|---|
| 末端**能不能**挂(完整性/来源) | mount_guard: host.js 的 sha256 与 manifest 比对, 不通过直接拒绝(实现为挂载服务内联 sha256 校验) |
| 这条臂**允许**挂什么 | 挂载服务按 kind 路由: 臂挂载点只接受 end-effector 类能力; 同臂防重/替换规则 |
| 现在挂的是什么 | 挂载服务按臂记录 {arm, cap, version, 实例句柄} |
| 挂到**哪**、何时生灭、谁看得见 | 作用域(臂层), 不是配置表 |

配置表只做「放行/拒绝」, 从不持有实例. 检查顺序: sha256 → kind/防重规则 → 落位(臂作用域注册).
全局机械臂清单的唯一权威 = 挂载服务组合行的 `config.arms`(默认 A/B); 面板渲染、
臂管理器建作用域与挂/卸校验均从 `list().arms` 动态跟随(物理仿真模型与消息契约另行扩展).

### 7.4 agent 的角色: 感知与自适应

- **agent 不控制「自己具备什么末端」**, 也**不感知末端的实现细节**(夹爪/吸盘是实例内部的事):
  末端的挂载/更换由**人 / 平台 / 运维**完成(外部事件), agent 只感知「这条臂是否具备可用末端」.
- **agent 没有挂载权限**: 挂载/卸载的唯一写入口是 web 面板(人点击)→ 能力挂载服务;
  agent 的工具表里没有挂/卸工具, 物理上无法修改末端装配(§7.11).
- agent 的职责:
  1. **感知**: 调 `arm_status(arm)` 判断该臂是否具备可用末端(只读布尔, 不看型号);
  2. **决策**: 对**同一个语言命令**(如「抓小球」, 不含「用夹爪」这种限定)按感知结果决策:
     有可用末端 → 调 `take_object(arm)` 执行; 无末端 → 报告「当前没有末端执行器, 无法抓取」;
  3. **执行**: 调 `take_object(arm)`, 具体的夹取/吸附策略由该臂当前末端实例内部完成.
- 热插拔发生时: agent 收到事件 → 更新感知 → **之后同一条命令自动换策略**(同一 API,
  实例已换成新末端) . 这就是「agent 无感 + 自适应」的完整含义.

### 7.5 agent 工具接口(屏蔽末端实现细节)

| 工具 | 语义 | 返回 |
|---|---|---|
| `arm_status(arm)` | 感知: 该臂是否具备可用末端 | `{ready: true/false}`; false 时含原因(无末端/物理不匹配) |
| `take_object(arm)` | 执行: 让该臂去拿东西 | 结构化结果(命中/未命中/失败 + 原因) |
| `detect_ball()` | 显式感知(视觉能力挂载时可见): 查询小球位置 | `{ok, ball}` 或失败原因 |

- agent 的决策面只有 `ready` 一个布尔, prompt 不含任何末端型号知识;
  换末端、加新末端(拧螺丝/焊接)不改 persona 与工具接口.
- 末端实现细节(夹取策略/吸附策略)全部在实例内部; 观测与解释由 observer 日志
  与 sim_bridge 状态回传承担(不靠 agent 输出).
- 能力实例同名注册 `manipulate`(每臂一个), 臂间靠作用域隔离; agent 不直接调用它,
  `take_object(arm)` 在会话内按臂作用域找到当前实例并分派.

### 7.6 多 agent

- **任务 agent**(主): 感知 + 决策 + 调用 take_object(如上).
- **观测 agent**: 订阅 tools/change 与状态回传, 汇报「当前能力集合 / 热插拔日志」(可靠性点「事件通知」). 双通道感知分工: tools/change 是**推送通道**(末端增删时事件自动广播, 观测汇报当前以 host 进程日志呈现), arm_status 是**查询兜底**(任意时刻按臂拉取); agent 决策以 arm_status 为准.
- **评测 subagent**: 委托跑 `eval/`.

### 7.7 初始化状态

**进程启动(dsh web + rosbridge + sim_bridge)之后**: sim_bridge 双臂伸直、末端无(none)、
小球在初始位置; 挂载服务读能力仓库清单与准入规则, 无任何末端挂载; 面板渲染仓库清单与两臂空状态.

**创建 robo 会话(agent 初始化)之后**: persona/observer/arm_status/take_object 就绪;
臂管理器为该会话建立 armA、armB 两条**空**臂作用域与感知槽(挂载点就位, 无末端实例;
错过事件或恢复的会话在首次执行 arm_status/take_object 时懒补建).
此时 agent 对「抓小球」如实报告「当前没有末端执行器, 无法抓取」.

### 7.8 装载末端的流程(以「给臂 A 装夹爪 grasp@1.2.0」为例)

| # | 谁 | 干什么 |
|---|---|---|
| 1 | 人(面板 client) | 臂 A 下拉框选「grasp 1.2.0」→ host.call arm_mount{arm:A, cap:grasp, version:1.2.0} |
| 2 | 面板 host | 转发能力挂载服务 mount(cap, version, {arm})(臂名/槽位合法性由挂载服务校验) |
| 3 | 挂载服务 | **准入检查**: 读仓库目录 → sha256 与 manifest 比对(不通过 → 拒绝, 流程终止) |
| 4 | 挂载服务 | **防重/替换检查**: 臂 A 已挂同 cap@version → 拒绝(同臂防重); 已挂别的 → 先卸载(替换); 未挂 → 放行 |
| 5 | 挂载服务 | 动态 import host.js(带策略插件模块), 准备在臂上下文上挂载 |
| 6 | 挂载服务 | 在**全部已注册的 armA 上下文**(每会话一套)上 ctx.plugin(插件) → 插件 apply 注册 manipulate 实例(同名, armA 层); fiber.await 确认激活; 失败回收并拒绝 |
| 7 | 挂载服务 | 记录 {armA: grasp@1.2.0, 句柄}; tools/change 广播(observer 收到, 更新能力集汇报); 之后新注册的会话上下文自动补挂当前末端 |
| 8 | 面板 host | 挂载 ok → 物理装配 set_tool(A, grasp)(sim_bridge 臂 A 末端变白(夹爪); 物理失败仅告警, 不回滚已成功的注册) |
| 9 | 面板 client | 刷新状态: 臂 A 下拉框显示当前装配 grasp@1.2.0 |
| 10 | agent | 下次 arm_status(A) = {ready: true}; take_object(A) 自动走夹取策略 |

卸载为对称流程: 面板选「不装配」→ 挂载服务查臂句柄 → 在各 armA 上下文上 fiber.dispose(实例注销,
不影响 armB) → 面板 set_tool(A, none)(末端复位) → 状态刷新.

### 7.9 拿小球指令的流程(以「用臂 A 去拿小球」为例)

前置: 臂 A 已挂 grasp(夹取策略实例), 臂 B 已挂 suction(吸附策略实例).

| # | 谁 | 干什么 |
|---|---|---|
| 1 | 人(面板 client) | 拿小球行选「臂 A」→ 点「去拿小球」→ inputActions 发送消息「用臂 A 去拿小球」(面板不判断、不执行) |
| 2 | agent | 收到指令, persona 驱动: 先感知 → 调 arm_status(A) |
| 3 | 臂管理器/observer | 按臂作用域查询返回 {ready: true} |
| 4 | agent | 决策: 臂 A 有可用末端 → 调 take_object(arm: 'A') |
| 5 | 会话内分发 | 按臂作用域找到 armA 层当前 manipulate 实例 → 调实例.execute() |
| 6 | 末端实例(夹取策略) | 感知物理末端(必须匹配, 否则报错, 绝不改变装配) → 经瀑布执行链 manipulate_execute 编排: 视觉能力已挂时拦截器注入小球位置(精准), 无视觉时按该臂盲抓预设点(A=[0.3,-0.3], B=[0.3,0.3]) → SDK move_to(收敛完成式) |
| 7 | sim_bridge | IK 求解, 臂 A 移向目标, /joint_state 回传(含 ee 与 ball) |
| 8 | 末端实例 | move_to 返回即已到位; 末端与球距离 < 0.05 m 判「命中」, 否则「未命中」, 返回结构化结果 |
| 9 | agent | 收到结果, 如实汇报(感知到什么/做了什么/结果如何) |

**分支**:

- 臂 A 无末端: arm_status(A) = {ready: false} → agent 报告「臂 A 没有末端执行器, 无法拿」.
- 末端已挂但物理不匹配: 实例第 6 步报错 → agent 如实报告.
- 换末端后同一句指令: 面板把 A 换挂 suction 后, 同一句「用臂 A 去拿小球」→ arm_status(A)
  仍 ready → take_object(A) → 实例已是吸附策略 → agent 无感自动换策略.
- 视觉热插拔(传感器类): 感知槽挂 camera_detect 后, 其拦截器在瀑布执行链上注入小球位置 →
  「盲抓未命中」变为「精准命中」; 卸载视觉后拦截器随 fiber 自动摘除, 回退盲抓; 视觉异常时
  fail-open 放行盲抓, 拿球链路不中断.
- **执行链注入仅对 grasp 1.2.0 生效**: 1.0.0/1.1.0 与 suction 不发射瀑布执行链事件, 挂视觉时
  拦截器静默不生效——旧版本与吸盘执行的是 `touch`(sim_bridge 按小球实时位置 IK 直碰球,
  发布即回、无命中判定), 属换版演示版本; 精准抓与命中判定以 1.2.0 为准.

### 7.10 热插拔机制

| 操作 | 机制 | 效果 |
|---|---|---|
| 挂载末端 | 准入检查后在**全部已注册的该臂上下文**(每会话一套)运行时注册实例(`ctx.plugin`) | 立即生效, **不重启** |
| 卸载末端 | 各臂上下文 `fiber.dispose()`(异步, 精确回收) | 精确回收其订阅/连接, 不影响另一臂 |
| 替换末端 | 卸载旧实例 + 挂载新实例(能力仓库按版本目录并存) | agent 无感, 同一 take_object 自动换策略 |
| 同名隔离 | 臂作用域: 同名 manipulate 实例并存, 各自生灭 | 两个末端实例互不串台 |
| 失败回滚 | 换挂先摘旧再挂新(存在短暂窗口), 失败自动恢复旧实例; 多会话部分恢复时返回 restored:'partial' 并逐会话告警 | 注入坏版本 → 旧末端恢复可用 |
| 变化感知 | 事件广播(tools/change) + agent 订阅 | agent 自动感知末端增删 |
| 会话自适应 | 新/恢复会话懒补建上下文, 挂载服务向新上下文补挂当前能力 | 任何会话的该臂上下文始终带当前末端 |

### 7.11 写路径与读路径分离(唯一写者 = 人)

```
写路径(唯一):  人 ──点击──► web 面板 ──RPC──► 能力挂载服务(准入 + 臂上下文挂/卸)
读路径(agent): 任务 agent ──► arm_status(感知) + take_object(执行, 只读使用)
               观测 agent ──► tools/change 事件 + 状态回传(只读订阅, 汇报能力集)
```

- 能力挂载服务与臂管理器都是**组合挂载的真实插件**, 不是动态沙箱插件: 动态插件的沙箱
  ctx 隐藏 `ctx.plugin`/`fiber` 等框架内部, 而挂载/卸载需要这两条运行时原语.
- 挂载与卸载是异步动作: `ctx.plugin` 返回后 apply 尚未跑完, `dispose` 返回后回收尚未完成;
  挂载流程等待 `fiber.await()` 确认激活, 卸载流程 await dispose 完成.
- agent 拿不到挂/卸工具 = 作用域天然隔离, 不靠 persona 规劝.
- **信任边界(如实声明)**: 面板 `/cap-mount` 路由无鉴权, 任何能访问该 web 服务的请求都可写入挂载;
  本项目定位为单用户可信环境(本机回环 + 单人操作), 不构成多用户安全边界. 需要多用户/远程
  部署时, 应先补鉴权再开放写入口.

### 7.12 一次完整交互(演示的目标表现)

1. 场景: 双臂 + 小球, 两臂都无末端.
2. 用户: 「**抓小球**」. agent 感知: arm_status 均为 not ready → 回复「当前没有末端执行器, 无法抓取」.
3. 人热插拔: 在面板给臂 A 挂上 grasp 末端能力(夹取策略实例).
4. 用户再说「**抓小球**」. agent 感知: 臂 A ready → 调 `take_object(A)` → 实例走夹取策略 → 臂 A 末端变白(夹爪)、移到小球(抓取).
5. 人热插拔: 在面板把臂 A 的 grasp 换成 suction(卸载旧实例、挂载吸附策略实例).
6. 用户第三次说「**抓小球**」. agent 感知: 臂 A 仍 ready → 再调 `take_object(A)` → 实例已换成吸附策略 → 末端变黑(吸盘)、移到小球(吸附).

> 核心看点: **同一句命令、同一个 API, agent 三次给出与末端状态匹配的结果**;
> 切换全程 agent 无感、机器人不停机, 且 agent 从头到尾不知道「夹爪/吸盘」这些实现细节.

---

## 8. 可靠性设计（工程实践 → 项目）

| 工程实践 | 本项目落点 | 验证方式 |
|---|---|---|
| 完整性哈希校验 | 末端挂载前 manifest / 哈希校验，不合法拒绝 | 传入篡改 manifest → 拒绝挂载 |
| 多版本共存 | 同一末端能力多版本并存(能力仓库版本目录) | 同臂换版、多臂不同版本并存不冲突 |
| 换版切换 | 卸载旧实例 + 挂载新实例，agent 无感 | 同一 API 自动换策略 |
| 失败自动回滚 | 换挂失败自动恢复旧实例 | 注入故障 → 旧末端恢复可用 |
| 发布/订阅事件通知 | 末端增删广播事件，agent 订阅感知 | 挂载/卸载时事件被收到 |
| 硬件差异屏蔽层 | agent 只感知 ready, 夹取/吸附策略在实例内部 | 换末端后同一 API 自动换策略 |
| 资源精确回收 | 臂作用域隔离 + dispose 精确回收 | 卸载后无残留连接/状态 |

### 8.1 各可靠性点的机制与落地

| # | 可靠性点 | DSH 机制 | 怎么证明 |
|---|---|---|---|
| 1 | 零信任/哈希校验 | 挂载守卫(挂载服务内) + 臂作用域注册 | 篡改 manifest 哈希 → 拒绝挂载 |
| 2 | 多版本共存 | 能力仓库版本目录并存 | 各臂可挂不同版本、互不覆盖 |
| 3 | 换版切换 | 卸载旧实例 + 挂载新实例 | 切换期间 API 不变, agent 无感 |
| 4 | 失败回滚 | 换挂先摘旧再挂新(短暂窗口), 失败自动恢复旧实例(尽力) | 注入坏版本 → 挂载失败 → 旧末端恢复可用 |
| 5 | 事件通知 | `tools/change` 广播为推送通道(观测日志呈现), arm_status 查询兜底 | 挂/卸时监听器收到事件 |
| 6 | 同名隔离 | 臂作用域: 同名 manipulate 实例并存 | 两臂同名末端注册不串台 |
| 7 | 不泄漏 | 臂作用域 + Cordis dispose | 卸载后确认无残留订阅/状态 |

> **零信任/哈希校验的威胁模型**：能力可能来自**外部分发**或 **agent 现场生成**（大模型会幻觉、可被注入诱导），也可能在**存储/流转中被篡改**。因此「每次挂载都假设不可信，先验身再上机」——哈希证明「没被改过」。签名验证不在本项目范围。

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

**触发换平台的时点**：照片级视觉/模仿学习方向 → 上 Isaac Sim + Isaac Lab；要强调 ROS 全栈/传感器/导航 → 补 Gazebo。模型用 MuJoCo Menagerie（现成 Franka/Unitree）。

---

## 10. 源码工程与交付件

### 10.1 目录结构

```
ros-hotplug-by-dsh/
├── README.zh.md / README.md        # 本文件（中 / 英）
├── LICENSE / .gitignore
├── src/                            # 源码工程(见 src/README.zh.md)
│   ├── setup.sh                    #   一键安装(路径集中化: 挂载服务行 / 面板包 / robo preset)
│   ├── capabilities/               #   ★ 能力仓库 + 挂载服务 + 规范
│   │   ├── capability-spec.md      #     能力开发规范(模板 + manifest + 挂载流程)
│   │   ├── mount_service/          #     能力挂载服务(host 常驻: sha256 准入 + kind 路由 + 臂/槽上下文管理 + 常驻 bridge daemon)
│   │   ├── repo/                   #     能力仓库目录(一等交付件): grasp/1.0.0|1.1.0|1.2.0、suction/1.0.0、camera_detect/1.0.0
│   │   └── pack.sh                 #     可选发布外壳: 仓库目录打包成 npm tarball(公开分发用)
│   ├── packages/                   #   树外包 npm 包(安装形态: profile node_modules)
│   │   └── cap-mount-panel/        #     能力面板(双面: host /cap-mount 路由 + client tsdown bundle)
│   ├── presets/                    #   运行载体
│   │   └── robo/                   #     机器人任务 agent preset(组合 + persona + skills)
│   │       └── arm_manager/        #       臂管理器树外包包(臂作用域/感知槽 + 工具)
│   ├── ros2/                       #   机器人侧(colcon 包; build/install/log 为构建产物不入库)
│   │   ├── cpp_control/            #     C++ 1kHz 标量 PID 控制环 + 频率/抖动/耗时实测
│   │   └── sim_bridge/             #     Python 仿真桥(MuJoCo + rclpy)
│   ├── bridge/                     #   桥接契约
│   │   ├── contract.md             #     话题/消息 schema(v1.2)
│   │   └── bridge_client.py        #     rosbridge 客户端(SDK 薄封装)
│   └── sim/                        #   可视化仿真资源
│       ├── models/                 #     MJCF: two_arm_scene.xml(双臂 + 小球)
│       └── scenes/                 #     预置场景说明
├── eval/                           # ★ 评测
│   ├── robot/                      #   IK 耗时量级(对照公开基线)
│   ├── agent/                      #   任务集与口径(agent vs oracle vs random 评测)
│   ├── hotplug/                    #   热插拔验收套件(assemble-env.sh + drivers + fixtures)
│   ├── tests/                      #   pytest 门禁与实时套件
│   ├── lib/                        #   robenv + 结果聚合(summary.py)
│   └── results/                    #   评测记录(run-* 目录, 不入库)
├── demo/                           # 教学目录(00~13, 见 demo/README.zh.md)
├── docs/                           # design / novelty / glossary / 时空组合性 / disclosure-log(+ timestamps / assets 演示 gif)
└── plugins/                        # 动态插件归档(两个工作流插件)
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

### 10.3 L1 能力与挂载体系（热插拔本体）

- **一等交付件 = 能力仓库目录**：`repo/<capability>/<version>/{host.js, manifest.json}`。host.js 是
  ESM `{apply, inject, name}` 插件，**零依赖**；manifest.json 记录元数据 + host.js 的 sha256。
- **能力 = 带策略的末端实例**：每个能力是「末端硬件 + 驱动策略」的完整单元(grasp = 夹取策略,
  suction = 吸附策略), apply 在**臂作用域**注册同名 `manipulate` 工具, execute 内实现策略
  (感知物理末端匹配 → 执行策略步 → 状态校验), **绝不改变装配**.
- **npm 树外包 = 可选发布外壳**：`pack.sh` 把仓库目录打包成 tarball 分发到机器, 解包进仓库后走同一条挂载流程.
- **能力挂载服务(mount_service)**：host 常驻插件(组合挂载, 非动态沙箱). 职责 = **准入检查**
  (sha256 校验 + kind 路由: 臂挂载点只接受 end-effector, 感知槽只接受 sensor + 同点防重/替换; 换挂失败恢复返回值分全量 true / 部分 'partial' / 失败 false 三态) +
  **上下文管理**(臂管理器注册的每会话臂作用域与感知槽; 新上下文注册时自动补挂当前能力; 会话
  注销时对称摘除); `ctx.plugin`/`fiber.dispose` 由挂载服务在对应上下文(作用域)上执行(§7.1).
  写入口 = web 面板 RPC; **不注册任何 agent 工具**.
- **API 形式**：DSH 标准 Tool 契约; 热插拔 = DSH 的运行时挂载机制(ctx.plugin/dispose), 仓库目录是被热插拔的载体.

### 10.4 L2 运行载体（agent preset）

- **形态**：一个**目录**（`~/.dsh/.agent-presets/robo/`），不是 npm 包.
- **内容**：`agent.cordis.yml`(组合: persona 行 + observer 行 + **臂管理器行**(为每个会话建立 armA/armB
  作用域与感知槽并执行挂/卸) + arm_status/take_object 工具行 + skills 挂载; **不含能力包行**——末端装配由
  挂载体系负责, preset 只感知与执行)、persona(「感知末端状态, 自适应决策, 不做低层控制,
  不感知末端实现细节」)、skills.
- **功能**：装上后新建会话选「robo」= 开箱即用的机器人任务 agent; 观测插件订阅 `tools/change` 汇报能力集.
- **API 形式**：cordis.yml 组合声明(插件行/作用域) + persona/skill 文本.

### 10.5 L3 机器人侧（ROS2 包）

- **包**：`cpp_control`（C++/rclcpp）、`sim_bridge`（Python/rclpy + MuJoCo）。
- **功能**：`cpp_control` = 1kHz 标量 PID 控制环 + 频率/抖动/耗时实测(积分项按目标周期, 无轨迹跟踪与延迟测量)；`sim_bridge` = 订阅桥指令、驱动 MuJoCo、`--view` 可视化、发布状态回传（双臂场景 `two_arm_server.py`）。
- **API 形式**：ROS2 消息契约（见 L4）。
- **与现成框架的关系**：教学/评测**手写**（学原理、测精确）；接真机时按契约换用 `ros2_control`/`MoveIt2`、仿真桥可换 `mujoco_ros2_control`（ros-controls 组织维护，已查证）。手写与用现成不冲突——L3 接口留给现成框架替换，这正是适应性。

### 10.6 L4 桥接契约（对外 API，本项目唯一自造 API）

**第一层：消息契约（`bridge/contract.md`）**

```text
契约(完整定义见 bridge/contract.md)
  话题 /tool_config    类型 std_msgs/String  载荷 "ARM:TOOL"  语义 切末端执行器
  话题 /ball_position  类型 std_msgs/String  载荷 "x,y"       语义 设置小球位置
  话题 /touch_command  类型 std_msgs/String  载荷 "A"|"B"     语义 选臂触碰小球
  话题 /move_to        类型 std_msgs/String  载荷 "ARM:x,y"   语义 该臂末端收敛移动到指定 XY
  话题 /home_command   类型 std_msgs/String  载荷 "A"|"B"     语义 该臂关节回原位
  话题 /reset_command  类型 std_msgs/String  载荷 "reset"     语义 全部复位(关节归零/末端卸下/小球回初始)
  话题 /joint_state    类型 std_msgs/String  载荷 JSON         语义 状态回传(joints/tools/ball/ee, 10 Hz)
```

**第二层：Python 薄 SDK（能力实例/DSH 插件 host 共用）**

```python
class Bridge:
    def set_tool(self, arm, tool) -> dict:      # 校验 arm∈{A,B}, tool∈{grasp,suction,none}; 返回 {ok, error}
    def set_ball(self, x, y) -> dict:           # 校验数字; 返回 {ok, error}
    def touch(self, arm) -> dict:
    def move_to(self, arm, x, y, timeout=3) -> dict:  # 收敛完成式; 返回 {ok, ee, ball}
    def home(self, arm) -> dict:                # 单臂关节回原位
    def reset(self) -> dict:                    # 全部复位
    def query_capabilities(self) -> dict:       # 查当前状态(读 /joint_state 回传)
```

设计要点：校验在 SDK 层做（能力开发者免写校验）；rosbridge 细节全部隐藏；任何客户端（DSH 插件 host / Python 脚本）用同一份 SDK。

### 10.7 扩展性与适应性四原则

1. **能力接口标准化**：能力 = 带策略实例 + manifest, 对 agent 只暴露 arm_status/take_object;
   加新末端按 `capability-spec.md` 模板写能力目录, 不改框架、不改 agent 接口;
2. **消息契约文档化**：schema 文档化, 桥两端按同一份契约实现;
3. **能力与 preset 解耦**：能力不依赖 preset(preset 不装配、不感知末端型号, 只感知 ready);
   preset 不依赖具体能力;
4. **仿真/真机同接口**：只换 L3 底层(`ros2_control hardware_interface`), L1/L2/L4 不动.

---

## 11. 评测方法

### 11.1 维度与做法

- **机器人维度（`eval/robot`）**：IK 精度/成功率/耗时、三种轨迹插值对比、控制频率/抖动/延迟——对照 §11.2 公开基线。
- **AI 编排维度（`eval/agent`）**：agent vs 脚本 oracle vs random，成功率 + 步数——证明「agent 自适应编排有意义」。
- **热插拔维度（`eval/hotplug`）**：§11.3 五项验收。

### 11.2 机器人维度公开基线

| 维度 | 基线/典型值 | 来源 |
|---|---|---|
| 控制频率 | 1 kHz（工业臂事实标准） | NTNU 论文（robot loop at 1kHz） |
| 抖动/延迟 | 抖动 μs 级、单周期 <1ms | 同上 |
| IK 求解 | IKFast μs 级；KDL ms 级（成功率 50~80%）；TRAC-IK 95%+；QuIK <100μs | MoveIt 文档 / QuIK / GeoFIK |
| IK 误差 | 解析 ~1e-12；数值 ~1e-6 | 通用数值 |
| 轨迹跟踪 | 良好控制位置误差 <1mm 量级 | 工程惯例 |
| 重复定位精度（真机参考） | 工业臂 ±0.01~0.1mm；Franka ±0.1mm | 产品规格 |

> **对照口径说明(如实)**: 当前已实测的是 2-DOF 教学臂的解析 IK 耗时(`eval/robot/ik_timing.py`),
> 与表内 IK 求解器基线(6-DOF 通用)同量级对照仅作参考, 不构成同条件可比结论; 控制频率/
> 抖动/轨迹跟踪/IK 误差/重复定位精度尚无落地实测(评测状态以 `eval/results/SUMMARY.md` 为准).

### 11.3 热插拔验收（DESIGN 验证指标）

| 指标 | 验收标准 |
|---|---|
| 插入即见 | 挂载后 agent 立即感知 ready 并可用(无需重启) |
| 拔出即回收 | 卸载后无残留订阅/连接(可观测 teardown) |
| 同名不串台 | 两臂挂同名末端实例不冲突、调用不串 |
| agent 无感切换 | 换末端/换版期间同一 API 自动换策略, 任务成功率不下降 |
| 失败回滚 | 换挂失败后自动恢复旧实例, 旧末端仍可用 |

### 11.4 待实测项（禁止预填）

- agent 自适应策略的成功率/步数：跑完 `eval/agent` 才有。

---

## 12. 局限与未来

- 只覆盖**软件能力层**热插拔；硬件层（电气/连接）、硬实时、安全边界不在本项目范围。
- **挂载记录为进程内存态(边界声明)**: DSH 侧重启后挂载记录清空, 而 sim_bridge 物理末端不变——
  重启后需在面板重新挂载(新会话的臂上下文会懒补建并补挂当前能力); `reset_all` 在桥接不可用时
  逻辑态已卸载而物理态可能残留, 属「逻辑-物理对账」未实现的已知边界.
- **链路延迟特性(如实说明)**: 感知-执行经 rosbridge 桥接, 常驻化后单次 SDK 调用约 100 ms
  (本机实测: query_capabilities 平均 100 ms, 受 10 Hz 状态回传间隔主导; 纯发布类调用平均 101 ms,
  受发送 flush 主导)——属监控/任务级延迟, 不是实时控制; 实时性在 cpp_control 1 kHz 层.
- 未来：真实硬件（`ros2_control hardware_interface`）、跨进程/跨机热插拔、照片级视觉与数据闭环/世界模型结合。

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
