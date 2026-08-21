#!/usr/bin/env bash
# demo/06 环境自检: 检查 ROS2 Humble 与 MuJoCo 是否就绪.
set -u

echo "== ROS2 + MuJoCo 环境自检 =="

# ROS2: 先看 /opt/ros/humble 目录是否存在(装没装).
if [ -d "/opt/ros/humble" ]; then
  echo "ROS2 Humble: 已安装 (/opt/ros/humble)"
else
  echo "ROS2 Humble: 未安装 (参考 README.zh.md 第 1 节)"
fi

# ros2 命令需要先 source /opt/ros/humble/setup.bash 才会出现在 PATH 里.
if command -v ros2 >/dev/null 2>&1; then
  echo "ros2 命令: 可用"
else
  echo "ros2 命令: 不在 PATH (先运行: source /opt/ros/humble/setup.bash)"
fi

# MuJoCo: 用当前 Python 尝试 import mujoco. 失败说明没装, 或不在当前 venv.
python3 - <<'PY'
try:
    import mujoco
    ver = getattr(mujoco, "__version__", "unknown")
    print("mujoco: 已安装 (版本 " + str(ver) + ")")
except Exception:
    print("mujoco: 未安装 (运行: pip install mujoco), 或不在当前 venv")
PY

echo "== 完成 =="
