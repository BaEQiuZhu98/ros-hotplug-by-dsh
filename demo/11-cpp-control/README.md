[中文](README.zh.md) | English

# demo/11 — C++ control

## Build the intuition first (start here if new)

demo 09 wrote a PID controller in Python, and demo 10 learned to write ROS2 nodes. This chapter answers one question: **why is the real robot control layer almost always C++, not Python?**

Three words: **fast, steady, predictable**.

- **Fast**: C++ compiles straight to machine code, with no Python interpreter overhead.
- **Steady**: C++ has no GIL and no garbage-collection pauses, so the loop rhythm is more even (low jitter).
- **Predictable**: high-rate control (e.g. 1000 Hz) requires every loop to fire on time; Python often can't keep up and varies.

This demo writes demo 09's PID control loop once in Python and once in C++, runs both at the same target rate (1000 Hz), and **measures "actual rate / jitter / per-iteration time" on the spot to compare them**.

## What you learn

- rclcpp: ROS2's C++ client library (the C++ counterpart of rclpy).
- What a ROS2 C++ package looks like (`package.xml` + `CMakeLists.txt` + `src/*.cpp`) and how to build it with colcon.
- How to measure a control loop's "actual rate, jitter, per-iteration time".
- The C++ vs Python performance gap for high-rate control.

## How to run

Prerequisite: ROS2 Humble (installed in demo 06) + a compiler (`sudo apt install build-essential`).

### 1. Python version (run directly)
```bash
source /opt/ros/humble/setup.bash
python3 control_py.py
```
After a few seconds it periodically prints actual rate / jitter / per-iteration time.

### 2. C++ version (colcon build, then run)
```bash
# create a colcon workspace (once) and copy the cpp_control package in
mkdir -p ~/ros2_ws/src
cp -r cpp_control ~/ros2_ws/src/
cd ~/ros2_ws
colcon build
source install/setup.bash
ros2 run demo11_cpp_control control_node
```

## What to observe

Both nodes print the **same format**, so compare the three numbers directly:

| Metric | Meaning | Expected |
|---|---|---|
| actual rate | how many loops per second really ran | C++ closer to 1000 Hz, Python clearly lower |
| jitter | variability between consecutive loop intervals | C++ far smaller than Python |
| per-iteration time | how long one PID computation takes | C++ 1~2 orders of magnitude faster than Python |

- Bump Python's `TARGET_HZ` and C++'s `1000.0` both to e.g. 5000 and the gap widens.
- Low jitter = the control fires "on time", the prerequisite for precise motion control.

## How it relates to the final goal

- This is the **hardest gate for robotics software roles**: being able to write, build, and benchmark a C++ control loop is the most-valued hard skill.
- The same C++ control loop is frozen as the `cpp_control` colcon package (under `src/ros2/cpp_control`) for control-rate benchmarking; the MuJoCo sim bridge stays in Python.
- Your C/Linux/real-time forwarding experience maps directly onto this chapter's "high-rate control + latency measurement" — a clear resume differentiator.
