[English](README.md) | 中文

# demo/06 — ROS2 + MuJoCo 环境搭建

## 学什么

进入 Phase B(机器人部分)的第一步: 把后面所有机器人 demo 的**运行基座**搭起来.

- ROS2 Humble 是什么, 怎么装(Ubuntu 22.04 + WSL2).
- MuJoCo 是什么, 怎么装(pip), 以及 "model / data / step" 三个核心概念.
- **环境隔离**: 为什么 ROS2 自带一套 Python, MuJoCo 又要 pip 装, 二者如何和平共存.
- 工具链自检: 一段 talker<->listener 通信 + 一个 MuJoCo 场景, 证明整条链路通了.

> 本 demo 只做 "装好 + 跑通", 不深入节点/话题(demo/10 才讲 ROS2 节点化).

## 怎么跑

### 0. 前置要求
- Ubuntu 22.04(WSL2 或真机), 建议 8GB 以上内存.
- 已装好 DSH(demo/00).
- Python 3.10(Ubuntu 22.04 自带).

### 1. 安装 ROS2 Humble
```bash
sudo apt update
sudo apt install -y software-properties-common curl
sudo add-apt-repository universe
sudo curl -sSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.key -o /usr/share/keyrings/ros-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/ros-archive-keyring.gpg] http://packages.ros.org/ros2/ubuntu $(. /etc/os-release && echo $UBUNTU_CODENAME) main" | sudo tee /etc/apt/sources.list.d/ros2.list > /dev/null
sudo apt update
sudo apt install -y ros-humble-desktop
```
> `ros-humble-desktop` 自带 talker/listener 示例节点和 RViz; 若只装了 `ros-humble-ros-base`, 需再补 `ros-humble-demo-nodes-cpp ros-humble-demo-nodes-py`.

### 2. 装 MuJoCo(在隔离的 venv 里)
```bash
python3 -m venv ~/venvs/robo --system-site-packages
source ~/venvs/robo/bin/activate
pip install mujoco
```
> `--system-site-packages` 让 venv 能 "看见" 系统里 ROS2 的 Python 包(rclpy), 同时又能装 MuJoCo, 是让两者共存的关键一步.

### 3. 验证 talker<->listener(两个终端)
```bash
# 终端 1: 发布者
source /opt/ros/humble/setup.bash
ros2 run demo_nodes_cpp talker

# 终端 2: 订阅者
source /opt/ros/humble/setup.bash
ros2 run demo_nodes_py listener
```
> 终端 2 会不断打印 `[INFO] I heard: "Hello World: N"`, 说明 ROS2 的发布/订阅已经打通.

### 4. 跑一个 MuJoCo 场景
```bash
source ~/venvs/robo/bin/activate
python3 mujoco_scene.py
```

### 5. 环境自检(可选)
```bash
bash check.sh
```

## 观察什么

1. **talker<->listener**: 两个独立进程, 一个发一个收, 中间没有共享内存, 靠 ROS2 的发布/订阅解耦.
2. **mujoco_scene.py**: 摆杆角度 `qpos[0]` 随时间在正负之间来回摆动, 证明 MuJoCo 物理引擎在跑.
3. **环境隔离**: ROS2 走 `source /opt/ros/humble/setup.bash`, MuJoCo 走 venv, 两者互不污染.

## 与最终目标什么关系

- ROS2 是 demo/10(节点化)到 demo/12(DSH<->ROS2 桥)的中间件底座.
- MuJoCo 是 demo/07(刚体变换)到 demo/09(轨迹控制)的仿真环境.
- 本 demo 搭好的 "ROS2 + MuJoCo" 就是 demo/13 热插拔旗舰的**舞台**.
