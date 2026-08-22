#!/usr/bin/env python3
"""
demo/10 - 话题(topic)订阅者: 订阅 /chatter, 收到就打印.

发布者(talker)和订阅者(listener)是两个独立进程, 通过话题名 "chatter"
对上了号, 中间没有共享内存, 这是 ROS2 解耦的关键.

运行(先 source ROS2, 另开一个终端跑 talker.py):
    python3 listener.py
"""
import rclpy
from rclpy.node import Node
from std_msgs.msg import String


class Listener(Node):
    def __init__(self):
        super().__init__('listener')
        # 订阅 chatter 话题, 收到 String 就调 callback.
        self.subscription = self.create_subscription(
            String, 'chatter', self.callback, 10)

    def callback(self, msg):
        self.get_logger().info('收到: "%s"' % msg.data)


def main(args=None):
    rclpy.init(args=args)
    node = Listener()
    rclpy.spin(node)          # 一直跑, 等消息来
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
