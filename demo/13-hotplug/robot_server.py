#!/usr/bin/env python3
"""
demo/13 - 机器人服务: MuJoCo 两关节臂 + 可切换末端执行器(grasp/suction) + 可视化.

订阅两个话题:
  /joint_command(Float32MultiArray)  — 关节角(复用 demo 12 的桥)
  /capability_command(std_msgs/String) — 当前激活的末端执行器(grasp/suction/none)

--view 时弹 MuJoCo 窗口, 末端执行器用一个彩色小球表示:
  红 = 夹爪(grasp), 蓝 = 吸盘(suction), 灰 = 无(none).

这就是架构里 "ROS2 控制层 + MuJoCo 仿真" 这一层. 真正的能力热插拔发生在 DSH 侧
(挂/卸 grasp/suction 工具), 本文件只负责"按当前激活的能力改变末端执行器".

运行(先 source ROS2 + 激活 venv):
    python3 robot_server.py --view
"""
import sys
import time

import mujoco
import numpy as np
import rclpy
from rclpy.node import Node
from std_msgs.msg import Float32MultiArray
from std_msgs.msg import String

XML = """
<mujoco>
  <option gravity="0 0 -9.81"/>
  <worldbody>
    <light pos="0 0 3" dir="0 0 -1"/>
    <geom name="floor" type="plane" size="1 1 0.1" rgba="0.8 0.8 0.8 1"/>
    <body name="link1" pos="0 0 0.5">
      <joint name="joint1" type="hinge" axis="0 0 1"/>
      <geom name="link1_geom" type="capsule" size="0.03" fromto="0 0 0 0.4 0 0" rgba="0.9 0.3 0.3 1"/>
      <body name="link2" pos="0.4 0 0">
        <joint name="joint2" type="hinge" axis="0 0 1"/>
        <geom name="link2_geom" type="capsule" size="0.03" fromto="0 0 0 0.4 0 0" rgba="0.3 0.5 0.9 1"/>
        <site name="ee" pos="0.4 0 0"/>
        <!-- 末端执行器指示小球: 颜色随当前能力变化 -->
        <geom name="tool_geom" type="sphere" size="0.06" pos="0.4 0 0" rgba="0.6 0.6 0.6 1"/>
      </body>
    </body>
  </worldbody>
</mujoco>
"""

model = mujoco.MjModel.from_xml_string(XML)
data = mujoco.MjData(model)
TOOL_GEOM = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_GEOM, 'tool_geom')
MAX_SPEED = 2.0

COLORS = {
    'grasp': [0.9, 0.2, 0.2, 1.0],    # 红 = 夹爪
    'suction': [0.2, 0.5, 0.9, 1.0],  # 蓝 = 吸盘
    'none': [0.6, 0.6, 0.6, 1.0],     # 灰 = 无
}


class RobotServer(Node):
    def __init__(self, animate=False):
        super().__init__('robot_server')
        self.animate = animate
        self.capability = 'none'
        self.target = np.array([0.0, 0.0])
        self.create_subscription(Float32MultiArray, 'joint_command', self.on_joint, 10)
        self.create_subscription(String, 'capability_command', self.on_capability, 10)
        self.get_logger().info('robot_server 已就绪')

    def on_joint(self, msg):
        if len(msg.data) < 2:
            return
        q1, q2 = msg.data[0], msg.data[1]
        if self.animate:
            self.target[0] = q1
            self.target[1] = q2
            self.get_logger().info('目标关节角 [%.3f, %.3f]' % (q1, q2))
        else:
            data.qpos[0] = q1
            data.qpos[1] = q2
            mujoco.mj_forward(model, data)

    def on_capability(self, msg):
        cap = msg.data
        self.capability = cap if cap in COLORS else 'none'
        # 运行时改末端执行器小球的颜色(渲染端每帧读取, 无需 mj_forward).
        model.geom_rgba[TOOL_GEOM] = COLORS[self.capability]
        self.get_logger().info('当前末端执行器: %s' % self.capability)

    def step_toward_target(self, dt):
        cur = np.array([data.qpos[0], data.qpos[1]])
        delta = self.target - cur
        dist = np.linalg.norm(delta)
        if dist < 1e-4:
            return
        step = min(dist, MAX_SPEED * dt)
        new = cur + (delta / dist) * step
        data.qpos[0] = new[0]
        data.qpos[1] = new[1]


def run_view(node):
    import mujoco.viewer
    dt = 0.02
    with mujoco.viewer.launch_passive(model, data) as viewer:
        while viewer.is_running() and rclpy.ok():
            rclpy.spin_once(node, timeout_sec=0.0)
            node.step_toward_target(dt)
            mujoco.mj_forward(model, data)
            viewer.sync()
            time.sleep(dt)


def main(args=None):
    view = '--view' in sys.argv
    rclpy.init(args=args)
    node = RobotServer(animate=view)
    if view:
        run_view(node)
    else:
        rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
