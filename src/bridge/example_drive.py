#!/usr/bin/env python3
"""
example_drive.py - 阶段 0 验证脚本: 一个普通 Python 脚本经 SDK 驱动 sim_bridge.

验证目标(HANDOFF 阶段 0 的验收线): 不 import 任何 ROS 包, 只用 bridge_client.py,
就能切末端执行器、设小球、触球、读回能力集, 证明桥接层 + 仿真桥闭环可用.

前置(3 个终端):
    终端 1: ros2 launch rosbridge_server rosbridge_websocket_launch.xml
    终端 2: source /opt/ros/humble/setup.bash && source /root/venvs/robo/bin/activate
            python3 src/ros2/sim_bridge/sim_bridge/two_arm_server.py   # headless 即可
    终端 3(本脚本, 用 venv 的 python3, 因为系统 python3 没有 roslibpy):
            /root/venvs/robo/bin/python3 src/bridge/example_drive.py

预期: 每步都打印 ok 结果; 终端 2 里出现 tool_config/touch_command 日志;
最后一步读回 tools 包含 "A": "grasp".
"""
import sys
import time

sys.path.insert(0, 'src/bridge')  # 允许直接从仓库根运行(不安装 SDK 也能用).
from bridge_client import Bridge

steps = [
    ('set_tool(A, grasp)', lambda: bridge.set_tool('A', 'grasp')),
    ('set_tool(B, suction)', lambda: bridge.set_tool('B', 'suction')),
    ('set_ball(0.3, 0.2)', lambda: bridge.set_ball(0.3, 0.2)),
    ('touch(A)', lambda: bridge.touch('A')),
    ('set_tool(A, none) 非法后校验', lambda: bridge.set_tool('A', 'laser')),
    ('set_ball 非法输入校验', lambda: bridge.set_ball('abc', 1)),
]


def main():
    global bridge
    bridge = Bridge()

    print('step 0: 连接 rosbridge ...')
    result = bridge.connect()
    if not result['ok']:
        print('answer: 验证失败 -', result['error'])
        return 1
    print('step 0: ok')

    for i, (label, fn) in enumerate(steps, start=1):
        print('step %d: %s' % (i, label))
        result = fn()
        print('step %d: %r' % (i, result))

    # 等 sim_bridge 处理完指令并回传一轮 /joint_state, 再查能力集.
    print('step %d: query_capabilities(等待回传) ...' % (len(steps) + 1))
    time.sleep(0.5)
    caps = bridge.query_capabilities(wait=2.0)
    print('step %d: %r' % (len(steps) + 1, caps))

    bridge.close()

    # 验收: 能力集里 tools 必须是 A=grasp, B=suction.
    if not caps.get('ok'):
        print('answer: 验证失败 - %s' % caps.get('error'))
        return 1
    tools = caps['caps'].get('tools', {})
    if tools.get('A') == 'grasp' and tools.get('B') == 'suction':
        print('answer: 阶段 0 验证通过 - 普通 Python 脚本经 SDK 成功驱动 sim_bridge.')
        return 0
    print('answer: 验证失败 - tools 与预期不符: %r' % tools)
    return 1


if __name__ == '__main__':
    sys.exit(main())
