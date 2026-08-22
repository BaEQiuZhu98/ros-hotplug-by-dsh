#!/usr/bin/env python3
"""
demo/10 - TF 监听: 每秒查询 sensor 在 base_link 坐标系下的位置.

先跑 tf_broadcaster.py, 再跑本文件. 你会看到 sensor 的位置被查出来:
x=0.10 y=0.00 z=0.20, 这正是广播端声明的关系, 说明 TF 打通了.

运行(先 source ROS2):
    python3 tf_listener.py
"""
import rclpy
from rclpy.node import Node
from tf2_ros.buffer import Buffer
from tf2_ros.transform_listener import TransformListener


class TFListener(Node):
    def __init__(self):
        super().__init__('tf_listener')
        self.tf_buffer = Buffer()
        # TransformListener 在后台持续订阅 /tf 和 /tf_static, 新消息一来就更新 buffer.
        self.tf_listener = TransformListener(self.tf_buffer, self)
        self.timer = self.create_timer(1.0, self.timer_callback)

    def timer_callback(self):
        try:
            # 查 "sensor 在 base_link 下" 的变换(Time() 表示取最新).
            t = self.tf_buffer.lookup_transform('base_link', 'sensor', rclpy.time.Time())
            self.get_logger().info('sensor 在 base_link 下: x=%.2f y=%.2f z=%.2f'
                                   % (t.transform.translation.x,
                                      t.transform.translation.y,
                                      t.transform.translation.z))
        except Exception as e:  # noqa: BLE001 - 变换还没到就先跳过
            self.get_logger().info('还没拿到变换: %s' % e)


def main(args=None):
    rclpy.init(args=args)
    node = TFListener()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
