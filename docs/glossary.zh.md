# 名词概念速查（glossary）

> 集中记录本项目涉及的名词、特性、概念，供复习与面试速查。表格列为「名词 / 一句话含义 / 对应项目实现点」。

---

## 1. DSH / Cordis 核心概念

| 名词 | 一句话含义 | 对应项目实现点 |
|---|---|---|
| 时空组合性 | 空间（谁看得见谁）+ 时间（谁在何时生灭）+ 锚点契约的组合原语 | 本项目新颖性主张的核心 |
| 插件 / 插件行 | DSH 里「一切皆插件」，能力由组合文件里的插件行声明 | 能力 = 一个插件行 |
| 组合（composition）/ cordis.yml | 声明插件行的组合文件，决定一个 agent/preset 长什么样 | 生产 preset 的 `agent.cordis.yml` |
| 作用域（scope）/ 层（layer） | 能力分层的摆放位置：全局层 → preset 常驻层 → 每 agent 层 | 能力挂到 robot 作用域才对 agent 可见 |
| 父链继承 | 注册视图向下继承：子作用域看得见祖先各层 | agent 看得见 preset 的能力 |
| nearest-wins（遮蔽） | 同名能力时最近者胜出 | 同型末端同名遮蔽（硬件差异屏蔽层） |
| isolate realm（隔离域） | 每个挂载会话一份私有实例，同类服务不串台 | 两个夹爪/吸盘互不串台 |
| 事件放行向上扩展 | 祖先监听器能收到子孙事件，反向不成立 | 观测 agent 订阅能力增删事件 |
| apply / effect / dispose | Cordis 生命周期：注册 → 挂副作用 → 精确撤销 | 卸载能力 = dispose 精确回收 |
| Fiber | 插件副作用的挂载点，随插件生灭 | `ctx.on`/`ctx.effect` 都挂在当前 Fiber |
| 锚点契约 | 注册的上下文同时决定可见性与生命周期 | 杜绝「看得见却已死 / 活着却看不见」 |
| 动态插件 | 进程内临时插件（`cordis_define/run/update/stop/undefine`），重启消失；沙箱 ctx 刻意隐藏框架内部（如 `ctx.plugin`） | demo 里的能力工具、工作流面板、临时探针 |
| plugin / package / run | 版本时序：插件实例 / 不可变代码版本 / 一次激活尝试 | 多版本共存、回滚 |
| 树外包（out-of-tree） | 持久、可发布的 npm 插件包（`dsh plugin add` 安装）；本项目里只作能力目录的**发布外壳** | 公开分发用，解包进能力仓库后走挂载服务 |
| 能力仓库目录 | 能力的一等交付件：`repo/<能力>/<版本>/{host.js, manifest.json}`，零依赖 | `src/capabilities/repo/` |
| 能力挂载服务 | host 常驻插件：准入检查（sha256 + 规则表）+ 臂管理；实例落位由会话内臂管理器执行；唯一写入口 = web 面板 RPC，**不注册 agent 工具** | `src/capabilities/mount_service/` |
| 臂作用域 | 每条机械臂一个子作用域（createScope(agentCtx, 'armA'/'armB')）：末端实例挂在这里，同名实例互不串台 | 热插拔的「空间锚点」 |
| 臂管理器 | 会话内插件：预建两条臂作用域，执行实例的 ctx.plugin / fiber.dispose | `src/presets/robo` |
| arm_status / take_object | agent 的两个工具：感知该臂是否可用（ready）/ 让该臂去拿东西（策略在实例内部） | 硬件差异屏蔽层 |
| profile / preset | profile=应用层启动配置；preset=agent 层组成配置（目录） | `robo` preset 是「开箱即用的机器人 agent」 |
| 工具（tool） | agent 可调用的能力，契约 = name/description/parameters/output/execute | agent 工具 arm_status/take_object；末端实例同名注册 manipulate |
| host / client 半部 | 插件在进程内(Node)与浏览器里的两半 | web 面板插件的两半部 |
| Slots 槽位 | 往 web GUI 注入 UI 的座位体系（如 `conversation.input.dock`） | 各 web 面板的挂载点 |
| Client↔Host RPC | 动态插件 client 用 `host.call` 调 host 的 `harness.handle` 方法 | 面板按钮 → host 跑桥接脚本 |
| Inspect 提供者 | 写插件前查运行时接口（`cordis_inspect_list/query/self`） | 以运行时为准，不硬编码 |
| tools/change 事件 | 工具注册/注销时广播的事件 | 可靠性点「事件通知」 |

## 2. 热插拔与可靠性名词

