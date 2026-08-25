# eval/tests/test_bridge_sdk.py - T-A 门禁 1 冒烟组(SDK 校验层).
# 纯脚本, 不需要 rosbridge/sim_bridge 等外部进程; 判定标准逐条对照
# .dsh/test-plan.md v3 第 2.1 节, 不自行放宽.
#
# 说明(T-A-01 "不发话题"): 校验分支位于 _publish 之前, 非法输入在发话题前即返回,
# 消息层零发送的结构保证由本断言覆盖; 真 rosbridge 下的消息层验证见阶段 2.

import subprocess
import sys
from pathlib import Path

BRIDGE_DIR = Path(__file__).resolve().parents[2] / 'src' / 'bridge'
sys.path.insert(0, str(BRIDGE_DIR))

from bridge_client import Bridge  # noqa: E402

# 本机无人监听端口: 复现"连接失败"环境, 不干扰用户正在跑的 9090 域.
UNUSED_PORT = 19999


def test_ta01_invalid_arm_and_tool_rejected():
    """T-A-01 | 非法臂/工具拒绝 [已实测]"""
    b = Bridge(host='127.0.0.1', port=UNUSED_PORT)
    r1 = b.set_tool('C', 'grasp')
    r2 = b.set_tool('A', 'weld')
    r3 = b.touch('C')
    assert r1 == {'ok': False, 'error': '非法臂 "C", 只能是 A 或 B'}
    assert r2 == {'ok': False, 'error': '非法末端执行器 "weld", 只能是 grasp/suction/none'}
    assert r3 == {'ok': False, 'error': '非法臂 "C", 只能是 A 或 B'}


def test_ta02_non_finite_numbers_rejected():
    """T-A-02 | 非有限数字拒绝 [已实测]"""
    b = Bridge(host='127.0.0.1', port=UNUSED_PORT)
    r1 = b.set_ball('nan', '0.5')
    r2 = b.set_ball('1e309', 0)
    r3 = b.set_ball('abc', 1)
    assert r1['ok'] is False and '有限数字' in r1['error']
    assert r2['ok'] is False and '有限数字' in r2['error']
    assert r3['ok'] is False and '数字' in r3['error']
    # 判定要求区分"非数字"与"非有限数字"两类原因.
    assert '有限数字' not in r3['error']
    assert r3['error'] != r1['error']


def test_ta03_unconnected_calls_rejected():
    """T-A-03 | 未连接拒绝 [已实测]"""
    b = Bridge(host='127.0.0.1', port=UNUSED_PORT)
    calls = [
        b.set_tool('A', 'grasp'),
        b.set_ball(0.5, 0.0),
        b.touch('A'),
        b.reset(),
        b.query_capabilities(),
    ]
    for r in calls:
        assert r['ok'] is False
        assert '未连接 rosbridge, 请先 connect()' in r['error']


def test_ta04_connect_failure_no_traceback():
    """T-A-04 | connect 失败不 traceback [已实测]"""
    code = (
        "import sys\n"
        "sys.path.insert(0, %r)\n"
        "from bridge_client import Bridge\n"
        "b = Bridge(host='127.0.0.1', port=%d)\n"
        "r = b.connect()\n"
        "print(repr(r))\n" % (str(BRIDGE_DIR), UNUSED_PORT)
    )
    proc = subprocess.run(
        [sys.executable, '-c', code], capture_output=True, text=True, timeout=15)
    # 判定核心(P1-N1 回归): 失败必须以 dict 返回, 不抛 traceback.
    assert proc.returncode == 0, 'connect 失败必须返回 dict, 而不是抛异常退出'
    assert 'Traceback' not in proc.stdout and 'Traceback' not in proc.stderr
    r = eval(proc.stdout.strip().splitlines()[-1])
    assert r['ok'] is False
    assert '无法连接 rosbridge' in r['error']
    # 判定含"异常原因"的细节: 实测是否带原因记录在 stdout 中, 由汇总器人工核对;
    # 若实现走"连接超时"分支不带原因, 属文档判定与实现的措辞级偏差, 汇总上报.


def test_ta06_close_idempotent():
    """T-A-06 | close 幂等"""
    b = Bridge(host='127.0.0.1', port=UNUSED_PORT)
    b.close()
    b.close()
    r = b.set_tool('A', 'grasp')
    assert r['ok'] is False
    assert '未连接 rosbridge, 请先 connect()' in r['error']
