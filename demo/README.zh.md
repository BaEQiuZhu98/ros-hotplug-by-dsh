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
| 02 | `02-ai-coding` | 用 DSH 做 AI 辅助研发：skill、结构化文档、渐进式披露、代码审查 | 一个「项目知识 skill」+ 一段被 AI 审过的代码 | 复现「AI 辅助研发」经验，且后面用它加速所有机器人 demo |
| 03 | `03-dsh-concepts` | 一切皆插件、Cordis、profile/preset/composition、tool/skill | 一张「能力=插件行」的概念图 + 一次 preset 拷贝 | 建立 DSH 心智模型 |
| 04 | `04-dsh-plugin` | 创建插件、注册工具（`ctx.tools`/`harness.registerTool`）、host/client | 一个能被 agent 调用的自定义工具 | 这是「创建 plugin」的硬性要求 |
| 05 | `05-dsh-spatiotemporal` | scope/层/域（空间）+ 生命周期/版本（时间）+ 锚点契约 | 演示：作用域遮蔽、isolate 隔离、dispose 回收 | ★ 本项目新颖性所在，`13-hotplug` 的理论基石 |

## Phase B — 机器人基础（用 DSH 辅助学，从零开始）

| # | 目录 | 学什么 | 可看输出 | 与最终目标的关系 |
|---|---|---|---|---|
| 06 | `06-ros2-mujoco-env` | ROS2 + MuJoCo 安装、环境隔离、工具链 | talker↔listener 通信 + 一个 MuJoCo 场景 | 机器人的运行基座 |
| 07 | `07-rigid-transform` | 旋转矩阵/欧拉角/**四元数**/齐次变换 + MuJoCo 场景搭建 | 机械臂动起来 + 三种姿态表示互转一致 | 机器人学第一块基石 |
| 08 | `08-kinematics` | FK/DH、IK（解析 + 数值雅可比） | 给定目标位姿 → 求关节角 → 驱动到位 | 运动控制的理论核心 |
| 09 | `09-trajectory-control` | 关节梯形插值/笛卡尔直线/SLERP + PID + 控制回路 | 三种轨迹对比曲线 + 跟踪误差 | 机器人软件岗核心技能 |
| 10 | `10-ros2-basics` | 节点/话题/服务/action/tf，rclpy 节点化 | rqt_graph 看到节点连通 | 机器人中间件层 |
| 11 | `11-cpp-control` | rclcpp 迁移 + 控制频率/延迟测量 | C++ vs Python 性能对比 | 机器人软件开发岗最硬门槛 |

## Phase C — 融合与旗舰

| # | 目录 | 学什么 | 可看输出 | 与最终目标的关系 |
|---|---|---|---|---|
| 12 | `12-dsh-ros-bridge` | DSH plugin 经 rosbridge 调 ROS2 | agent 一句指令 → 机械臂动作 | 打通「DSH ↔ ROS2」 |
| 13 | `13-hotplug` | **★ 能力热插拔 + 可靠性设计**（校验/多版本/回滚/事件/隔离/回收） | 运行中增删末端执行器工具，agent 无感 | **旗舰 demo，本项目新颖性主张的实现** |

---

## 推荐学习顺序

```
00 → 01 → 02 → 03 → 04 → 05          （Phase A：DSH 心智）
                          ↓
06 → 07 → 08 → 09 → 10 → 11          （Phase B：机器人，用 DSH 辅助）
                          ↓
12 → 13                              （Phase C：融合 + 旗舰）
```

**关键路径（必做）**：`00→…→05 → 06→…→11 → 12 → 13`。

> 注意：Phase B 的每个机器人 demo，都建议**用 Phase A 学到的「AI Coding + skill」来辅助完成**，这样既练了 DSH，又加速了机器人学习——把「学工具」和「用工具」闭环起来。
