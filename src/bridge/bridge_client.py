#!/usr/bin/env python3
"""
bridge_client.py - 桥接薄 SDK(阶段 0 固化, 由 demo/12 的 bridge_client.py 升级而来).

职责: 能力开发者(DSH 插件 host)与普通 Python 脚本共用的唯一桥接入口.
把 rosbridge 的 WebSocket 细节全部隐藏, 校验内置, 任何方法失败都返回 {ok, error}.

方法(见 bridge/contract.md §4):
    connect()                   建立 rosbridge 连接
    set_tool(arm, tool)         切末端执行器(arm ∈ {A,B}; tool ∈ {grasp,suction,none})
    set_ball(x, y)              设置小球位置(有限数字)
    home(arm)                   该臂关节回原位(伸直, 不动末端与小球)
    touch(arm)                  选臂触碰小球
    move_to(arm, x, y, timeout) 收敛完成式移动到指定 XY(契约 v1.2, 返回 {ok, ee, ball})
    query_capabilities(wait)    读 /joint_state 回传, 返回当前能力集
    close()                     断开连接

为什么把校验放进 SDK: 能力可能来自外部分发或 agent 现场生成, 输入不可信;
校验集中在一处, 能力开发者免写校验, 也保证非法输入不进入 ROS2.

依赖: roslibpy(装在项目 venv /root/venvs/robo, 系统 python3 没有).
"""
import json
import math
import threading
import time

import roslibpy

VALID_ARMS = ('A', 'B')
VALID_TOOLS = ('grasp', 'suction', 'none')


