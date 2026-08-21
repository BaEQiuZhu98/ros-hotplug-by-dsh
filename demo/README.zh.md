# demo — 教学路线图（DSH 优先，机器人靠后）

> 设计原则：**先用最小 demo 学会 DSH（含 AI Coding），再用 DSH 辅助完成机器人部分，最后用 `13-hotplug` 把两者串联。** 每个 demo 都是「最小可运行、有可看输出」的独立示例，段与段代码不耦合、知识严格递进。

每个 demo 目录内都遵循同一四段式 README：
**学什么 → 怎么跑 → 观察什么 → 与最终目标什么关系**。

---

## Phase A — DSH 与 Agent 心智（先学会工具，再用工具加速学机器人）

| # | 目录 | 学什么 | 可看输出 | 与最终目标的关系 |
|---|---|---|---|---|
| 00 | `00-dsh-quickstart` | DSH 安装、headless/web 模式、跑通第一个 agent | 一段 agent 对话 | 之后所有 demo 的运行基座 |
| 01 | `01-what-is-agent` | LLM 基础、tool calling、ReAct 循环、结构化输出 | agent 连续调用玩具工具完成多步任务，打印「思考→动作→观察」轨迹 | 理解决策大脑的原理，后面 DSH agent 的底层 |
| 02 | `02-ai-coding` | 用 DSH 做 AI 辅助研发：skill、结构化文档、渐进式披露、代码审查 | 一个「项目知识 skill」+ 一段被 AI 审过的代码 | 复现你华为「AI 辅助研发」经验，且后面用它加速所有机器人 demo |
| 03 | `03-dsh-concepts` | 一切皆插件、Cordis、profile/preset/composition、tool/skill | 一张「能力=插件行」的概念图 + 一次 preset 拷贝 | 建立 DSH 心智模型 |
| 04 | `04-dsh-plugin` | 创建插件、注册工具（`ctx.tools`/`harness.registerTool`）、host/client | 一个能被 agent 调用的自定义工具 | 这是「创建 plugin」的硬性要求 |
| 05 | `05-dsh-spatiotemporal` | scope/层/域（空间）+ 生命周期/版本（时间）+ 锚点契约 | 演示：作用域遮蔽、isolate 隔离、dispose 回收 | ★ 本项目新颖性所在，`13-hotplug` 的理论基石 |

## Phase B — 机器人基础（用 DSH 辅助学，从零开始）

| # | 目录 | 学什么 | 可看输出 | 与最终目标的关系 |
|---|---|---|---|---|
| 06 | `06-ros2-mujoco-env` | ROS2 + MuJoCo 安装、环境隔离、工具链 | talker↔listener 通信 + 一个 MuJoCo 场景 | 机器人的运行基座 |
| 07 | `07-rigid-transform` | 旋转矩阵/欧拉角/**四元数**/齐次变换 + MuJoCo 场景搭建 | Franka 动起来 + 三种姿态表示互转一致 | 机器人学第一块基石 |
| 08 | `08-kinematics` | FK/DH、IK（解析 + 数值雅可比） | 给定目标位姿 → 求关节角 → 驱动到位 | 运动控制的理论核心 |
| 09 | `09-trajectory-control` | 关节梯形插值/笛卡尔直线/SLERP + PID + 控制回路 | 三种轨迹对比曲线 + 跟踪误差 | 机器人软件岗核心技能 |
| 10 | `10-ros2-basics` | 节点/话题/服务/action/tf，rclpy 节点化 | rqt_graph 看到节点连通 | 机器人中间件层 |
| 11 | `11-cpp-control` | rclcpp 迁移 + 控制频率/延迟测量 | C++ vs Python 性能对比 | 机器人软件开发岗最硬门槛 |

## Phase C — 融合与旗舰

| # | 目录 | 学什么 | 可看输出 | 与最终目标的关系 |
|---|---|---|---|---|
| 12 | `12-dsh-ros-bridge` | DSH plugin 经 rosbridge 调 ROS2 | agent 一句指令 → 机械臂动作 | 打通「DSH ↔ ROS2」 |
| 13 | `13-hotplug` | **★ 能力热插拔 + 可靠性设计**（校验/多版本/灰度/回滚/事件/隔离/回收） | 运行中增删末端执行器工具，agent 无感 | **旗舰 demo，本项目新颖性主张的实现** |
| 14 | `14-vision`（可选） | VLM / SAM 视觉定位 | 视觉定位目标物体 | 向 VLA 靠拢 |
| 15 | `15-imitation`（可选） | 行为克隆 BC + 数据闭环 | 纯推理 vs 训练策略对比 | 补齐 AI 训练能力 |

---

## 推荐学习顺序

