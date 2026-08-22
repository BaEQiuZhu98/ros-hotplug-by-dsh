#!/usr/bin/env python3
"""
demo/12 - 桥接客户端: 经 rosbridge WebSocket 往 /joint_command 发关节角.

这是架构里 "DSH 经 rosbridge 调 ROS2" 的关键一环. 本脚本不 import 任何 ROS 包,
只用一个 WebSocket 连到 rosbridge_server(默认 ws://localhost:9090),
把两个关节角发到 ROS2 话题 /joint_command, arm_server 收到就动.

前置:
    pip install roslibpy
    并已启动 rosbridge(见 README).

运行:
    python3 bridge_client.py 0.5 0.8
"""
import sys
import time

import roslibpy


def main():
    q1 = float(sys.argv[1]) if len(sys.argv) > 1 else 0.5
    q2 = float(sys.argv[2]) if len(sys.argv) > 2 else 0.8

    client = roslibpy.Ros(host='localhost', port=9090)
    client.run()
    # 等连接就绪(最多 3 秒).
    for _ in range(30):
        if client.is_connected:
            break
        time.sleep(0.1)
    if not client.is_connected:
        print('无法连接 rosbridge (ws://localhost:9090), 请先启动它.')
        return

    talker = roslibpy.Topic(client, '/joint_command', 'std_msgs/Float32MultiArray')
    talker.publish(roslibpy.Message({'data': [q1, q2]}))
    print('已发送 /joint_command = [%.3f, %.3f]' % (q1, q2))
    time.sleep(0.5)  # 给 WebSocket 一点时间真正发出去
    talker.unadvertise()
    client.terminate()


if __name__ == '__main__':
    main()