class Bridge:
    def __init__(self, host='localhost', port=9090, timeout=3.0):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.client = None

    # ---------- 连接管理 ----------

    def connect(self):
        """连接 rosbridge, 最多等 timeout 秒. 返回 {ok, error}."""
        if self.client is not None and self.client.is_connected:
            return {'ok': True}
        self.client = roslibpy.Ros(host=self.host, port=self.port)
        try:
            self.client.run()
        except Exception as e:
            # 契约 §5: 任何失败都以 {ok:false, error} 返回, 不抛 traceback.
            self.client = None
            return {'ok': False, 'error': '无法连接 rosbridge (ws://%s:%d): %s' % (self.host, self.port, e)}
        deadline = time.time() + self.timeout
        while time.time() < deadline:
            if self.client.is_connected:
                return {'ok': True}
            time.sleep(0.05)
        return {'ok': False, 'error': '无法连接 rosbridge (ws://%s:%d)' % (self.host, self.port)}

    def close(self):
        """断开连接. 重复调用无副作用."""
        if self.client is not None:
            try:
                self.client.terminate()
            except Exception:
                pass
            self.client = None

    def _publish(self, topic, payload):
        """向话题发一条 std_msgs/String. 返回 {ok, error}."""
        if self.client is None or not self.client.is_connected:
            return {'ok': False, 'error': '未连接 rosbridge, 请先 connect()'}
        try:
            talker = roslibpy.Topic(self.client, topic, 'std_msgs/String')
            talker.publish(roslibpy.Message({'data': payload}))
            # 给 WebSocket 一点时间真正发出, 然后回收话题句柄.
            time.sleep(0.1)
            talker.unadvertise()
            return {'ok': True}
        except Exception as e:
            return {'ok': False, 'error': '发布 %s 失败: %s' % (topic, e)}

    # ---------- 能力方法(校验内置, 见 contract.md §4) ----------

    def set_tool(self, arm, tool):
        """切换末端执行器. 非法输入直接拒绝, 不进 ROS2."""
        if arm not in VALID_ARMS:
            return {'ok': False, 'error': '非法臂 "%s", 只能是 A 或 B' % arm}
        if tool not in VALID_TOOLS:
            return {'ok': False, 'error': '非法末端执行器 "%s", 只能是 grasp/suction/none' % tool}
        return self._publish('/tool_config', '%s:%s' % (arm, tool))

    def set_ball(self, x, y):
        """设置小球 XY 位置. x/y 必须是有限数字."""
        try:
            fx, fy = float(x), float(y)
        except (TypeError, ValueError):
            return {'ok': False, 'error': '小球位置必须是数字, 收到 %r, %r' % (x, y)}
        if not (math.isfinite(fx) and math.isfinite(fy)):
            return {'ok': False, 'error': '小球位置必须是有限数字, 收到 %r, %r' % (x, y)}
        return self._publish('/ball_position', '%s,%s' % (fx, fy))

    def home(self, arm):
        """该臂关节回原位(伸直). 只动指定臂, 不改变末端装配与小球."""
        if arm not in VALID_ARMS:
            return {'ok': False, 'error': '非法臂 "%s", 只能是 A 或 B' % arm}
        return self._publish('/home_command', arm)

    def touch(self, arm):
        """选臂触碰小球. 若该臂无末端, sim_bridge 侧会拒绝并告警."""
        if arm not in VALID_ARMS:
            return {'ok': False, 'error': '非法臂 "%s", 只能是 A 或 B' % arm}
        return self._publish('/touch_command', arm)

    def move_to(self, arm, x, y, timeout=3.0):
        """契约 v1.2 收敛完成式: 发布 /move_to 后订阅回传, 等该臂末端(ee)到达
        目标附近才返回——「返回即已到位」. 返回 {ok, ee, ball} 或 {ok:false, error}.
        收敛主判据: ee 距目标 < 0.02 m; 辅助: 相邻两次采样稳定. 超时必须小于
        挂载服务 bridge 层的 5s 兜底(契约不变量)."""
        if arm not in VALID_ARMS:
            return {'ok': False, 'error': '非法臂 "%s", 只能是 A 或 B' % arm}
        try:
            fx, fy = float(x), float(y)
        except (TypeError, ValueError):
            return {'ok': False, 'error': '移动目标必须是数字, 收到 %r, %r' % (x, y)}
        if not (math.isfinite(fx) and math.isfinite(fy)):
            return {'ok': False, 'error': '移动目标必须是有限数字, 收到 %r, %r' % (x, y)}
        if self.client is None or not self.client.is_connected:
            return {'ok': False, 'error': '未连接 rosbridge, 请先 connect()'}
        published = self._publish('/move_to', '%s:%s,%s' % (arm, fx, fy))
        if not published.get('ok'):
            return published
        target = (fx, fy)
        deadline = time.time() + timeout
        result = {}
        result_ready = threading.Event()

        def on_message(message):
            try:
                caps = json.loads(message.get('data', '{}'))
            except Exception:
                return
            ee = caps.get('ee', {}).get(arm)
            ball = caps.get('ball')
            if ball is not None:
                result['ball'] = ball
            if not (isinstance(ee, list) and len(ee) == 2):
                return
            dist = math.hypot(ee[0] - target[0], ee[1] - target[1])
            last = result.get('last_ee')
            if last is not None and abs(last[0] - ee[0]) < 0.02 and abs(last[1] - ee[1]) < 0.02:
                result['stable'] = result.get('stable', 0) + 1
            else:
                result['stable'] = 0
            result['last_ee'] = list(ee)
            if dist < 0.02 and result.get('stable', 0) >= 1:
                result['ok'] = True
                result['ee'] = list(ee)
                result_ready.set()

        topic = roslibpy.Topic(self.client, '/joint_state', 'std_msgs/String')
        try:
            topic.subscribe(on_message)
            if not result_ready.wait(timeout):
                return {'ok': False, 'error': 'move_to 收敛超时(%.1fs): 末端未到达目标' % timeout}
            return {'ok': True, 'ee': result['ee'], 'ball': result['ball']}
        except Exception as e:
            return {'ok': False, 'error': 'move_to 订阅回传失败: %s' % e}
        finally:
            try:
                topic.unsubscribe()
            except Exception:
                pass

    def reset(self):
        """全部复位(契约 v1.1): 关节归零 + 末端全部卸下 + 小球回初始位置."""
        return self._publish('/reset_command', 'reset')

    def query_capabilities(self, wait=2.0):
        """订阅 /joint_state, 等到最新一条回传后返回能力集.

        返回: {"ok": true, "caps": {...}} 或 {"ok": false, "error": ...}.
        caps 内容见 contract.md §3.4(joints/tools/ball).
        """
        if self.client is None or not self.client.is_connected:
            return {'ok': False, 'error': '未连接 rosbridge, 请先 connect()'}
        got = threading.Event()
        latest = {}

        def on_message(message):
            try:
                latest.update(json.loads(message.get('data', '{}')))
            except Exception as e:
                latest['parse_error'] = str(e)
            got.set()

        topic = roslibpy.Topic(self.client, '/joint_state', 'std_msgs/String')
        try:
            topic.subscribe(on_message)
            if not got.wait(wait):
                return {'ok': False, 'error': '超时未收到 /joint_state(请确认 sim_bridge 已启动)'}
            return {'ok': True, 'caps': latest}
        except Exception as e:
            return {'ok': False, 'error': '订阅 /joint_state 失败: %s' % e}
        finally:
            try:
                topic.unsubscribe()
            except Exception:
                pass


