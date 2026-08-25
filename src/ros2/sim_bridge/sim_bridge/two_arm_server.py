#!/usr/bin/env python3
"""
sim_bridge - 双臂仿真桥(阶段 0 固化, 由 demo/13 two_arm_server.py 升级而来).

职责: ROS2 侧唯一的仿真入口. 订阅桥接层发来的指令话题, 驱动 MuJoCo 双臂场景,
并把状态以 /joint_state 回传, 供 SDK 的 query_capabilities 读取.

订阅:
  /tool_config(String)    - 载荷 "ARM:TOOL", 切换臂的末端执行器(grasp/suction/none).
  /ball_position(String)  - 载荷 "x,y", 设置小球 XY 位置(z 固定 0.5).
  /touch_command(String)  - 载荷 "A"|"B", 让该臂末端去触碰小球.
发布:
  /joint_state(String)    - 载荷 JSON(10 Hz), 格式见 bridge/contract.md v1.0.

为什么把模型 XML 挪到文件: 模型属于仿真资源(src/sim/models/), 与代码解耦,
改模型不改代码; 真机迁移时只换本节点, 话题契约不变.

运行(先 source ROS2 + 激活 venv, 让 rclpy 和 mujoco 同时可用):
    python3 two_arm_server.py            # headless: 只跑话题, 不弹窗
    python3 two_arm_server.py --view     # 弹 MuJoCo 窗口可视化
    python3 two_arm_server.py --model <mjcf 路径>   # 换模型文件
"""
import argparse
import json
import math
import sys
import time
from pathlib import Path

import mujoco
import numpy as np
import rclpy
from rclpy.node import Node
from std_msgs.msg import String

# 默认模型路径: 源码树 src/sim/models/two_arm_scene.xml.
# 本文件位于 <repo>/src/ros2/sim_bridge/sim_bridge/ 下, 上溯 3 级即 <repo>/src.
_SRC_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_MODEL = _SRC_ROOT / 'sim' / 'models' / 'two_arm_scene.xml'

A1 = 0.4  # 连杆 1 长度(m)
A2 = 0.4  # 连杆 2 长度(m)

# 臂配置: 基座 XY、关节名、末端工具几何名(与模型文件里的命名对应).
ARMS = {
    'A': {'base': np.array([0.0, -0.5]), 'joints': ('A_joint1', 'A_joint2'), 'tool': 'A_tool'},
    'B': {'base': np.array([0.0, 0.5]), 'joints': ('B_joint1', 'B_joint2'), 'tool': 'B_tool'},
}

# 末端执行器指示颜色: 红 = 夹爪, 蓝 = 吸盘, 灰 = 无.
COLORS = {
    'grasp': [0.9, 0.2, 0.2, 1.0],
    'suction': [0.2, 0.5, 0.9, 1.0],
    'none': [0.6, 0.6, 0.6, 1.0],
}

JOINT_STATE_RATE = 10.0  # /joint_state 发布频率(Hz), 反馈给 SDK 查询能力集


def load_model(path):
    """从 MJCF 文件加载模型与数据. 失败抛异常, 由 main 统一报错退出."""
    xml = Path(path).read_text(encoding='utf-8')
    model = mujoco.MjModel.from_xml_string(xml)
    data = mujoco.MjData(model)
    return model, data


def ik_relative(dx, dy):
    """二连杆 IK(余弦定理), 目标点相对基座的 (dx, dy). 不可达返回 None."""
    r2 = dx * dx + dy * dy
    c2 = (r2 - A1 * A1 - A2 * A2) / (2.0 * A1 * A2)
    if c2 < -1.0 or c2 > 1.0:
        return None
    s2 = math.sqrt(1.0 - c2 * c2)
    q2 = math.atan2(s2, c2)
    q1 = math.atan2(dy, dx) - math.atan2(A2 * s2, A1 + A2 * c2)
    return q1, q2


def fk_absolute(q1, q2, base):
    """二连杆 FK(契约 v1.2): 关节角 -> 末端 workspace 系 XY 位置."""
    x = base[0] + A1 * math.cos(q1) + A2 * math.cos(q1 + q2)
    y = base[1] + A1 * math.sin(q1) + A2 * math.sin(q1 + q2)
    return np.array([x, y])


