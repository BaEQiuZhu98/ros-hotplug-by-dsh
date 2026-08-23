# bridge/contract.md — 桥接消息契约 v1.0

> 本文档是项目 L4「桥接契约 + SDK」的消息契约部分, 是**本项目唯一自造 API** 的规范.
> 两端(DSH 能力层经 rosbridge ↔ ROS2 控制层)都按本文档实现, 独立演进.
> 版本策略: 主版本 v1 内只做向后兼容的增量(新增话题/字段); 破坏性变更升主版本.

## 1. 通信路径

```
DSH 能力层 / 普通 Python 脚本
        │ bridge_client.py SDK(校验内置, 隐藏 rosbridge 细节)
        ▼
rosbridge_server(ws://localhost:9090, WebSocket)
        ▼
ROS2 话题 ──► sim_bridge 节点(MuJoCo 双臂仿真)
```

## 2. 话题总表

| 话题 | 方向 | 类型 | 载荷 | 语义 |
|---|---|---|---|---|
| `/tool_config` | 客户端 → sim_bridge | `std_msgs/String` | `"ARM:TOOL"` | 切换某臂末端执行器 |
| `/ball_position` | 客户端 → sim_bridge | `std_msgs/String` | `"x,y"` | 设置小球 XY 位置 |
| `/touch_command` | 客户端 → sim_bridge | `std_msgs/String` | `"A"` 或 `"B"` | 选臂触碰小球 |
| `/reset_command` | 客户端 → sim_bridge | `std_msgs/String` | `"reset"` | 全部复位(关节归零/末端卸下/小球回初始) |
| `/joint_state` | sim_bridge → 客户端 | `std_msgs/String` | JSON(见 §3) | 状态回传(10 Hz 反馈) |
| `/capability_command` | 客户端 → 机器人侧 | `std_msgs/String` | `"grasp"` 或 `"suction"` | 激活能力(路径 A 单臂 server 用, v1.0 预留; sim_bridge 不订阅) |

## 3. 载荷规范

### 3.1 `/tool_config`

- 格式: `"ARM:TOOL"`.
- `ARM` ∈ {`A`, `B`}; `TOOL` ∈ {`grasp`, `suction`, `none`}.
- 例: `"A:grasp"` = 臂 A 换夹爪; `"B:none"` = 臂 B 卸下末端.

### 3.2 `/ball_position`

- 格式: `"x,y"`, 两个十进制数, 单位 m(z 由 sim_bridge 固定 0.5).

### 3.3 `/touch_command`

- 格式: `"A"` 或 `"B"`.
- 语义: 该臂末端移到小球处. 若该臂当前 TOOL = none, sim_bridge 拒绝并告警.

### 3.4 `/joint_state`(状态回传, JSON 字符串)

```json
{
  "v": 1,
  "joints": {"A": [q1, q2], "B": [q1, q2]},
  "tools": {"A": "grasp", "B": "none"},
  "ball": [x, y]
}
```

- `v`: 载荷 schema 版本, 目前为 1.
- `joints`: 两臂当前关节角(rad).
- `tools`: 两臂当前末端执行器, 取值同 §3.1 的 TOOL.
- `ball`: 小球当前 XY 位置(m).
- 发布频率: 10 Hz.

### 3.5 `/reset_command`(契约 v1.1)

- 格式: `"reset"`(载荷值不校验, 收到即复位).
- 语义: 关节目标归零(平滑回伸直) + 末端全部卸下(灰) + 小球回 (0.5, 0).

### 3.6 `/capability_command`(预留)

- 路径 A(demo/13 单臂 `robot_server.py`)使用的旧话题, v1.0 保留定义供兼容;
  sim_bridge 不订阅, 新代码一律走 `/tool_config`.

## 4. SDK 方法映射(`bridge_client.py`)

| SDK 方法 | 发布话题 | 载荷 | SDK 内置校验 |
|---|---|---|---|
| `set_tool(arm, tool)` | `/tool_config` | `"ARM:TOOL"` | arm ∈ {A, B}; tool ∈ {grasp, suction, none} |
| `set_ball(x, y)` | `/ball_position` | `"x,y"` | x/y 为有限数字 |
| `touch(arm)` | `/touch_command` | `"A"`/`"B"` | arm ∈ {A, B} |
| `reset()` | `/reset_command` | `"reset"` | - |
| `query_capabilities()` | 订阅 `/joint_state` | - | 解析 §3.4 JSON, 返回能力集 |

校验规则: 非法输入在 SDK 层直接拒绝, 返回 `{"ok": false, "error": "<原因>"}`,
**不进入 ROS2**; 因此能力开发者(DSh 插件 host)免写校验.

## 5. 返回约定

- SDK 每个方法返回 dict:
  - 成功: `{"ok": true, ...具体字段}`
  - 失败: `{"ok": false, "error": "<中文原因>"}`
- 连接未建立时, 任何方法返回 `{"ok": false, "error": "未连接 rosbridge"}`.

## 6. 演进记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0 | 2026-08 | 初始契约: tool_config/ball_position/touch_command + /joint_state 反馈 + 薄 SDK; 预留 /capability_command |
| v1.1 | 2026-08 | 新增 /reset_command(全部复位)与 SDK reset() |
