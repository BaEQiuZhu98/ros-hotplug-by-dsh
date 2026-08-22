# demo/11 — C++ 控制（cpp-control）

## 先建立直觉（零基础从这里读）

demo 09 用 Python 写了 PID 控制，demo 10 学会了写 ROS2 节点。这一章回答一个问题：**为什么机器人真正的控制层几乎都用 C++，而不是 Python？**

答案就三个词：**快、稳、可预期**。

- **快**：C++ 直接编译成机器码，没有 Python 解释器那层开销。
- **稳**：C++ 没有 GIL（全局锁）、没有垃圾回收暂停，循环节奏更均匀（抖动小）。
- **可预期**：高频控制（比如 1000 Hz）要求每次循环都准时，Python 常达不到、且忽快忽慢。

本 demo 把 demo 09 的 PID 控制循环，用 Python 和 C++ 各写一遍，跑同样目标频率（1000 Hz），**当场量出「实际频率 / 抖动 / 单次耗时」三项，对比谁更能打**。

## 学什么

- rclcpp：ROS2 的 C++ 客户端库（rclpy 的 C++ 对应物）。
- 一个 ROS2 C++ 包长什么样（`package.xml` + `CMakeLists.txt` + `src/*.cpp`），怎么用 colcon 编译。
- 怎么测控制循环的「实际频率、抖动、单次耗时」。
- C++ vs Python 在高频控制上的性能差距。

## 怎么跑

前置：ROS2 Humble（demo 06 已装）+ 编译器（`sudo apt install build-essential`）。

### 1. Python 版（直接跑）
```bash
source /opt/ros/humble/setup.bash
python3 control_py.py
```
等几秒，它会周期打印实际频率/抖动/单次耗时。

### 2. C++ 版（colcon 编译后跑）
```bash
# 建一个 colcon 工作区(一次即可), 把 cpp_control 包拷进去
mkdir -p ~/ros2_ws/src
cp -r cpp_control ~/ros2_ws/src/
cd ~/ros2_ws
colcon build
source install/setup.bash
ros2 run demo11_cpp_control control_node
```

## 观察什么

两个节点打印**同一种格式**，直接对比三项：

| 指标 | 含义 | 期望结果 |
|---|---|---|
| 实际频率 | 每秒真跑了多少轮 | C++ 更接近 1000 Hz，Python 明显偏低 |
| 抖动 | 相邻两次循环间隔的波动 | C++ 远小于 Python |
| 单次耗时 | 一次 PID 计算花多久 | C++ 比 Python 快 1~2 个数量级 |

- 你把 Python 的 `TARGET_HZ` 和 C++ 的 `1000.0` 都调高（如 5000），差距会更明显。
- 抖动小 = 控制更「准时」，这是高精度运动控制的前提。

## 与最终目标什么关系

- 这是**机器人软件开发岗最硬的门槛**：会写、会编译、会测 C++ 控制循环，是招聘里最看重的硬技能。
- demo 12 的 DSH↔ROS2 桥、demo 13 的热插拔，最终的控制节点都会用 C++（rclcpp），Python 只做仿真桥/编排。
- 你在华为的 C/Linux/实时转发经验，正好和这一章的「高频控制 + 延迟测量」直接对得上——这是简历上的差异化亮点。
