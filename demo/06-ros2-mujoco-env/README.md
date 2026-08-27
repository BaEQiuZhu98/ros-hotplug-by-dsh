[中文](README.zh.md) | English

# demo/06 — ROS2 + MuJoCo environment setup

## What you learn

The first step into Phase B (the robot part): build the **runtime base** for every later robot demo.

- What ROS2 Humble is and how to install it (Ubuntu 22.04 + WSL2).
- What MuJoCo is and how to install it (pip), plus the three core concepts "model / data / step".
- **Environment isolation**: why ROS2 ships its own Python while MuJoCo is pip-installed, and how to make them coexist.
- Toolchain self-check: a talker<->listener exchange + one MuJoCo scene, proving the whole chain works.

> This demo only does "install + run". It does not dive into nodes/topics (that is `demo/10`).

## How to run

### 0. Prerequisites
- Ubuntu 22.04 (WSL2 or bare metal), 8GB+ RAM recommended.
- DSH already installed (`demo/00`).
- Python 3.10 (ships with Ubuntu 22.04).

### 1. Install ROS2 Humble
```bash
sudo apt update
sudo apt install -y software-properties-common curl
sudo add-apt-repository universe
sudo curl -sSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.key -o /usr/share/keyrings/ros-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/ros-archive-keyring.gpg] http://packages.ros.org/ros2/ubuntu $(. /etc/os-release && echo $UBUNTU_CODENAME) main" | sudo tee /etc/apt/sources.list.d/ros2.list > /dev/null
sudo apt update
sudo apt install -y ros-humble-desktop
```
> `ros-humble-desktop` ships the talker/listener demo nodes and RViz; if you installed only `ros-humble-ros-base`, add `ros-humble-demo-nodes-cpp ros-humble-demo-nodes-py`.

### 2. Install MuJoCo (in an isolated venv)
```bash
python3 -m venv ~/venvs/robo --system-site-packages
source ~/venvs/robo/bin/activate
pip install mujoco
```
> `--system-site-packages` lets the venv "see" ROS2's Python packages (rclpy) while still installing MuJoCo — the key step to make them coexist.

### 3. Verify talker<->listener (two terminals)
```bash
# terminal 1: publisher
source /opt/ros/humble/setup.bash
ros2 run demo_nodes_cpp talker

# terminal 2: subscriber
source /opt/ros/humble/setup.bash
ros2 run demo_nodes_py listener
```
> Terminal 2 keeps printing `[INFO] I heard: "Hello World: N"`, which means ROS2 pub/sub works.

### 4. Run a MuJoCo scene
```bash
source ~/venvs/robo/bin/activate
python3 mujoco_scene.py
```

### 5. Environment self-check (optional)
```bash
bash check.sh
```

## What to observe

1. **talker<->listener**: two independent processes, one publishing and one subscribing, with no shared memory between them — decoupled by ROS2 pub/sub.
2. **mujoco_scene.py**: the pendulum angle `qpos[0]` swings back and forth over time, proving the MuJoCo physics engine is running.
3. **Environment isolation**: ROS2 goes through `source /opt/ros/humble/setup.bash`, MuJoCo goes through the venv, and the two never pollute each other.

## How it relates to the final goal

- ROS2 is the middleware base from `demo/10` (node-ification) to `demo/12` (DSH<->ROS2 bridge).
- MuJoCo is the simulation environment from `demo/07` (rigid transforms) to `demo/09` (trajectory control).
- The "ROS2 + MuJoCo" base built here is the **stage** for the `demo/13` hot-plugging flagship.