| 名词 | 一句话含义 | 对应项目实现点 |
|---|---|---|
| 能力（capability）/ 能力实例 | 末端硬件 + 驱动策略的完整单元（grasp = 夹取策略, suction = 吸附策略） | 带策略实例, 挂臂作用域 |
| 挂载 / 卸载 | 臂管理器在臂作用域运行时注册/撤销能力实例（`ctx.plugin` / `fiber.dispose`，不重启） | `mount_service` + 臂管理器 |
| manifest | 能力元数据 + 代码哈希 | 挂载前校验用 |
| 挂载守卫（mount_guard） | 挂载前验哈希的闸（零信任） | `src/capabilities/mount_guard.py` |
| 零信任 / 哈希校验 | 每次挂载都假设不可信，先验身再上机 | 篡改 manifest → 拒绝挂载 |
| 签名（扩展） | 证明「确实出自某人」，= 对哈希加密 | 「云端签名/加密 → 设备验签/解密」的加分项 |
| 多版本共存（主备） | 同一能力多个版本目录并存、互不覆盖 | repo 下 v1/v2/v3 目录 |
| 换版切换 | 该臂卸载旧实例 + 挂载新实例，arm_status/take_object 语义不变，agent 无感 | 臂作用域 unmount + mount |
| 回滚 | 新版本激活失败则旧句柄保留，旧能力仍可用 | 注入坏版本 → 旧能力照常 |
| 事件通知 | 能力增删广播，agent 订阅感知 | 观测 agent + `tools/change` |
| 同名遮蔽 / 硬件差异屏蔽 | 同型能力同名、就近遮蔽、不串台 | 两个夹爪实例 |
| 无泄漏 | isolate + dispose 精确回收 | 卸载后无残留 |
| 插入即见 / 拔出即回收 / 同名不串台 / agent 无感 | 四项验收指标 | 评测 hotplug 维度 |

## 3. 机器人 / 仿真 / 控制名词

| 名词 | 一句话含义 | 对应项目实现点 |
|---|---|---|
| ROS2 / rclpy / rclcpp | 机器人中间件及其 Python/C++ 客户端库 | demo 10/11 |
| 节点 / 话题 / 服务 / 动作 / TF | ROS2 计算图五要素 | demo 10 |
| 锁存话题（latched） | 中间件保留最后一条消息，晚订阅也能收到 | 静态 TF 广播 |
| rosbridge / roslibpy | ROS2 的 WebSocket 桥及 Python 客户端 | demo 12/13 桥接层 |
| MuJoCo model/data/mj_step | 静态模型 / 运行时数据 / 步进 | 所有仿真 demo |
| MJCF / mocap / Menagerie | MuJoCo 场景格式 / 运行时定位体 / 官方模型库 | 场景与现成 Franka |
| 旋转矩阵 / 欧拉角 / 四元数 / 轴角 | 姿态四种写法（等价互转） | demo 07 |
| 齐次变换（SE(3)） | 旋转+平移合成 4×4，一次搞定先转再移 | demo 07 |
| DH 参数 | 四参数（a/α/d/θ）描述关节 | demo 08 |
| FK / IK | 关节角→末端 / 末端→关节角 | demo 08 |
| 雅可比（Jacobian） | 关节速度→末端速度的映射，反推误差修正 | demo 08 数值 IK |
| 速度级逆解 | 一步把位置误差反解成关节速度 | demo 08/12 追踪 |
| 梯形轨迹 / 笛卡尔直线 / SLERP | 三种轨迹插值（速度梯形 / 位置线性 / 姿态球面） | demo 09 |
| PID（P/I/D） | 比例/积分/微分闭环控制 | demo 09/11 |
| 1kHz 控制环 | 工业臂事实标准的控制频率 | demo 11 基线 |
| 抖动 / 延迟 | 控制环间隔波动 / 单周期计算耗时 | demo 11 测量 |
| 重复定位精度 | 真机回到同一点的偏差（工业臂 ±0.01~0.1mm） | 评测参考项 |

## 4. 架构与交付件名词

| 名词 | 一句话含义 | 对应项目实现点 |
|---|---|---|
| L0~L6 交付件 | 仓库/能力/preset/机器人包/桥契约/评测/文档 六层 | 设计文档 §10 |
| 能力（仓库目录） | 一个末端/感知 = 一个能力目录（host.js+manifest+版本）；npm 包是可选发布外壳 | `src/capabilities/repo/*` |
| 能力挂载服务 | host 常驻插件：校验 manifest + 运行时挂/卸能力，唯一写入口（web 面板） | `src/capabilities/mount_service` |
| agent preset（robo） | 开箱即用的机器人 agent 配置目录（persona+observer+skills，**无能力行**） | `src/presets/robo` |
| 仿真桥（sim_bridge） | 机器人侧 Python 包：订阅桥指令、驱动 MuJoCo、可视化、反馈 | `src/ros2/sim_bridge` |
| 控制节点（cpp_control） | 机器人侧 C++ 包：1kHz 控制环/PID/延迟测量 | `src/ros2/cpp_control` |
| 桥接契约（bridge contract） | 话题/消息 schema 的版本化文档 | `src/bridge/contract.md` |
| SDK（薄封装） | 能力开发者/插件 host 共用的 Python 函数式接口（校验内置） | `src/bridge/bridge_client.py` |
| 能力开发规范 | 加新能力 = 按模板写能力目录 + 填 manifest，挂载走挂载服务，不改框架 | `src/capabilities/capability-spec.md` |
| 评测四维度 | robot / agent / hotplug / native_swap | `eval/` |
| 公开基线 | 1kHz、IK 求解器量级、<1mm 轨迹等可查证指标 | 设计文档 §11.2 |
| agent 感知与自适应 | agent 不控制末端，而是感知末端状态、对同一命令自适应选策略 | 设计文档 §7.2 |

## 5. agent / LLM 名词（简列）

ReAct 循环、CoT / reasoning_content、reasoning 回传规则、token 统计与优化、token-meter、压缩（compaction）、Agent 创建、Subagent 委托、Goal 目标循环、Plan 模式、多模型路由、Headless 模式、权限/审批/沙箱、Retry 策略、MCP 客户端、Client 插件/slots——详见 `demo/README.zh.md` 的知识速查表（含易混淆概念区分）。
