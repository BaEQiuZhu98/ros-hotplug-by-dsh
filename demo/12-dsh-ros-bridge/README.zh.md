# demo/12 — DSH ↔ ROS2 桥（dsh-ros-bridge）

## 先建立直觉（零基础从这里读）

前 11 章分别学会了 DSH（agent/插件）和 ROS2（节点/话题/控制）。这一章把它们连起来，整条链路是：

```
agent 一句话 / web 面板输入末端位置
   ↓
DSH 插件(工具 move_arm 或 web 前端面板)
   ↓ 跑 Python 脚本(末端位置先做 IK 成关节角)
   ↓
rosbridge(WebSocket, 把 JSON 翻译成 ROS2)
   ↓ /joint_command
arm_server(ROS2 + MuJoCo) —— 手臂动(MuJoCo 窗口可视化跟随)
```

关键点：**DSH 插件跑在 Node.js、不能 import rclpy**，所以用 rosbridge 当「翻译官」，让非 ROS 程序（Node/Python 脚本）也能调 ROS2。这就是「解耦」——DSH 和 ROS2 谁都不直接依赖谁。

## 学什么

- rosbridge：ROS2 的 WebSocket 桥，让非 ROS 客户端能调 ROS2。
- 一条完整链路：DSH 插件 → rosbridge → ROS2 话题 → MuJoCo 手臂。
- 末端位置 → 关节角（IK，复用 demo 08 的余弦定理）→ 发指令。
- 两个 DSH 插件：`move_arm` 工具（agent 可调）、web 面板（可视化闭环）。
- MuJoCo 窗口 + 平滑动画：ROS 回调与渲染跑在同一个循环里。

## 怎么跑

前置：ROS2 Humble + MuJoCo（demo 06），再装两样：

```bash
sudo apt install -y ros-humble-rosbridge-suite   # rosbridge
pip install roslibpy                             # Python 桥接客户端
```

### 1. 启动 rosbridge（一个终端）
```bash
source /opt/ros/humble/setup.bash
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```
监听 `ws://localhost:9090`。

### 2. 启动机械臂（可视化，一个终端）
```bash
source /opt/ros/humble/setup.bash
source ~/venvs/robo/bin/activate    # 让 rclpy 和 mujoco 同时可用
python3 arm_server.py --view        # 弹 MuJoCo 窗口, 手臂平滑跟随
```
> 不带 `--view` 则只打印末端位置（无图形，适合测试）。

### 3. 分层验证（先不经过 DSH）
```bash
# 3a. 直接用 ROS 原生命令发关节角
ros2 topic pub /joint_command std_msgs/msg/Float32MultiArray "{data: [0.5, 0.8]}" --once

# 3b. 经 rosbridge 发关节角
python3 bridge_client.py 0.5 0.8

# 3c. 发末端位置(内部先 IK 成关节角再发)
python3 move_ee.py 0.5 0.3
```
每发一次，`arm_server` 终端都会打印收到的关节角 / 末端位置；`--view` 时窗口里的手臂会平滑转过去。

### 4. 接上 DSH（两个插件，重启后需重新加载）
在 cordis 会话里：
- **move_arm 工具**：把 `dsh_move_arm_tool.js` 作为 `code.host`，`cordis_define` + `cordis_run`。之后 agent 可调 `move_arm(q1, q2)`。
- **web 面板**：把 `web_arm_panel.js` 的 host 半部作为 `code.host`、client 半部作为 `code.client`，`cordis_define` + `cordis_run`。之后输入区上方会出现「机械臂末端 x/y + 发送」面板。

## 观察什么

1. **分层验证**：`ros2 topic pub` → `bridge_client.py` → `move_ee.py` → DSH 插件，每一层都能独立测通。
2. **解耦**：`arm_server` 不关心指令来自谁；桥接端不 import 任何 ROS 包；DSH 插件不 import rclpy。三者只靠话题名 `/joint_command` 对上。
3. **可视化闭环**：web 面板改 x/y → MuJoCo 窗口里的手臂平滑跟随（「一句话/一个输入 → 机械臂动作」）。

## 与最终目标什么关系

- 这是 demo 13 旗舰「热插拔」的地基：demo 13 会在这条「DSH ↔ ROS2」桥上运行时增删「能力工具」（grasp/suction/detect…），每个能力最终都经这条桥驱动 ROS2。
- 「agent/web 前端经 rosbridge 调 ROS2」正是简历里「打通 DSH 与机器人」的硬证据。

## 附：插件代码与重启后重新加载

- 插件源码已随本目录保存：`dsh_move_arm_tool.js`（move_arm 工具，host-only）、`web_arm_panel.js`（web 面板，host + client 两半部）。
- 这两个是**动态插件**（进程内临时），重启 `dsh web` 后会消失；用上面第 4 步的 `cordis_define` + `cordis_run` 重新加载即可。
- 注意：`move_arm` / web 面板在 host 里跑桥接脚本时，要显式用 demo 06 那个 venv 的 Python（`/root/venvs/robo/bin/python3`），因为系统 `python3` 没装 `roslibpy`。
