# src — 源码工程(阶段 0~2 基线 + 架构 v2)

本目录是设计文档 `docs/design.zh.md` §10.1 目录结构的落点. 阶段 0 把 demo 11~13 固化为正式包;
阶段 1/2 的树外包挂载路径已按架构 v2 重构为「能力仓库 + 挂载服务」(热插拔 = 运行时挂载, 不重启).

## 目录

| 目录 | 内容 | 来源 |
|---|---|---|
| `ros2/sim_bridge/` | Python 仿真桥(双臂 MuJoCo, 订阅 tool_config/touch_command/ball_position, 发布 /joint_state) | demo/13 双臂服务器固化 |
| `ros2/cpp_control/` | C++ 高频控制循环(1 kHz PID + 频率/抖动/耗时实测) | demo/11 固化 |
| `bridge/` | 消息契约 v1.0(`contract.md`) + 薄 SDK(`bridge_client.py`) + 验证脚本(`example_drive.py`) | demo/12 桥接客户端升级 |
| `sim/models/` `sim/scenes/` | MJCF 模型与预置场景(唯一模型来源) | demo/13 内联 XML 抽出 |
| `capabilities/` | 能力仓库(`repo/`) + 挂载服务(`mount_service/`) + 规范 v2 + `mount_guard.py` + `pack.sh` | 架构 v2 |
| `presets/robo/` | 机器人任务 agent preset(persona + observer + skills, 无能力行) | 阶段 2 |

## 依赖与运行前提

- ROS2 Humble + rosbridge_server(系统).
- MuJoCo + roslibpy + numpy: 装在项目 venv `/root/venvs/robo`(**系统 python3 没有 roslibpy**).
- 跑 sim_bridge: 先 `source /opt/ros/humble/setup.bash` 再激活 venv, 让 rclpy 和 mujoco 同时可用.

## 基线验证(普通 Python 脚本经 SDK 驱动 sim_bridge)

```bash
# 终端 1: rosbridge
ros2 launch rosbridge_server rosbridge_websocket_launch.xml

# 终端 2: sim_bridge(headless, 无窗口)
source /opt/ros/humble/setup.bash && source /root/venvs/robo/bin/activate
python3 src/ros2/sim_bridge/sim_bridge/two_arm_server.py        # 或加 --view 可视化
# 安装版: colcon build 后 ros2 run sim_bridge two_arm_server [--view]

# 终端 3: 验证脚本(经 SDK 切末端/设球/触球/读能力集)
/root/venvs/robo/bin/python3 src/bridge/example_drive.py
```

预期: 每步返回 ok; sim_bridge 日志出现 tool_config/touch_command; 最后读回 `tools = {"A": "grasp", "B": "suction"}`.

## 热插拔验证(能力挂载服务, 见 `capabilities/capability-spec.md`)

```text
1. 挂载服务装入 host 组合(机器常驻), 配置指向能力仓库(repo/)与 venv python.
2. web 面板(人的写入口)点击挂载 grasp@1.0.0 -> 工具表立即出现 grasp(不重启), sim_bridge 末端生效.
3. 同一会话内点击换挂 suction -> grasp 消失 suction 出现, agent 无感, 同句「抓小球」自动换策略.
4. 点击卸载 -> 工具消失, 无残留(teardown 可观测); 挂坏版本 -> 校验/激活失败, 旧能力保留.
```

## 构建(colcon)

```bash
source /opt/ros/humble/setup.bash
cd src/ros2 && colcon build --symlink-install
```

- `cpp_control`: C++ 包, 构建产物 `install/` 下, 运行 `ros2 run cpp_control control_node`(约 2 秒出一次 1000 Hz 实测报告).
- `sim_bridge`: Python 包, `ros2 run sim_bridge two_arm_server --view --model <绝对路径>`(安装后模型文件需用绝对路径, 开发模式默认自动定位到 `src/sim/models/`).

## 约定

- 代码注释中文 + 英文标点; 打印无 emoji.
- 消息契约唯一自造 API 在 `bridge/`(版本化, 见 `contract.md`).
- 模型唯一来源是 `sim/models/`; 场景登记在 `sim/scenes/README.zh.md`.
- 能力仓库的 host.js 零依赖(不 import 任何包), 规范见 `capabilities/capability-spec.md`.
