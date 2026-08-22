#!/usr/bin/env python3
"""
demo/12 - 末端位置 -> 关节角(IK) -> 经 rosbridge 发送.

给定末端目标位置 (x, y)(手臂是平面二连杆, z 固定), 先用余弦定理解 IK 得到
两个关节角, 再经 rosbridge 把关节角发到 /joint_command, arm_server 收到就动.
这就是"web 插件输入末端位置"背后做的那一步.

前置: roslibpy 已装, rosbridge 已启动(见 README).

运行:
    python3 move_ee.py 0.5 0.3
"""
import math
import sys
import time

import roslibpy

A1 = 0.4  # 第一根杆长
A2 = 0.4  # 第二根杆长


def ik(x, y, elbow_up=True):
    """二连杆平面臂 IK(余弦定理), 同 demo 08. 返回 (q1, q2) 或 None(不可达)."""
    r2 = x * x + y * y
    c2 = (r2 - A1 * A1 - A2 * A2) / (2.0 * A1 * A2)
    if c2 < -1.0 or c2 > 1.0:
        return None
    s2 = math.sqrt(1.0 - c2 * c2)
    if not elbow_up:
        s2 = -s2
    q2 = math.atan2(s2, c2)
    q1 = math.atan2(y, x) - math.atan2(A2 * s2, A1 + A2 * c2)
    return q1, q2


def main():
    x = float(sys.argv[1]) if len(sys.argv) > 1 else 0.5
    y = float(sys.argv[2]) if len(sys.argv) > 2 else 0.3
    q = ik(x, y)
    if q is None:
        print('目标 (%s, %s) 超出臂展(0.0~0.8).' % (x, y))
        return
    q1, q2 = q

    client = roslibpy.Ros(host='localhost', port=9090)
    client.run()
    for _ in range(30):
        if client.is_connected:
            break
        time.sleep(0.1)
    if not client.is_connected:
        print('无法连接 rosbridge (ws://localhost:9090), 请先启动它.')
        return

    talker = roslibpy.Topic(client, '/joint_command', 'std_msgs/Float32MultiArray')
    talker.publish(roslibpy.Message({'data': [q1, q2]}))
    print('末端目标 (%s, %s) -> 关节角 [%.3f, %.3f], 已发送.' % (x, y, q1, q2))
    time.sleep(0.5)
    talker.unadvertise()
    client.terminate()


if __name__ == '__main__':
    main()
