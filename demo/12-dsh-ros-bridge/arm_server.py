#!/usr/bin/env python3
"""
demo/12 - ROS2 侧: 机械臂控制节点(订阅 /joint_command, 驱动 MuJoCo 手臂).

两种模式:
  无参数 : 收到关节角直接设置并打印末端位置(无图形, 适合测试).
  --view : 弹 MuJoCo 窗口, 手臂平滑地转到目标关节角(可视化闭环).

运行(先 source ROS2 + 激活 venv, 让 rclpy 和 mujoco 同时可用):
    python3 arm_server.py
    python3 arm_server.py --view
"""
import sys
import time

import mujoco
import numpy as np
import rclpy
from rclpy.node import Node
from std_msgs.msg import Float32MultiArray

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
      </body>
    </body>
  </worldbody>
</mujoco>
"""

model = mujoco.MjModel.from_xml_string(XML)
data = mujoco.MjData(model)
EE_ID = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_SITE, "ee")
MAX_SPEED = 2.0  # 关节限速(rad/s), 让动画平滑而不是瞬间跳变


class ArmServer(Node):
    def __init__(self, animate=False):
        super().__init__('arm_server')
        self.animate = animate
        self.target = np.array([0.0, 0.0])
        self.subscription = self.create_subscription(
            Float32MultiArray, 'joint_command', self.callback, 10)
        self.get_logger().info('arm_server 已就绪, 等待 /joint_command ...')

    def callback(self, msg):
        if len(msg.data) < 2:
            self.get_logger().warn('收到数据不足两个: %s' % list(msg.data))
            return
        q1, q2 = msg.data[0], msg.data[1]
        if self.animate:
            # 可视化模式: 只记录目标, 由渲染循环平滑逼近.
            self.target[0] = q1
            self.target[1] = q2
            self.get_logger().info('收到目标关节角 [%.3f, %.3f]' % (q1, q2))
        else:
            data.qpos[0] = q1
            data.qpos[1] = q2
            mujoco.mj_forward(model, data)
            ee = data.site_xpos[EE_ID]
            self.get_logger().info('关节角 [%.3f, %.3f] -> 末端位置 [%.3f, %.3f, %.3f]'
                                   % (q1, q2, ee[0], ee[1], ee[2]))

    def step_toward_target(self, dt):
        """当前关节角向 target 平滑移动(限速 MAX_SPEED), 到目标后不动."""
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
    dt = 0.02  # 渲染步长(50 Hz)
    with mujoco.viewer.launch_passive(model, data) as viewer:
        while viewer.is_running() and rclpy.ok():
            # 关键: 在渲染循环里用 spin_once 处理 ROS 回调, 不阻塞渲染.
            rclpy.spin_once(node, timeout_sec=0.0)
            node.step_toward_target(dt)
            mujoco.mj_forward(model, data)
            viewer.sync()
            time.sleep(dt)


def main(args=None):
    view = '--view' in sys.argv
    rclpy.init(args=args)
    node = ArmServer(animate=view)
    if view:
        run_view(node)
    else:
        rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
