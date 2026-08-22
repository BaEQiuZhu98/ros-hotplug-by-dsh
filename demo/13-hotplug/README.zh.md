# demo/13 — 能力热插拔（hotplug）★ 旗舰

## 先建立直觉（零基础从这里读）

前 12 章打好了两半：DSH（agent/插件/时空组合性）和 ROS2+MuJoCo（机器人仿真 + 桥）。这一章把它们合起来，做本项目唯一的主张：

> **在运行时，像换末端执行器一样，给机器人挂载/卸载「能力」，agent 无感。**

本 demo 有**两条互补的演示路径**：

- **路径 A（agent 工具热插拔）**：把「夹爪/吸盘」各做成一个 DSH 能力工具，`cordis_run` 挂载、`cordis_stop` 卸载，演示 7 个可靠性点（对应 `docs/design.zh.md` §8）。
- **路径 B（web 面板可视化闭环）**：一个 web 面板，配置双臂末端（夹爪/吸盘）、手动设置小球位置、选臂触碰小球，MuJoCo 窗口实时跟随。

## 文件清单

| 文件 | 作用 |
|---|---|
| `robot_server.py` | 路径 A 机器人侧：单臂 + 末端能力指示（`--view` 可视化） |
| `two_arm_server.py` | 路径 B 机器人侧：双臂 + 小球 + 工具配置 + 触碰 + 设置小球 |
| `send_capability.py` | 发能力名到 `/capability_command`（路径 A） |
| `send_cmd.py` | 通用：往任意话题发一条 String（路径 B） |
| `capabilities/grasp_tool.js` | 能力工具：夹爪 |
| `capabilities/suction_tool.js` | 能力工具：吸盘 |
| `capabilities/manifest.json` | 能力元数据 + 代码 sha256（挂载前校验用） |
| `mount_guard.py` | 挂载前哈希校验（零信任） |
| `web_hotplug_panel.js` | web 面板插件（host 校验 + client 按钮） |
| `hotplug_walkthrough.md` | 7 个可靠性点走查（含本会话真实运行记录） |

## 学什么

- 能力 = DSH 插件工具：挂/卸 = `cordis_run`/`cordis_stop`。
- 挂载前零信任校验（manifest 哈希）。
- 7 个可靠性点：校验 / 多版本 / 灰度 / 回滚 / 事件 / 遮蔽 / 回收。
- 一条链：能力 → rosbridge → ROS2 话题 → MuJoCo 可视化。

## 怎么跑（路径 A：agent 工具热插拔）

前置：ROS2 Humble + MuJoCo + rosbridge + roslibpy（demo 06/12 已装）。

```bash
# 终端 1
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
# 终端 2
source /opt/ros/humble/setup.bash && source ~/venvs/robo/bin/activate
python3 robot_server.py --view
```

```bash
# 挂载前验身
python3 mount_guard.py grasp capabilities/grasp_tool.js   # 通过
```

然后在 cordis 会话里，把 `capabilities/grasp_tool.js` 作为 `code.host`，`cordis_define` + `cordis_run` → agent 可调 `grasp()`，末端小球变红。7 个可靠性点的完整走查见 `hotplug_walkthrough.md`。

## 怎么跑（路径 B：web 面板可视化闭环）

```bash
# 终端 1
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
# 终端 2
source /opt/ros/humble/setup.bash && source ~/venvs/robo/bin/activate
python3 two_arm_server.py --view   # 弹 MuJoCo 窗口: 两臂 + 黄色小球
```

在 cordis 会话里，把 `web_hotplug_panel.js` 的 host 半部作 `code.host`、client 半部作 `code.client`，`cordis_define` + `cordis_run`。之后输入区上方出现「双臂热插拔」面板：

```
臂 A  无  [夹爪] [吸盘] [触碰小球]
臂 B  无  [夹爪] [吸盘] [触碰小球]
小球  x [0.5] y [0.0] [设置]
```

- 点「夹爪/吸盘」→ 该臂末端小球变红/蓝。
- 改小球 x/y → 点「设置」→ 黄色小球移动。
- 点「触碰小球」→ 该臂末端追到小球；若该臂没配末端 → 报错「未配置末端执行器」。
- 非法输入（如小球位置填 `abc`）→ 报错。

## 观察什么

1. **插入即见 / 拔出即回收**：挂载后 agent 工具表多出 `grasp`；卸载后消失、无残留。
2. **多版本 / 灰度 / 回滚**：见 `hotplug_walkthrough.md`（本会话已真实演示）。
3. **双臂可视化闭环**：web 面板改配置/小球位置 → MuJoCo 窗口实时跟随。

## 与最终目标什么关系

- 这是本项目新颖性主张的**实现**：`DSH 时空组合性 × 能力热插拔 × 可复现 demo`。
- 面试时「运行时换末端执行器 + 零信任校验 + 灰度回滚」就是差异化硬证据。

## 附：重启后重新加载

能力工具和 web 面板都是动态插件（进程内临时），重启 `dsh web` 后消失；按上面「cordis 会话」步骤重新 `cordis_define` + `cordis_run` 即可（源码已随本目录保存）。
