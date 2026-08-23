# src — 源码工程

本目录是设计文档 `docs/design.zh.md` §10.1 目录结构的落点, 也是「DSH 时空组合性 × 具身机器人
能力热插拔」的源码实现: 能力 = 带策略的末端实例(能力仓库), 热插拔 = 实例在臂作用域上的
运行时挂载/卸载(不重启), agent 只经 arm_status/take_object 感知与执行.

## 目录

| 目录 | 内容 |
|---|---|
| `capabilities/` | 能力仓库(`repo/`) + 挂载服务(`mount_service/`, 准入 + 臂管理 + web 面板) + 规范 + `mount_guard.py` + `pack.sh` |
| `presets/robo/` | 机器人任务 agent preset(persona + observer + 臂管理器 + arm_status/take_object + skills) |
| `ros2/sim_bridge/` | Python 仿真桥(双臂 MuJoCo, 订阅 tool_config/touch_command/ball_position/reset_command, 发布 /joint_state) |
| `ros2/cpp_control/` | C++ 高频控制循环(1 kHz PID + 频率/抖动/耗时实测) |
| `bridge/` | 消息契约 v1.1(`contract.md`) + 薄 SDK(`bridge_client.py`) + 验证脚本(`example_drive.py`) |
| `sim/models/` `sim/scenes/` | MJCF 模型与预置场景(唯一模型来源) |

## 依赖与运行前提

- ROS2 Humble + rosbridge_server(系统).
- MuJoCo + roslibpy + numpy: 装在项目 venv `/root/venvs/robo`(系统 python3 没有 roslibpy).
- 跑 sim_bridge: 先 `source /opt/ros/humble/setup.bash` 再激活 venv, 让 rclpy 和 mujoco 同时可用.

## 基线验证(普通 Python 脚本经 SDK 驱动 sim_bridge)

```bash
# 终端 1: rosbridge
ros2 launch rosbridge_server rosbridge_websocket_launch.xml

# 终端 2: sim_bridge(headless, 无窗口)
source /opt/ros/humble/setup.bash && source /root/venvs/robo/bin/activate
python3 src/ros2/sim_bridge/sim_bridge/two_arm_server.py        # 或加 --view 可视化
# 安装版: colcon build 后 ros2 run sim_bridge two_arm_server [--view]

# 终端 3: 验证脚本(经 SDK 切末端/设球/触球/复位/读能力集)
/root/venvs/robo/bin/python3 src/bridge/example_drive.py
```

预期: 每步返回 ok; sim_bridge 日志出现 tool_config/touch_command; 读回 `tools = {"A": "grasp", "B": "suction"}`.

## 热插拔验证(设计 §7.8/§7.12)

```text
1. 挂载服务装入 host 组合(机器常驻), 配置指向能力仓库(repo/)与 venv python.
2. robo preset 装入 agent preset 根; 新建会话选「机器人任务」.
3. web 面板(人的写入口)点「臂 A -> grasp@1.0.0」: 准入检查 -> 臂 A 作用域挂实例 ->
   set_tool 物理装配; arm_status(A) 变为 ready(不重启).
4. 同一会话内把臂 A 换挂 suction: 旧实例 dispose、新实例挂上; 同一句「用臂 A 去拿小球」
   自动走吸附策略, agent 无感且不知道末端型号.
5. 两臂同时挂同名末端(grasp): 实例按臂作用域隔离, 互不串台.
6. 点「卸载」: 臂层 dispose 无残留; 挂坏版本(篡改 manifest): 准入拒绝.
```

## 构建(colcon)

```bash
source /opt/ros/humble/setup.bash
cd src/ros2 && colcon build --symlink-install
```

- `cpp_control`: 构建产物在 `install/`, 运行 `ros2 run cpp_control control_node`(约 2 秒出一次 1000 Hz 实测报告).
- `sim_bridge`: `ros2 run sim_bridge two_arm_server --view --model <绝对路径>`(安装后模型文件用绝对路径, 开发模式默认定位 `src/sim/models/`).

## 约定

- 代码注释中文 + 英文标点; 打印无 emoji.
- 消息契约唯一自造 API 在 `bridge/`(版本化, 见 `contract.md`).
- 模型唯一来源是 `sim/models/`; 场景登记在 `sim/scenes/README.zh.md`.
- 能力仓库的 host.js 零依赖; 规范见 `capabilities/capability-spec.md`.
