#!/usr/bin/env python3
"""
demo/10 - 服务(service)客户端: 发请求 a+b, 打印返回的和.

先跑 add_two_ints_server.py, 再跑本文件(可带两个整数参数).

运行(先 source ROS2):
    python3 add_two_ints_client.py        # 默认 2 + 3
    python3 add_two_ints_client.py 7 8    # 7 + 8
"""
import sys

import rclpy
from rclpy.node import Node
from example_interfaces.srv import AddTwoInts


class AddTwoIntsClient(Node):
    def __init__(self):
        super().__init__('add_two_ints_client')
        # 创建客户端, 指向服务 add_two_ints.
        self.client = self.create_client(AddTwoInts, 'add_two_ints')
        # 等服务端上线(最多等 1 秒一轮, 没等到就再等).
        while not self.client.wait_for_service(timeout_sec=1.0):
            self.get_logger().info('等待服务端上线...')
        self.request = AddTwoInts.Request()

    def send(self, a, b):
        self.request.a = a
        self.request.b = b
        future = self.client.call_async(self.request)      # 异步发请求
        rclpy.spin_until_future_complete(self, future)     # 转着等结果
        return future.result()                             # 拿到 response


def main(args=None):
    rclpy.init(args=args)
    node = AddTwoIntsClient()
    a, b = 2, 3
    if len(sys.argv) == 3:
        a, b = int(sys.argv[1]), int(sys.argv[2])
    response = node.send(a, b)
    node.get_logger().info('%d + %d = %d' % (a, b, response.sum))
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
