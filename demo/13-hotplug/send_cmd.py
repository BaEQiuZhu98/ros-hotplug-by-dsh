#!/usr/bin/env python3
"""
demo/13 - 通用 rosbridge 发送: 往指定话题发一条 std_msgs/String.

被 web 插件 host 调用(经 shell), 不 import 任何 ROS 包, 只连 rosbridge.

用法:
    python3 send_cmd.py <topic> <string>
退出码: 0 = 已发送, 1 = 无法连接 rosbridge.
"""
import sys
import time

import roslibpy


def main():
    topic = sys.argv[1] if len(sys.argv) > 1 else '/capability_command'
    payload = sys.argv[2] if len(sys.argv) > 2 else 'none'

    client = roslibpy.Ros(host='localhost', port=9090)
    client.run()
    for _ in range(30):
        if client.is_connected:
            break
        time.sleep(0.1)
    if not client.is_connected:
        print('无法连接 rosbridge (ws://localhost:9090), 请先启动它.')
        return 1

    talker = roslibpy.Topic(client, topic, 'std_msgs/String')
    talker.publish(roslibpy.Message({'data': payload}))
    print('已发送 %s = "%s"' % (topic, payload))
    time.sleep(0.5)
    talker.unadvertise()
    client.terminate()
    return 0


if __name__ == '__main__':
    sys.exit(main())
