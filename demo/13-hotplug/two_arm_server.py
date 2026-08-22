#!/usr/bin/env python3
"""
demo/13 - 双臂 + 小球可视化: 末端执行器可配置夹爪/吸盘, 可触碰小球.

两条二连杆臂(绕 Z 轴, 在 XY 平面), 臂 A 在下方、臂 B 在上方, 中间一个小球.
订阅两个话题(经 rosbridge 发过来):
  /tool_config(String)   — "A:grasp" / "A:suction" / "B:grasp" / "B:suction" / "A:none" ...
  /touch_command(String) — "A" 或 "B", 让该臂末端去触碰小球

末端执行器用彩色小球表示: 红=夹爪(grasp), 蓝=吸盘(suction), 灰=无(none).

运行(先 source ROS2 + 激活 venv):
    python3 two_arm_server.py --view
"""
import math
import sys
import time

import mujoco
import numpy as np
import rclpy
from rclpy.node import Node
from std_msgs.msg import String

XML = """
<mujoco>
  <option gravity="0 0 -9.81"/>
  <worldbody>
    <light pos="0 0 3" dir="0 0 -1"/>
    <geom name="floor" type="plane" size="2 2 0.1" rgba="0.8 0.8 0.8 1"/>

    <!-- 小球(mocap: 位置可被代码改) -->
    <body name="ball" mocap="true" pos="0.5 0 0.5">
      <geom name="ball_geom" type="sphere" size="0.05" rgba="1 0.8 0 1"/>
    </body>

    <!-- 机械臂 A -->
    <body name="A_link1" pos="0 -0.5 0.5">
      <joint name="A_joint1" type="hinge" axis="0 0 1"/>
      <geom name="A_link1_geom" type="capsule" size="0.03" fromto="0 0 0 0.4 0 0" rgba="0.9 0.3 0.3 1"/>
      <body name="A_link2" pos="0.4 0 0">
        <joint name="A_joint2" type="hinge" axis="0 0 1"/>
        <geom name="A_link2_geom" type="capsule" size="0.03" fromto="0 0 0 0.4 0 0" rgba="0.3 0.5 0.9 1"/>
        <site name="A_ee" pos="0.4 0 0"/>
        <geom name="A_tool" type="sphere" size="0.06" pos="0.4 0 0" rgba="0.6 0.6 0.6 1"/>
      </body>
    </body>

    <!-- 机械臂 B -->
    <body name="B_link1" pos="0 0.5 0.5">
      <joint name="B_joint1" type="hinge" axis="0 0 1"/>
      <geom name="B_link1_geom" type="capsule" size="0.03" fromto="0 0 0 0.4 0 0" rgba="0.2 0.7 0.3 1"/>
      <body name="B_link2" pos="0.4 0 0">
        <joint name="B_joint2" type="hinge" axis="0 0 1"/>
        <geom name="B_link2_geom" type="capsule" size="0.03" fromto="0 0 0 0.4 0 0" rgba="0.2 0.7 0.3 1"/>
        <site name="B_ee" pos="0.4 0 0"/>
        <geom name="B_tool" type="sphere" size="0.06" pos="0.4 0 0" rgba="0.6 0.6 0.6 1"/>
      </body>
    </body>
  </worldbody>
</mujoco>
"""

model = mujoco.MjModel.from_xml_string(XML)
data = mujoco.MjData(model)

A1 = 0.4
A2 = 0.4
BALL_BODY = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_BODY, 'ball')
BALL_MOCAP = model.body_mocapid[BALL_BODY]
data.mocap_pos[BALL_MOCAP] = [0.5, 0.0, 0.5]  # 初始小球位置

# 臂配置: 基座 XY、关节名、末端工具几何名
ARMS = {
    'A': {'base': np.array([0.0, -0.5]), 'joints': ('A_joint1', 'A_joint2'), 'tool': 'A_tool'},
    'B': {'base': np.array([0.0, 0.5]), 'joints': ('B_joint1', 'B_joint2'), 'tool': 'B_tool'},
}

COLORS = {
    'grasp': [0.9, 0.2, 0.2, 1.0],    # 红 = 夹爪
    'suction': [0.2, 0.5, 0.9, 1.0],  # 蓝 = 吸盘
    'none': [0.6, 0.6, 0.6, 1.0],     # 灰 = 无
}

# 预解析每个臂的两个关节 qpos 地址 + 工具几何 id
JQ = {}
TOOL_IDS = {}
for arm, cfg in ARMS.items():
    jid0 = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, cfg['joints'][0])
    jid1 = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, cfg['joints'][1])
    JQ[arm] = [model.jnt_qposadr[jid0], model.jnt_qposadr[jid1]]
    TOOL_IDS[arm] = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_GEOM, cfg['tool'])


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


class TwoArmServer(Node):
    def __init__(self):
        super().__init__('two_arm_server')
        self.tools = {'A': 'none', 'B': 'none'}
        self.targets = {'A': np.array([0.0, 0.0]), 'B': np.array([0.0, 0.0])}
        self.ball = np.array([0.5, 0.0])  # 小球当前 XY 位置
        self.create_subscription(String, 'tool_config', self.on_tool_config, 10)
        self.create_subscription(String, 'touch_command', self.on_touch, 10)
        self.create_subscription(String, 'ball_position', self.on_ball_position, 10)
        self.get_logger().info('two_arm_server 已就绪')

    def on_tool_config(self, msg):
        # 格式 "A:grasp" / "B:suction" / "A:none"
        parts = msg.data.split(':')
        if len(parts) != 2 or parts[0] not in ARMS:
            self.get_logger().warn('非法配置: %s' % msg.data)
            return
        arm, tool = parts[0], parts[1]
        if tool not in COLORS:
            self.get_logger().warn('非法末端执行器: %s' % tool)
            return
        self.tools[arm] = tool
        model.geom_rgba[TOOL_IDS[arm]] = COLORS[tool]
        self.get_logger().info('臂 %s 末端执行器 = %s' % (arm, tool))

    def on_ball_position(self, msg):
        # 格式 "x,y"(XY 平面, z 固定 0.5)
        try:
            parts = msg.data.split(',')
            x = float(parts[0])
            y = float(parts[1])
        except Exception:
            self.get_logger().warn('非法小球位置: %s' % msg.data)
            return
        self.ball = np.array([x, y])
        data.mocap_pos[BALL_MOCAP] = [x, y, 0.5]
        self.get_logger().info('小球位置 -> [%.3f, %.3f]' % (x, y))

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

    def step(self, dt):
        for arm in ARMS:
            a0, a1 = JQ[arm]
            cur = np.array([data.qpos[a0], data.qpos[a1]])
            delta = self.targets[arm] - cur
            dist = np.linalg.norm(delta)
            if dist < 1e-4:
                continue
            s = min(dist, 2.0 * dt)
            new = cur + (delta / dist) * s
            data.qpos[a0] = new[0]
            data.qpos[a1] = new[1]


def run_view(node):
    import mujoco.viewer
    dt = 0.02
    with mujoco.viewer.launch_passive(model, data) as viewer:
        while viewer.is_running() and rclpy.ok():
            rclpy.spin_once(node, timeout_sec=0.0)
            node.step(dt)
            mujoco.mj_forward(model, data)
            viewer.sync()
            time.sleep(dt)


def main(args=None):
    view = '--view' in sys.argv
    rclpy.init(args=args)
    node = TwoArmServer()
    if view:
        run_view(node)
    else:
        rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
