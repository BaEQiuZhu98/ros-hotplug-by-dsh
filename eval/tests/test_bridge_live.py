# eval/tests/test_bridge_live.py - T-A 门禁 2 组(SDK 全链路 + daemon + CLI).
# 需要机器人侧进程: 域 42(rosbridge 9091 + sim_bridge 无头, fixture rosenv42)、
# 域 43(rosbridge 9092 无 sim_bridge, fixture rosenv43)、
# 以及用户已运行的 9090 域(daemon/CLI 固定连接 9090, 见各用例 notes).
# 判定标准对照 .dsh/test-plan.md v3 第 2.2/2.3/2.7 节.
#
# 连接类用例统一走独立子进程: roslibpy 的 twisted reactor 是进程级单例,
# 同一 pytest 进程内不能反复创建 Bridge, 否则 ReactorNotRestartable.

import json
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
BRIDGE = REPO / 'src' / 'bridge' / 'bridge_client.py'
VENV_PY = '/root/venvs/robo/bin/python3'

pytestmark = pytest.mark.gate2

LIVE_PORT = 9090  # 用户正在运行的 rosbridge(daemon/CLI 无端口参数, 固定 9090)


def run_bridge(code_lines, port, timeout=90):
    """在独立子进程内执行一段桥接操作序列, 返回 CompletedProcess.

    子进程 stdout 首行是 connect 结果 JSON, 之后每行是脚本里 print 的结果.
    """
    code = '\n'.join(code_lines)
    full = (
        'import sys, json, time\n'
        "sys.path.insert(0, %(bridge)r)\n"
        'from bridge_client import Bridge\n'
        "b = Bridge(host='127.0.0.1', port=%(port)d, timeout=3.0)\n"
        "print(json.dumps(b.connect(), ensure_ascii=False), flush=True)\n"
        '%(code)s\n'
        'b.close()\n'
    ) % {'bridge': str(REPO / 'src' / 'bridge'), 'port': port, 'code': code}
    return subprocess.run(
        [VENV_PY, '-c', full], capture_output=True, text=True, timeout=timeout)


def out_lines(proc):
    return [json.loads(x) for x in proc.stdout.strip().splitlines()]


def test_ta12_query_timeout(rosenv43):
    """T-A-12 | query 超时"""
    proc = run_bridge([
        't0 = time.time()',
        'r = b.query_capabilities(wait=2.0)',
        'print(json.dumps({"ok": r.get("ok"), "error": r.get("error"), "elapsed": time.time() - t0}, ensure_ascii=False))',
    ], port=9092)
    lines = out_lines(proc)
    r = lines[1]
    assert r['ok'] is False
    assert '超时未收到' in r['error']
    assert r['elapsed'] <= 3.0, '超时返回耗时 %.2fs 超过 3s' % r['elapsed']


def test_ta05_connect_idempotent(rosenv42):
    """T-A-05 | connect 幂等"""
    proc = run_bridge([
        'c1 = b.client',
        'print(json.dumps(b.connect(), ensure_ascii=False))',
        'print(json.dumps(b.client is c1, ensure_ascii=False))',
    ], port=9091)
    lines = out_lines(proc)
    assert lines[0] == {'ok': True}
    assert lines[1] == {'ok': True}
    assert lines[2] is True, '第二次 connect 不应重建连接对象'


def test_ta07_set_tool_full_chain(rosenv42):
    """T-A-07 | set_tool 全链路"""
    proc = run_bridge([
        'print(json.dumps(b.set_tool("A", "grasp"), ensure_ascii=False))',
        'print(json.dumps(b.query_capabilities(wait=2.0), ensure_ascii=False))',
    ], port=9091)
    lines = out_lines(proc)
    assert lines[1] == {'ok': True}
    caps = lines[2]['caps']
    assert caps['tools']['A'] == 'grasp'
    assert caps.get('v') == 1, '载荷需符合契约 §3.4(v=1), 实际: %r' % caps