def daemon_main():
    """常驻模式(P2-10): stdin 逐行读 JSON 命令, 复用同一条 rosbridge 连接, stdout 逐行回 JSON.
    命令: {"method": "set_tool|set_ball|home|touch|move_to|reset|query_capabilities", "args": [...]}
    首行输出 {"ok": true, "daemon": "ready"} 表示就绪; 之后每请求一行响应."""
    import sys
    bridge = Bridge()
    ok = bridge.connect()
    if not ok['ok']:
        print(json.dumps(ok, ensure_ascii=False), flush=True)
        sys.exit(1)
    print(json.dumps({'ok': True, 'daemon': 'ready'}, ensure_ascii=False), flush=True)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        # 断线重连(T-A-26): rosbridge 重启/闪断后 roslibpy 客户端不会自动恢复服务,
        # 持续返回"未连接". 这里检测连接断开即输出明确错误行并退出进程,
        # 由挂载服务的 daemon 状态机(exit 事件)在下一次调用时重建 daemon 并重新连接.
        if bridge.client is None or not bridge.client.is_connected:
            print(json.dumps({'ok': False, 'error': '未连接 rosbridge, 请先 connect()'},
                             ensure_ascii=False), flush=True)
            sys.exit(1)
        try:
            req = json.loads(line)
        except Exception as e:
            print(json.dumps({'ok': False, 'error': '请求不是 JSON: ' + str(e)}, ensure_ascii=False), flush=True)
            continue
        method = req.get('method')
        args = req.get('args', [])
        if method == 'set_tool' and len(args) >= 2:
            result = bridge.set_tool(args[0], args[1])
        elif method == 'set_ball' and len(args) >= 2:
            result = bridge.set_ball(args[0], args[1])
        elif method == 'home' and len(args) >= 1:
            result = bridge.home(args[0])
        elif method == 'touch' and len(args) >= 1:
            result = bridge.touch(args[0])
        elif method == 'move_to' and len(args) >= 3:
            result = bridge.move_to(args[0], args[1], args[2])
        elif method == 'reset':
            result = bridge.reset()
        elif method == 'query_capabilities':
            result = bridge.query_capabilities()
        else:
            result = {'ok': False, 'error': '未知方法或参数不足: %r' % (req,)}
        print(json.dumps(result, ensure_ascii=False), flush=True)
    bridge.close()


if __name__ == '__main__':
    # CLI 入口(给能力包 host.js 等外部调用方用): 一行命令 = 一次连接 + 一次调用,
    # 结果以 JSON 打印(机器可读), 退出码 0 = ok, 1 = 失败.
    # 用法: bridge_client.py set_tool A grasp | set_ball x y | touch A | reset | query_capabilities
    import sys as _sys

    if len(_sys.argv) < 2:
        # 失败路径统一输出 JSON(契约 §5, T-A-28): 参数不足也是 {ok:false} + 退出码 1.
        print(json.dumps({'ok': False, 'error': '用法: bridge_client.py <set_tool ARM TOOL|set_ball X Y|home ARM|touch ARM|reset|query_capabilities|daemon>'},
                         ensure_ascii=False))
        _sys.exit(1)
    method = _sys.argv[1]
    if method == 'daemon':
        daemon_main()
        _sys.exit(0)
    bridge = Bridge()
    ok = bridge.connect()
    if not ok['ok']:
        print(json.dumps(ok, ensure_ascii=False))
        _sys.exit(1)
    try:
        if method == 'set_tool' and len(_sys.argv) >= 4:
            result = bridge.set_tool(_sys.argv[2], _sys.argv[3])
        elif method == 'set_ball' and len(_sys.argv) >= 4:
            result = bridge.set_ball(_sys.argv[2], _sys.argv[3])
        elif method == 'home' and len(_sys.argv) >= 3:
            result = bridge.home(_sys.argv[2])
        elif method == 'touch' and len(_sys.argv) >= 3:
            result = bridge.touch(_sys.argv[2])
        elif method == 'move_to' and len(_sys.argv) >= 5:
            result = bridge.move_to(_sys.argv[2], _sys.argv[3], _sys.argv[4])
        elif method == 'reset':
            result = bridge.reset()
        elif method == 'query_capabilities':
            result = bridge.query_capabilities()
        else:
            result = {'ok': False, 'error': '未知方法或参数不足: %r' % _sys.argv[1:]}
    finally:
        bridge.close()
    print(json.dumps(result, ensure_ascii=False))
    _sys.exit(0 if result.get('ok') else 1)
