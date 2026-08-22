#!/usr/bin/env python3
"""
demo/10 - 服务(service)服务端: 收到两个整数, 返回它们的和.

服务 = 一问一答: 客户端发一次请求, 服务端处理完返回一次结果(像打电话).
和话题(持续广播)不同, 服务是"一次请求一次应答", 适合"算一下/查一下"这类调用.

运行(先 source ROS2):
    python3 add_two_ints_server.py
"""
import rclpy
from rclpy.node import Node
from example_interfaces.srv import AddTwoInts


class AddTwoIntsServer(Node):
    def __init__(self):
        super().__init__('add_two_ints_server')
        # 创建服务: 类型 AddTwoInts, 名字 add_two_ints, 回调 callback.
        self.srv = self.create_service(AddTwoInts, 'add_two_ints', self.callback)

    def callback(self, request, response):
        # request 是请求(含 a, b), response 是要返回的结果(含 sum).
        response.sum = request.a + request.b
        self.get_logger().info('收到 %d + %d, 返回 %d' % (request.a, request.b, response.sum))
        return response


def main(args=None):
    rclpy.init(args=args)
    node = AddTwoIntsServer()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