class TwoArmServer(Node):
    """双臂仿真桥节点: 订阅指令话题, 驱动 MuJoCo, 周期回传 /joint_state."""

    def __init__(self, model, data):
        super().__init__('two_arm_server')
        self.model = model
        self.data = data

        # 预解析每个臂的关节 qpos 地址 + 工具几何 id(启动时一次, 回调里零查找).
        self.jq = {}
        self.tool_ids = {}
        for arm, cfg in ARMS.items():
            jid0 = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, cfg['joints'][0])
            jid1 = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, cfg['joints'][1])
            self.jq[arm] = [model.jnt_qposadr[jid0], model.jnt_qposadr[jid1]]
            self.tool_ids[arm] = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_GEOM, cfg['tool'])

        ball_body = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_BODY, 'ball')
        self.ball_mocap = model.body_mocapid[ball_body]

        # 运行状态.
        self.tools = {'A': 'none', 'B': 'none'}
        self.targets = {'A': np.array([0.0, 0.0]), 'B': np.array([0.0, 0.0])}
        self.ball = np.array([0.5, 0.0])  # 小球当前 XY 位置
        data.mocap_pos[self.ball_mocap] = [0.5, 0.0, 0.5]

        self.create_subscription(String, 'tool_config', self.on_tool_config, 10)
        self.create_subscription(String, 'touch_command', self.on_touch, 10)
        self.create_subscription(String, 'move_to', self.on_move_to, 10)
        self.create_subscription(String, 'ball_position', self.on_ball_position, 10)
        self.create_subscription(String, 'reset_command', self.on_reset, 10)

        self.state_pub = self.create_publisher(String, 'joint_state', 10)
        self.create_timer(1.0 / JOINT_STATE_RATE, self.publish_joint_state)

        self.get_logger().info('two_arm_server 已就绪')

    def on_reset(self, msg):
        # 全部复位(契约 v1.1): 关节目标归零(平滑回伸直), 末端全部卸下(灰), 小球回初始位置.
        self.targets = {'A': np.array([0.0, 0.0]), 'B': np.array([0.0, 0.0])}
        for arm in ARMS:
            self.tools[arm] = 'none'
            self.model.geom_rgba[self.tool_ids[arm]] = COLORS['none']
        self.ball = np.array([0.5, 0.0])
        self.data.mocap_pos[self.ball_mocap] = [0.5, 0.0, 0.5]
        self.get_logger().info('全部复位: 关节归零, 末端卸下, 小球回 (0.5, 0)')

    def on_tool_config(self, msg):
        # 载荷格式 "A:grasp" / "B:suction" / "A:none".
        parts = msg.data.split(':')
        if len(parts) != 2 or parts[0] not in ARMS:
            self.get_logger().warn('非法配置: %s' % msg.data)
            return
        arm, tool = parts[0], parts[1]
        if tool not in COLORS:
            self.get_logger().warn('非法末端执行器: %s' % tool)
            return
        self.tools[arm] = tool
        self.model.geom_rgba[self.tool_ids[arm]] = COLORS[tool]
        self.get_logger().info('臂 %s 末端执行器 = %s' % (arm, tool))

    def on_ball_position(self, msg):
        # 载荷格式 "x,y"(XY 平面, z 固定 0.5). 服务端校验(防御深度): 非有限数字直接拒绝,
        # 超出工作空间的范围做钳制并告警, 避免污染 mocap 导致仿真发散.
        try:
            parts = msg.data.split(',')
            x = float(parts[0])
            y = float(parts[1])
        except Exception:
            self.get_logger().warn('非法小球位置: %s' % msg.data)
            return
        if not (math.isfinite(x) and math.isfinite(y)):
            self.get_logger().warn('非法小球位置(非有限数字), 拒绝: %s' % msg.data)
            return
        LIMIT = 1.5  # 工作空间半宽(m), 超出按边界钳制.
        clamped = False
        if abs(x) > LIMIT:
            x = math.copysign(LIMIT, x)
            clamped = True
        if abs(y) > LIMIT:
            y = math.copysign(LIMIT, y)
            clamped = True
        if clamped:
            self.get_logger().warn('小球位置超出工作空间, 已钳制到 [%.2f, %.2f]' % (x, y))
        self.ball = np.array([x, y])
        self.data.mocap_pos[self.ball_mocap] = [x, y, 0.5]
        self.get_logger().info('小球位置 -> [%.3f, %.3f]' % (x, y))

    def on_move_to(self, msg):
        # 契约 v1.2: 载荷 "ARM:x,y"(workspace 系, 与 tool_config 同风格).
        # 校验与 ball_position 同级: 非有限数字拒绝; 超出工作空间钳制; 不可达(|r|>0.8)拒绝; 无末端拒绝.
        try:
            head, tail = msg.data.split(':')
            arm = head.strip()
            x = float(tail.split(',')[0])
            y = float(tail.split(',')[1])
        except Exception:
            self.get_logger().warn('非法移动指令: %s' % msg.data)
            return
        if arm not in ARMS:
            self.get_logger().warn('非法臂: %s' % arm)
            return
        if self.tools[arm] == 'none':
            self.get_logger().warn('臂 %s 没有配置末端执行器, 无法移动' % arm)
            return
        if not (math.isfinite(x) and math.isfinite(y)):
            self.get_logger().warn('非法移动目标(非有限数字), 拒绝: %s' % msg.data)
            return
        LIMIT = 1.5
        clamped = False
        if abs(x) > LIMIT:
            x = math.copysign(LIMIT, x)
            clamped = True
        if abs(y) > LIMIT:
            y = math.copysign(LIMIT, y)
            clamped = True
        if clamped:
            self.get_logger().warn('移动目标超出工作空间, 已钳制到 [%.2f, %.2f]' % (x, y))
        rel = np.array([x, y]) - ARMS[arm]['base']
        q = ik_relative(rel[0], rel[1])
        if q is None:
            self.get_logger().warn('臂 %s 够不到目标 [%.2f, %.2f]' % (arm, x, y))
            return
        self.targets[arm] = np.array(q)
        self.get_logger().info('臂 %s 移向 [%.3f, %.3f], 关节角 [%.3f, %.3f]' % (arm, x, y, q[0], q[1]))

    def on_touch(self, msg):
        arm = msg.data
        if arm not in ARMS:
            self.get_logger().warn('非法臂: %s' % arm)
            return
        if self.tools[arm] == 'none':
            self.get_logger().warn('臂 %s 没有配置末端执行器, 无法触碰小球' % arm)
            return
        rel = self.ball - ARMS[arm]['base']
        q = ik_relative(rel[0], rel[1])
        if q is None:
            self.get_logger().warn('臂 %s 够不到小球' % arm)
            return
        self.targets[arm] = np.array(q)
        self.get_logger().info('臂 %s 去触碰小球, 关节角 [%.3f, %.3f]' % (arm, q[0], q[1]))

    def publish_joint_state(self):
        # 回传格式见 bridge/contract.md v1.2: JSON 字符串, 含版本号 v=1 与末端位置 ee(workspace 系).
        state = {
            'v': 1,
            'joints': {
                'A': [float(self.data.qpos[a]) for a in self.jq['A']],
                'B': [float(self.data.qpos[a]) for a in self.jq['B']],
            },
            'tools': dict(self.tools),
            'ball': [float(self.ball[0]), float(self.ball[1])],
            'ee': {
                'A': [float(self.data.qpos[a]) for a in self.jq['A']],
                'B': [float(self.data.qpos[a]) for a in self.jq['B']],
            },
        }
        # ee 用 FK 正解(workspace 系, 臂基座偏移 + 正解), 覆盖上面的关节角占位.
        for arm in ARMS:
            q1 = self.data.qpos[self.jq[arm][0]]
            q2 = self.data.qpos[self.jq[arm][1]]
            ee = fk_absolute(q1, q2, ARMS[arm]['base'])
            state['ee'][arm] = [float(ee[0]), float(ee[1])]
        msg = String()
        msg.data = json.dumps(state)
        self.state_pub.publish(msg)

    def step(self, dt):
        # 每帧把两个臂的关节角向目标平滑逼近(限速 2.0 rad/s).
        for arm in ARMS:
            a0, a1 = self.jq[arm]
            cur = np.array([self.data.qpos[a0], self.data.qpos[a1]])
            delta = self.targets[arm] - cur
            dist = np.linalg.norm(delta)
            if dist < 1e-4:
                continue
            s = min(dist, 2.0 * dt)
            new = cur + (delta / dist) * s
            self.data.qpos[a0] = new[0]
            self.data.qpos[a1] = new[1]