def test_ta08_set_ball_full_chain(rosenv42):
    """T-A-08 | set_ball 全链路"""
    proc = run_bridge([
        'print(json.dumps(b.set_ball(0.2, -0.3), ensure_ascii=False))',
        'print(json.dumps(b.query_capabilities(wait=2.0), ensure_ascii=False))',
    ], port=9091)
    lines = out_lines(proc)
    assert lines[1] == {'ok': True}
    ball = lines[2]['caps']['ball']
    assert len(ball) == 2
    assert abs(ball[0] - 0.2) < 1e-9 and abs(ball[1] - (-0.3)) < 1e-9


def test_ta27_set_tool_none(rosenv42):
    """T-A-27 | set_tool none 复位语义"""
    proc = run_bridge([
        'print(json.dumps(b.set_tool("A", "none"), ensure_ascii=False))',
        'print(json.dumps(b.query_capabilities(wait=2.0), ensure_ascii=False))',
    ], port=9091)
    lines = out_lines(proc)
    assert lines[1] == {'ok': True}
    assert lines[2]['caps']['tools']['A'] == 'none'


def test_ta09_touch_full_chain(rosenv42):
    """T-A-09 | touch 全链路(含无末端拒绝) [脚本]+[人工]"""
    proc = run_bridge([
        'print(json.dumps(b.reset(), ensure_ascii=False))',
        'print(json.dumps(b.set_tool("A", "grasp"), ensure_ascii=False))',
        'print(json.dumps(b.touch("A"), ensure_ascii=False))',
        # ① 关节角向 IK 解收敛(设计目标阈值: 2s 内相邻采样 |Δ|<1e-3).
        'converged = False',
        'deadline = time.time() + 2.0',
        'prev = None',
        'while time.time() < deadline:',
        '    joints = b.query_capabilities(wait=2.0)["caps"]["joints"]["A"]',
        '    if prev is not None:',
        '        if max(abs(a - c) for a, c in zip(prev, joints)) < 1e-3:',
        '            converged = True',
        '            break',
        '    prev = joints',
        '    time.sleep(0.2)',
        'print(json.dumps({"converged": converged, "joints": joints}, ensure_ascii=False))',
        # ② B 无末端 touch: SDK publish 成功, 物理无动作.
        'before = b.query_capabilities(wait=2.0)["caps"]["joints"]["B"]',
        'print(json.dumps(b.touch("B"), ensure_ascii=False))',
        'time.sleep(0.5)',
        'after = b.query_capabilities(wait=2.0)["caps"]["joints"]["B"]',
        'print(json.dumps({"before": before, "after": after}, ensure_ascii=False))',
    ], port=9091)
    lines = out_lines(proc)
    assert lines[3] == {'ok': True}, 'touch(A) publish 应成功: %r' % lines
    assert lines[4]['converged'] is True, '2s 内关节角未收敛'
    assert lines[5] == {'ok': True}, 'touch(B) SDK 层 publish 应成功'
    assert lines[6]['before'] == lines[6]['after'], '无末端 touch 后关节角不应变化'
    sim_err = latest_log('d42-sim.err')
    assert '没有配置末端执行器' in sim_err, 'sim_bridge 应告警拒绝无末端触碰'


def latest_log(name):
    """读取最新一轮(按修改时间)含该文件的机器人侧日志文件."""
    runs = sorted((REPO / 'eval' / 'results').glob('run-*'), key=lambda p: p.stat().st_mtime, reverse=True)
    for run in runs:
        log = run / name
        if log.exists():
            return log.read_text(encoding='utf-8', errors='replace')
    raise FileNotFoundError(name)


def test_ta10_reset_full_chain(rosenv42):
    """T-A-10 | reset 全链路 [已实测]"""
    proc = run_bridge([
        'print(json.dumps(b.set_tool("A", "grasp"), ensure_ascii=False))',
        'print(json.dumps(b.set_tool("B", "suction"), ensure_ascii=False))',
        'print(json.dumps(b.set_ball(0.1, 0.2), ensure_ascii=False))',
        'print(json.dumps(b.reset(), ensure_ascii=False))',
        'time.sleep(0.3)',
        'print(json.dumps(b.query_capabilities(wait=2.0), ensure_ascii=False))',
    ], port=9091)
    lines = out_lines(proc)
    assert lines[4] == {'ok': True}
    caps = lines[5]['caps']
    assert caps['tools'] == {'A': 'none', 'B': 'none'}
    ball = caps['ball']
    assert abs(ball[0] - 0.5) < 1e-6 and abs(ball[1] - 0.0) < 1e-6


