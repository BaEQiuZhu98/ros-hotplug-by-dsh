#!/usr/bin/env python3
"""
demo/13 - 发送能力指令: 经 rosbridge 把能力名(grasp/suction)发到 /capability_command.

被能力工具(grasp_tool.js / suction_tool.js)调用. 不 import 任何 ROS 包,
只连 rosbridge(ws://localhost:9090), 发一条 std_msgs/String 到 /capability_command.

运行:
    python3 send_capability.py grasp
    python3 send_capability.py suction
"""
import sys
import time

import roslibpy


def main():
    cap = sys.argv[1] if len(sys.argv) > 1 else 'grasp'

    client = roslibpy.Ros(host='localhost', port=9090)
    client.run()
    for _ in range(30):
        if client.is_connected:
            break
        time.sleep(0.1)
    if not client.is_connected:
        print('无法连接 rosbridge (ws://localhost:9090), 请先启动它.')
        return

    talker = roslibpy.Topic(client, '/capability_command', 'std_msgs/String')
    talker.publish(roslibpy.Message({'data': cap}))
    print('已发送 /capability_command = "%s"' % cap)
    time.sleep(0.5)
    talker.unadvertise()
    client.terminate()


if __name__ == '__main__':
    main()
