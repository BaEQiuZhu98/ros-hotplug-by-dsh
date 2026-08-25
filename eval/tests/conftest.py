# eval/tests/conftest.py - pytest 结果汇总器.
# 把每个用例的判定与输出收进 eval/results/run-<utc时间戳>/pytest.json,
# 供 eval/lib/summary.py 聚合为 SUMMARY.md.
# 用例标识约定: 测试函数 docstring 第一行形如 "T-A-01 | 非法臂/工具拒绝 [已实测]".

import json
import time
from pathlib import Path

import pytest

RESULTS_ROOT = Path(__file__).resolve().parents[1] / 'results'
RUN_ID = time.strftime('%Y%m%d-%H%M%S', time.gmtime())
RUN_DIR = RESULTS_ROOT / ('run-' + RUN_ID)

RECORDS = []
_DOCS = {}


@pytest.fixture(scope='session')
def rosenv42():
    """独立 ROS 域 42: rosbridge 9091 + sim_bridge(无头, 日志落盘)."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lib'))
    from robenv import RosEnv
    env = RosEnv(domain=42, port=9091, sim=True, name='d42',
                 logdir=RUN_DIR)
    env.start()
    yield env
    env.stop()


@pytest.fixture(scope='session')
def rosenv43():
    """独立 ROS 域 43: rosbridge 9092, 无 sim_bridge(T-A-12 超时环境)."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lib'))
    from robenv import RosEnv
    env = RosEnv(domain=43, port=9092, sim=False, name='d43',
                 logdir=RUN_DIR)
    env.start()
    yield env
    env.stop()


@pytest.fixture(scope='session')
def hostsim():
    """宿主域 0 的 rosbridge(9090)+sim_bridge 支撑环境: daemon/CLI 用例固定连 9090,
    需要该域有 /joint_state 发布者. 若用户 rosbridge(9090)未在运行, 自起测试实例,
    测后终止——不改变用户环境状态(用户未运行时自起自清)."""
    import subprocess
    import time as _time
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lib'))
    from robenv import Bridge
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    sim = Path(__file__).resolve().parents[2] / 'src' / 'ros2' / 'sim_bridge' / 'sim_bridge' / 'two_arm_server.py'
    log = open(RUN_DIR / 'hostsim.log', 'w')
    procs = []

    def port_open():
        import socket
        try:
            with socket.create_connection(('127.0.0.1', 9090), timeout=1):
                return True
        except OSError:
            return False

    if not port_open():
        rb = subprocess.Popen(
            ['bash', '-c', 'source /opt/ros/humble/setup.bash && source /root/venvs/robo/bin/activate && '
             'HOME=/root ros2 launch rosbridge_server rosbridge_websocket_launch.xml port:=9090'],
            stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        procs.append(rb)
        deadline = _time.time() + 60
        while _time.time() < deadline and not port_open():
            _time.sleep(1.0)
    proc = subprocess.Popen(
        ['bash', '-c', 'source /opt/ros/humble/setup.bash && source /root/venvs/robo/bin/activate && '
         'HOME=/root /root/venvs/robo/bin/python3 %s' % sim],
        stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    procs.append(proc)
    b = Bridge(host='127.0.0.1', port=9090, timeout=2.0)
    # 就绪轮询放独立子进程: 每次子进程全新(规避 pytest 主进程里 roslibpy 单 reactor
    # 限制), 且 connect 失败自动重试(瞬时可恢复故障不误杀 fixture).
    check_code = (
        'import sys\n'
        "sys.path.insert(0, %r)\n"
        'from bridge_client import Bridge\n'
        "b = Bridge(host='127.0.0.1', port=9090, timeout=3.0)\n"
        "r1 = b.connect()\n"
        "r2 = b.query_capabilities(wait=2.0)\n"
        "print('QUERY_OK' if (r1.get('ok') and r2.get('ok')) else repr((r1, r2)))\n"
        'b.close()\n' % str(Path(__file__).resolve().parents[2] / 'src' / 'bridge')
    )
    deadline = _time.time() + 90
    ok = False
    last = None
    while _time.time() < deadline:
        check = subprocess.run(
            ['/root/venvs/robo/bin/python3', '-c', check_code],
            capture_output=True, text=True, timeout=40)
        last = (check.stdout or check.stderr).strip()
        if 'QUERY_OK' in check.stdout:
            ok = True
            break
        _time.sleep(2.0)
    if not ok:
        import os
        import signal
        for p in procs:
            try:
                os.killpg(os.getpgid(p.pid), signal.SIGKILL)
            except (ProcessLookupError, PermissionError):
                p.kill()
        raise RuntimeError('hostsim: 宿主 9090 域未出现 /joint_state, 最后检查: %r' % (last,))
    yield proc
    import os
    import signal
    for p in procs:
        try:
            os.killpg(os.getpgid(p.pid), signal.SIGTERM)
        except (ProcessLookupError, PermissionError):
            p.terminate()
    for p in procs:
        try:
            p.wait(timeout=10)
        except subprocess.TimeoutExpired:
            p.kill()


def pytest_runtest_makereport(item, call):
    if call.when == 'call':
        doc = (item.function.__doc__ or '').strip()
        head = doc.splitlines()[0] if doc else ''
        parts = [p.strip() for p in head.split('|')]
        _DOCS[item.nodeid] = {
            'case_id': parts[0] if parts else item.name,
            'name': parts[1] if len(parts) > 1 else item.name,
            'tags': parts[2] if len(parts) > 2 else '',
            'duration_s': round(call.duration, 3),
        }


def pytest_runtest_logreport(report):
    # xfail 状态只在 logreport 的 wasxfail 字段可见(pytest 6 的 call 阶段 excinfo 是原始异常).
    if report.when != 'call':
        return
    meta = _DOCS.get(report.nodeid, {})
    if report.skipped and getattr(report, 'wasxfail', None):
        verdict = 'expected-fail'
        error = str(report.longrepr)[:500]
    elif report.skipped:
        verdict = 'skip'
        error = str(report.longrepr)
    elif report.failed:
        verdict = 'fail'
        error = str(report.longrepr)[:500]
    else:
        verdict = 'pass'
        error = None
    RECORDS.append({
        'case_id': meta.get('case_id', report.nodeid),
        'name': meta.get('name', ''),
        'tags': meta.get('tags', ''),
        'verdict': verdict,
        'duration_s': meta.get('duration_s', 0),
        'error': error,
    })


def pytest_sessionfinish(session, exitstatus):
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    total = len(RECORDS)
    passed = sum(1 for r in RECORDS if r['verdict'] == 'pass')
    out = {
        'run_id': RUN_ID,
        'phase': 'gate1-unit',
        'exitstatus': exitstatus,
        'summary': {'total': total, 'pass': passed, 'fail': total - passed},
        'cases': RECORDS,
    }
    (RUN_DIR / 'pytest.json').write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')
    print('')
    print('results: ' + str(RUN_DIR / 'pytest.json'))
