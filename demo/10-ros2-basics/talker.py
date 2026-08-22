#!/usr/bin/env python3
"""
demo/10 - 话题(topic)发布者: 每秒往 /chatter 发一条计数消息.

话题 = 广播/订阅: 发布者不停发, 谁订阅谁就能收到, 彼此不认识.
这是 ROS2 最常用的通信方式(传感器数据、关节状态都走话题).

运行(先 source ROS2):
    python3 talker.py
"""
import rclpy
from rclpy.node import Node
from std_msgs.msg import String


class Talker(Node):
    def __init__(self):
        super().__init__('talker')
        # 创建一个发布者: 发 String 类型, 话题名 chatter, 队列长度 10.
        self.publisher = self.create_publisher(String, 'chatter', 10)
        # 定时器: 每 1 秒调一次 timer_callback.
        self.timer = self.create_timer(1.0, self.timer_callback)
        self.count = 0

    def timer_callback(self):
        msg = String()
        msg.data = 'Hello World: %d' % self.count
        self.publisher.publish(msg)
        self.get_logger().info('发布: "%s"' % msg.data)
        self.count += 1


def main(args=None):
    rclpy.init(args=args)
    node = Talker()
    rclpy.spin(node)          # 让节点一直跑, 等定时器触发
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
