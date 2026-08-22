#!/usr/bin/env python3
"""
demo/10 - TF 动态监听: 每秒查 moving_sensor 的位置, 看它随时间变化.

重点(回答"来了新消息怎么办"): lookup_transform 查的是本地 Buffer,
而 Buffer 由 TransformListener 在后台持续订阅 /tf, 每收到一条新消息就更新.
所以广播端每次发新位置, 本文件下一次 lookup 就能读到新值 —— 新消息被自动处理.

运行(先 source ROS2, 另开终端跑 tf_dynamic_broadcaster.py):
    python3 tf_dynamic_listener.py
"""
import math

import rclpy
from rclpy.node import Node
from tf2_ros.buffer import Buffer
from tf2_ros.transform_listener import TransformListener


class DynamicTFListener(Node):
    def __init__(self):
        super().__init__('tf_dynamic_listener')
        self.tf_buffer = Buffer()
        # TransformListener 在后台订阅 /tf 和 /tf_static, 新消息一来就写进 buffer.
        self.tf_listener = TransformListener(self.tf_buffer, self)
        self.timer = self.create_timer(0.5, self.timer_callback)

    def timer_callback(self):
        try:
            # Time() 表示"要最新的", 即 buffer 里最近收到的那条.
            t = self.tf_buffer.lookup_transform('base_link', 'moving_sensor', rclpy.time.Time())
            # 朝向角: 绕 Z 轴旋转角 = 2 * atan2(z, w).
            angle = 2.0 * math.atan2(t.transform.rotation.z, t.transform.rotation.w)
            self.get_logger().info('moving_sensor: x=%.3f y=%.3f 朝向角=%.2f rad'
                                   % (t.transform.translation.x,
                                      t.transform.translation.y, angle))
        except Exception as e:  # noqa: BLE001 - 还没消息就先跳过
            self.get_logger().info('还没拿到变换: %s' % e)


def main(args=None):
    rclpy.init(args=args)
    node = DynamicTFListener()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
