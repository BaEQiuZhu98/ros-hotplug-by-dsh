# bridge/contract.md — 桥接消息契约 v1.2

> 本文档是项目 L4「桥接契约 + SDK」的消息契约部分, 是**本项目唯一自造 API** 的规范.
> 两端(DSH 能力层经 rosbridge ↔ ROS2 控制层)都按本文档实现.

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
| `/move_to` | 客户端 → sim_bridge | `std_msgs/String` | `"ARM:x,y"` | 指定臂末端收敛移动到指定 XY(§3.6) |
| `/home_command` | 客户端 → sim_bridge | `std_msgs/String` | `"A"` 或 `"B"` | 该臂关节回原位(伸直; 不动末端/小球/另一臂, §3.7) |
| `/reset_command` | 客户端 → sim_bridge | `std_msgs/String` | `"reset"` | 全部复位(关节归零/末端卸下/小球回初始) |
| `/joint_state` | sim_bridge → 客户端 | `std_msgs/String` | JSON(见 §3) | 状态回传(10 Hz 反馈) |

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
  "ball": [x, y],
  "ee": {"A": [x, y], "B": [x, y]}
}
```

- `v`: 载荷 schema 版本, 目前为 1.
- `joints`: 两臂当前关节角(rad).
- `tools`: 两臂当前末端执行器, 取值同 §3.1 的 TOOL.
- `ball`: 小球当前 XY 位置(m).
- `ee`: 两臂末端执行器当前 XY 位置(m). **坐标系 = workspace 系**: 臂基座偏移 + FK 正解, 与 `ball` 同系(命中判定直接相减).
- 发布频率: 10 Hz.

### 3.5 `/reset_command`

- 格式: `"reset"`(载荷值不校验, 收到即复位).
- 语义: 关节目标归零(平滑回伸直) + 末端全部卸下(灰) + 小球回 (0.5, 0).

### 3.6 `/move_to`

- 格式: `"ARM:x,y"`(与 tool_config 同风格; ARM ∈ {A, B}, 目标 XY 为 workspace 系).
- 校验(与 `/ball_position` 同级): 非有限数字拒绝; 超出工作空间(±1.5)按边界钳制并告警; 目标不可达(|r| > 0.8)拒绝移动并告警「够不到」.
- 语义: 该臂末端**收敛移动到指定 XY**(与 `/touch_command` 同 IK 机制参数化, touch 直奔小球不受影响). 若该臂当前 TOOL = none, sim_bridge 拒绝并告警(与 touch 一致).
- **SDK `move_to(arm, x, y, timeout=3s)` 为收敛完成式**: 发布后订阅回传, 直到满足收敛判据才返回, 超时返回 `{ok:false, error:超时}`.
  - 收敛主判据: `ee` 距目标 < 0.02 m; 辅助条件: 相邻两次采样 ee 稳定.
  - 成功返回 `{ok: true, ee: [x, y], ball: [bx, by]}`(ee 为收敛时读到的末端位置, ball 同帧小球位置)——「返回即已到位」, 命中判定由调用方用 ee 与 ball 距离完成(sim 算、能力只判).
  - **超时层级不变量**: SDK move_to 超时 3s 必须小于挂载服务 bridge 层的 5s 兜底, 调整任一侧时同步核对(见 mount_service/host.js 注释).

### 3.7 `/home_command`

- 格式: `"A"` 或 `"B"`(臂名 ∈ {A, B}, 与 `/touch_command` 同风格).
- 语义: 该臂关节目标归零(平滑回伸直, 与 `/reset_command` 同机制但只动单臂), 不改变末端装配与小球位置. 用于面板「臂X复位」: 卸载 + 末端复位 + 回原位.

## 4. SDK 方法映射(`bridge_client.py`)

| SDK 方法 | 发布话题 | 载荷 | SDK 内置校验 |
|---|---|---|---|
| `set_tool(arm, tool)` | `/tool_config` | `"ARM:TOOL"` | arm ∈ {A, B}; tool ∈ {grasp, suction, none} |
| `set_ball(x, y)` | `/ball_position` | `"x,y"` | x/y 为有限数字 |
| `touch(arm)` | `/touch_command` | `"A"`/`"B"` | arm ∈ {A, B} |
| `move_to(arm, x, y, timeout=3)` | `/move_to` | `"ARM:x,y"` | arm ∈ {A, B}; x/y 为有限数字; 收敛完成式(§3.6), 返回 {ok, ee, ball} |
| `home(arm)` | `/home_command` | `"A"`/`"B"` | arm ∈ {A, B}; 该臂关节回原位(§3.7) |
| `reset()` | `/reset_command` | `"reset"` | - |
| `query_capabilities()` | 订阅 `/joint_state` | - | 解析 §3.4 JSON, 返回能力集 |

> 注: 本契约的 arm ∈ {A, B} 是**物理层**双臂事实(sim_bridge 模型)。DSH 侧的逻辑臂清单
> 由挂载服务组合行 `config.arms` 下发(默认 A/B), 面板/臂管理器/挂卸校验动态跟随; 扩展
> 物理臂时需同步扩展模型与契约。

校验规则: 非法输入在 SDK 层直接拒绝, 返回 `{"ok": false, "error": "<原因>"}`,
**不进入 ROS2**; 因此能力开发者(DSH 插件 host)免写校验.

## 5. 返回约定

- SDK 每个方法返回 dict:
  - 成功: `{"ok": true, ...具体字段}`
  - 失败: `{"ok": false, "error": "<中文原因>"}`
- 连接未建立时, 任何方法返回 `{"ok": false, "error": "未连接 rosbridge"}`.