def test_ta11_query_structure(rosenv42):
    """T-A-11 | query 结构完整性"""
    proc = run_bridge([
        'for _ in range(3):',
        '    print(json.dumps(b.query_capabilities(wait=2.0), ensure_ascii=False))',
    ], port=9091)
    lines = out_lines(proc)
    assert len(lines) == 4
    for r in lines[1:]:
        caps = r['caps']
        assert set(caps.keys()) >= {'v', 'joints', 'tools', 'ball'}
        assert isinstance(caps['v'], int)
        for arm in ('A', 'B'):
            assert isinstance(caps['joints'][arm], list)
            assert len(caps['joints'][arm]) == 2
            assert isinstance(caps['tools'][arm], str)
        assert isinstance(caps['ball'], list) and len(caps['ball']) == 2




def spawn_daemon():
    proc = subprocess.Popen(
        [VENV_PY, str(BRIDGE), 'daemon'],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, text=True, cwd=str(REPO))
    return proc


def test_ta13_daemon_ready_handshake(hostsim):
    """T-A-13 | 就绪握手 [已实测](notes: daemon 无端口参数, 连用户 9090 域)"""
    proc = spawn_daemon()
    try:
        first = proc.stdout.readline().strip()
        assert json.loads(first) == {'ok': True, 'daemon': 'ready'}
    finally:
        proc.stdin.close()
        proc.wait(timeout=10)


def test_ta14_daemon_fifo(hostsim):
    """T-A-14 | 串行 FIFO 一一对应(notes: 连用户 9090 域, 测后 reset 恢复世界)"""
    proc = spawn_daemon()
    try:
        assert 'ready' in proc.stdout.readline()
        requests = [
            {'method': 'set_tool', 'args': ['A', 'none']},
            {'method': 'set_ball', 'args': [0.5, 0.0]},
            {'method': 'touch', 'args': ['A']},
            {'method': 'reset', 'args': []},
            {'method': 'query_capabilities', 'args': []},
        ]
        for req in requests:
            proc.stdin.write(json.dumps(req, ensure_ascii=False) + '\n')
        proc.stdin.flush()
        lines = [proc.stdout.readline().strip() for _ in range(5)]
        assert len(lines) == 5
        parsed = [json.loads(x) for x in lines]
        # 前四条无 caps 字段, 最后一条 query 含 caps: 响应与请求顺序一一对应.
        for p in parsed[:4]:
            assert p.get('ok') is True and 'caps' not in p
        assert parsed[4].get('ok') is True and 'caps' in parsed[4]
    finally:
        proc.stdin.close()
        proc.wait(timeout=10)


def test_ta28_cli_exit_codes(hostsim):
    """T-A-28 | CLI 模式退出码约定(notes: CLI 固定 9090, connect 失败分支由 T-A-04 覆盖)"""
    # ① 参数不足: exit 1, stdout 为 {ok:false, error:用法} JSON(修复后与判定一致).
    r1 = subprocess.run([VENV_PY, str(BRIDGE)], capture_output=True, text=True)
    assert r1.returncode == 1
    body1 = json.loads(r1.stdout.strip().splitlines()[-1])
    assert body1['ok'] is False and '用法' in body1['error']
    # ② 未知方法: 连接成功后 exit 1, stdout 为 {ok:false} JSON.
    r2 = subprocess.run([VENV_PY, str(BRIDGE), 'no_such_method'],
                        capture_output=True, text=True, timeout=30)
    assert r2.returncode == 1
    body = json.loads(r2.stdout.strip().splitlines()[-1])
    assert body['ok'] is False and '未知方法' in body['error']
    # ③ 成功: exit 0, stdout 为 JSON 且含 caps.
    r3 = subprocess.run([VENV_PY, str(BRIDGE), 'query_capabilities'],
                        capture_output=True, text=True, timeout=30)
    assert r3.returncode == 0
    body3 = json.loads(r3.stdout.strip().splitlines()[-1])
    assert body3['ok'] is True and 'caps' in body3