```
00 → 01 → 02 → 03 → 04 → 05          （Phase A：DSH 心智）
                          ↓
06 → 07 → 08 → 09 → 10 → 11          （Phase B：机器人，用 DSH 辅助）
                          ↓
12 → 13                              （Phase C：融合 + 旗舰）
                          ↓
14 / 15（可选，13 之后）
```

**关键路径（必做）**：`00→…→05 → 06→…→11 → 12 → 13`。
**可选加分**：`14`（视觉）、`15`（模仿学习）。

> 注意：Phase B 的每个机器人 demo，都建议**用 Phase A 学到的「AI Coding + skill」来辅助完成**，这样既练了 DSH，又加速了机器人学习——把「学工具」和「用工具」闭环起来。

---

## 知识速查表（名词 - 功能 - 对应项目实现点）

> 汇总前面各轮讨论涉及的概念, 按「名词 / 功能 / 对应项目实现点」三列整理, 供复习与面试速查.

| 名词 | 功能 | 对应项目实现点 |
|---|---|---|
| ReAct 循环 | 思考-行动-观察循环: 模型决定调工具 → 执行 → 结果回填 → 再想 | demo/01 agent.py; demo/12-13 机器人决策循环 |
| CoT / reasoning_content | 模型内部思维链, 与最终回答(content)分离 | demo/01 可打印; web GUI 折叠"思考"块 |
| reasoning 回传规则 | 工具轮回传草稿(续接推理), 非工具轮丢弃(省 token) | token 优化; demo/13 长会话 |
| token 统计 | usage 字段: prompt/completion/cache_hit | demo/01 的 resp["usage"] |
| token 优化 | 稳定前缀吃缓存 / 自动压缩 / 渐进披露 / 结果精简 | demo/02 skill; demo/13 工具设计 |
| token-meter | 输入框旁圆环(占用%) + 统计行(turns/steps/延迟/缓存命中) | web GUI 的 composer 区 |
| 时空组合性 | 作用域(空间) + 生命周期(时间) + 锚点契约 | demo/05; demo/13 热插拔 |
| Agent 创建 | 专用 persona + 收窄工具面 + skill | demo/13 的 robo preset |
| Subagent 委托 | 横向分派自包含子任务给独立 agent | 感知/规划分工、并行消融 |
| Goal 目标循环 | 纵向拉长当前 agent 自主推进长期目标 | 自动跑完评测 |
| Plan 模式 | 先只读探索出计划, 批准后才动手 | 改机器人代码前 |
| 多模型路由 | 多 provider/模型并存, 可选路 | 成本分层、备份 |
| Headless 模式 | 无界面跑完即退 | demo/13 批量评测 |
| 压缩(compaction) | 超长历史自动总结; 工具结果裁剪(头+尾) | 长会话 |
| 权限/审批/沙箱 | 工具执行前的权限与审批边界 | demo/13 可靠性设计 |
| Retry 策略 | 请求失败在持久步骤边界自动重试 | demo/13 可靠性设计 |
| MCP 客户端 | 用标准协议接外部工具服务器 | plugin 之外接 ROS2 的另一种方式(可选) |
| Client 插件/slots | 给 web GUI 加 UI(client 半) | 机械臂状态面板(可选) |
| 动态 Cordis 插件生命周期 | cordis_define 定义不可变 package, cordis_run/update 激活, cordis_stop 停用, cordis_undefine 删除 | 本项目提交+续写/文档同步两个 web 插件; demo/13 版本时序原型 |
| Client↔Host RPC | Client 半部 host.call 调 Host 半部 harness.handle 注册的包私有 JSON 方法 | 本项目 web 插件点按钮→跑 git→回传状态 |
| Slots 槽位 + inputActions | 往 web GUI 注入 UI(conversation.input.dock 等), inputActions.setDraft+submit 触发 agent | 本项目 demo 进度面板 / 同步文档面板 |
| Inspect 提供者 | 写插件前用 cordis_inspect_list/query/self 查运行时 Service/Event/Slot/Builtin 契约 | 写插件不硬编码接口, 以运行时为准 |

### 易混淆概念区分

| 对 | 区别 |
|---|---|
| CoT vs ReAct | CoT 只在模型内部推理, 外部信息进不来; ReAct 推理中穿插真实行动, 工具结果能回来修正判断 |
| Subagent vs Goal | subagent 是"横向分派给别的 agent"; goal 是"纵向拉长当前 agent 的自主推进时长" |
| 动态插件 vs 树外包 | 动态插件=进程内临时(重启即消失); 树外包=持久可发布(简历级) |
| pressureTokens vs projectedTokens | pressure 是"上一个请求的提示词规模"; projected 是"下一个请求预计花多少"(压缩后立即反映) |
