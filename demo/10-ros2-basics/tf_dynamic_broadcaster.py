#!/usr/bin/env python3
"""
demo/10 - TF 动态广播: 以 10 Hz 持续发布一个"绕圈运动"的 moving_sensor 帧.

和静态 TF(tf_broadcaster.py 只 send 一次)不同, 动态 TF 用 TransformBroadcaster,
以固定频率持续往 /tf 话题发**新**消息. 帧的位置随时间变化,
监听端(buffer)每收到一条新消息就更新缓存, 所以查到的位置一直在变.

运行(先 source ROS2):
    python3 tf_dynamic_broadcaster.py
"""
import math

import rclpy
from rclpy.node import Node
from geometry_msgs.msg import TransformStamped
from tf2_ros import TransformBroadcaster


class DynamicFramePublisher(Node):
    def __init__(self):
        super().__init__('tf_dynamic_broadcaster')
        # 动态广播: 用 TransformBroadcaster(不是 Static 那个).
        self.broadcaster = TransformBroadcaster(self)
        # 每 0.1 秒(10 Hz)发一条新变换.
        self.timer = self.create_timer(0.1, self.tick)
        self.phase = 0.0

    def tick(self):
        t = TransformStamped()
        t.header.stamp = self.get_clock().now().to_msg()
        t.header.frame_id = 'base_link'
        t.child_frame_id = 'moving_sensor'
        # moving_sensor 绕 base_link 原点, 在 X-Y 平面转圈(半径 0.3).
        t.transform.translation.x = 0.3 * math.cos(self.phase)
        t.transform.translation.y = 0.3 * math.sin(self.phase)
        t.transform.translation.z = 0.0
        # 同时绕 Z 轴转 phase 弧度(四元数: z=sin(phase/2), w=cos(phase/2)).
        half = self.phase / 2.0
        t.transform.rotation.z = math.sin(half)
        t.transform.rotation.w = math.cos(half)
        self.broadcaster.sendTransform(t)   # 每条新消息都会广播出去
        self.phase += 0.1


def main(args=None):
    rclpy.init(args=args)
    node = DynamicFramePublisher()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