def run_view(node):
    """可视化模式: 渲染循环里 spin_once 处理 ROS 回调, 不阻塞渲染."""
    import mujoco.viewer
    dt = 0.02  # 渲染步长(50 Hz)
    with mujoco.viewer.launch_passive(node.model, node.data) as viewer:
        while viewer.is_running() and rclpy.ok():
            rclpy.spin_once(node, timeout_sec=0.0)
            node.step(dt)
            mujoco.mj_forward(node.model, node.data)
            viewer.sync()
            time.sleep(dt)


def main(args=None):
    parser = argparse.ArgumentParser(description='sim_bridge: 双臂 MuJoCo 仿真桥')
    parser.add_argument('--view', action='store_true', help='弹 MuJoCo 窗口可视化')
    parser.add_argument('--model', default=str(DEFAULT_MODEL),
                        help='MJCF 模型文件路径(默认 src/sim/models/two_arm_scene.xml)')
    args, _ = parser.parse_known_args()

    if not Path(args.model).exists():
        print('找不到模型文件: %s, 请用 --model 指定.' % args.model)
        return 1

    rclpy.init(args=sys.argv)
    try:
        model, data = load_model(args.model)
    except Exception as e:
        print('加载模型失败: %s' % e)
        rclpy.shutdown()
        return 1

    node = TwoArmServer(model, data)
    if args.view:
        run_view(node)
    else:
        # headless 模式: 纯话题驱动(定时器负责 step 与状态回传).
        node.create_timer(0.02, lambda: node.step(0.02))
        rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()
    return 0


if __name__ == '__main__':
    sys.exit(main())
