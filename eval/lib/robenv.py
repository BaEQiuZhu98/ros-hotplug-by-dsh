# eval/lib/robenv.py - 独立 ROS 域测试环境管理.
# 域 42: rosbridge(9091) + sim_bridge(无头, 日志落盘) —— SDK 全链路隔离环境;
# 域 43: rosbridge(9092, 无 sim_bridge) —— T-A-12 查询超时环境.
# 与用户正在跑的 9090 域完全隔离; 起停由 pytest session fixture 管理.

import os
import socket
import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SIM = REPO / 'src' / 'ros2' / 'sim_bridge' / 'sim_bridge' / 'two_arm_server.py'
VENV_PY = '/root/venvs/robo/bin/python3'
ACTIVATE = 'source /root/venvs/robo/bin/activate'
ROS_SETUP = 'source /opt/ros/humble/setup.bash && '

sys.path.insert(0, str(REPO / 'src' / 'bridge'))
from bridge_client import Bridge  # noqa: E402


def wait_port(host, port, timeout=60):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection((host, port), timeout=2):
                return True
        except OSError:
            time.sleep(0.5)
    return False


class RosEnv:
    """一组 ROS 域内进程(rosbridge + 可选 sim_bridge)."""

    def __init__(self, domain, port, sim, name, logdir):
        self.domain = domain
        self.port = port
        self.sim = sim
        self.name = name
        self.logdir = Path(logdir)
        self.procs = []

    def start(self):
        try:
            self._start()
        except Exception:
            # 起环境失败也必须回收已起的进程组, 避免端口残留.
            self.stop()
            raise

    def _start(self):
        self.logdir.mkdir(parents=True, exist_ok=True)
        if wait_port('127.0.0.1', self.port, timeout=2):
            raise RuntimeError(
                self.name + ': 端口 %d 已被占用, 请先清理残留进程' % self.port)
        env = os.environ.copy()
        env['ROS_DOMAIN_ID'] = str(self.domain)
        # ros2 launch 默认写 ~/.ros/log(工作区外): 日志目录改到本环境的落盘目录.
        env['ROS_LOG_DIR'] = str(self.logdir / 'ros-log')
        rb_log = open(self.logdir / (self.name + '-rosbridge.log'), 'w')
        rb_cmd = (ROS_SETUP + ACTIVATE + ' && ros2 launch rosbridge_server '
                  'rosbridge_websocket_launch.xml port:=%d' % self.port)
        # start_new_session: 之后按进程组整体终止, 避免 launch 子树成为孤儿占端口.
        self.procs.append(subprocess.Popen(
            ['bash', '-c', rb_cmd], env=env, stdout=rb_log,
            stderr=subprocess.STDOUT, start_new_session=True))
        if not wait_port('127.0.0.1', self.port):
            raise RuntimeError(self.name + ': rosbridge 端口 %d 未就绪' % self.port)
        if self.sim:
            sim_log = open(self.logdir / (self.name + '-sim.log'), 'w')
            sim_err = open(self.logdir / (self.name + '-sim.err'), 'w')
            sim_cmd = (ROS_SETUP + ACTIVATE + ' && %s %s'
                       % (VENV_PY, SIM))
            # stderr 单独落盘: rclpy 告警走 stderr 且不缓冲, 便于测试即时断言日志.
            self.procs.append(subprocess.Popen(
                ['bash', '-c', sim_cmd], env=env,
                stdout=sim_log, stderr=sim_err, start_new_session=True))
            # 等 sim_bridge 首条 /joint_state: 轮询 query_capabilities.
            bridge = Bridge(host='127.0.0.1', port=self.port, timeout=2.0)
            deadline = time.time() + 60
            ok = False
            last = None
            while time.time() < deadline:
                bridge.connect()
                r = bridge.query_capabilities(wait=2.0)
                last = r
                if r.get('ok'):
                    ok = True
                    break
                time.sleep(1.0)
            bridge.close()
            if not ok:
                raise RuntimeError(
                    self.name + ': sim_bridge /joint_state 未就绪, 最后查询: %r' % last)

    def stop(self):
        import signal
        for p in self.procs:
            if p.poll() is None:
                try:
                    os.killpg(os.getpgid(p.pid), signal.SIGTERM)
                except (ProcessLookupError, PermissionError):
                    p.terminate()
        for p in self.procs:
            try:
                p.wait(timeout=10)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(os.getpgid(p.pid), signal.SIGKILL)
                except (ProcessLookupError, PermissionError):
                    p.kill()
        self.procs = []

    def reset_world(self):
        """世界复位: 供测试间状态清理(关节回零/末端 none/球回位)."""
        b = Bridge(host='127.0.0.1', port=self.port, timeout=2.0)
        b.connect()
        r = b.reset()
        b.close()
        return r
