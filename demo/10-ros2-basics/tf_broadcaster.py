#!/usr/bin/env python3
"""
demo/10 - TF 静态坐标广播: 发布 base_link -> sensor 的固定变换.

TF = 坐标系关系(谁相对谁、在哪、朝向哪). 这里声明一个固定关系:
传感器 sensor 在底盘 base_link 的 (0.1, 0, 0.2) 处, 无旋转.
后面任何节点都能查到 "sensor 在 base_link 下的位置".

运行(先 source ROS2):
    python3 tf_broadcaster.py
"""
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import TransformStamped
from tf2_ros import StaticTransformBroadcaster


class StaticFramePublisher(Node):
    def __init__(self):
        super().__init__('tf_broadcaster')
        self.broadcaster = StaticTransformBroadcaster(self)

        t = TransformStamped()
        t.header.stamp = self.get_clock().now().to_msg()
        t.header.frame_id = 'base_link'   # 父坐标系
        t.child_frame_id = 'sensor'       # 子坐标系
        t.transform.translation.x = 0.1
        t.transform.translation.y = 0.0
        t.transform.translation.z = 0.2
        # 无旋转的四元数 = [x=0, y=0, z=0, w=1]
        t.transform.rotation.x = 0.0
        t.transform.rotation.y = 0.0
        t.transform.rotation.z = 0.0
        t.transform.rotation.w = 1.0
        self.broadcaster.sendTransform(t)
        self.get_logger().info('已广播 base_link -> sensor 的静态变换')


def main(args=None):
    rclpy.init(args=args)
    node = StaticFramePublisher()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
