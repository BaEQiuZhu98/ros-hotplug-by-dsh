#!/usr/bin/env bash
# eval/hotplug/assemble-env.sh - 装配 /tmp 独立 eval 环境(网络命名空间隔离).
#
# 环境: DSH_HOME=/tmp/eval-dsh, netns 内 rosbridge(9090, 域 43) + sim_bridge(无头),
#       dsh web 监听 3199(stdout 落盘), 挂载服务 repo 指向副本目录(可注入坏版本,
#       不触碰仓库 src/).
# 用法: bash assemble-env.sh [start|stop] [--with-driver <js>] [--no-sim] [--fake-python <path>]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
EVAL_HOME=/tmp/eval-dsh
NETNS=evalns
LOGDIR="$REPO_ROOT/eval/results/logs"
REPO_COPY="$REPO_ROOT/eval/hotplug/fixtures/repo-copy"
PROFILE="$EVAL_HOME/profiles/web"
VENV_PY=/root/venvs/robo/bin/python3
PORT=3199
ACTION="${1:-start}"
DRIVER=""
NO_SIM=0
FAKE_PYTHON=""

shift || true
while [ $# -gt 0 ]; do
  case "$1" in
    --with-driver) DRIVER="$2"; shift 2 ;;
    --no-sim) NO_SIM=1; shift ;;
    --fake-python) FAKE_PYTHON="$2"; shift 2 ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
done

start_env() {
  mkdir -p "$LOGDIR"
  # 0. 副本 repo: 从仓库能力目录全新复制(注入层, 不碰 src/).
  rm -rf "$REPO_COPY"
  mkdir -p "$REPO_COPY"
  cp -r "$REPO_ROOT/src/capabilities/repo/." "$REPO_COPY/"

  # 1. DSH_HOME 骨架: profile 清单 + patch 层(挂载服务行 repo 指向副本).
  rm -rf "$EVAL_HOME"
  mkdir -p "$PROFILE/node_modules"
  cat > "$PROFILE/package.json" <<EOF
{"name":"dsh-profile-web-eval","private":true,"dependencies":{},"dsh":{"profile":{"bundles":["@deepseek-ai/dsh-base","@deepseek-ai/dsh-web-app"]}}}
EOF
  PY_FOR_CFG="$VENV_PY"
  [ -n "$FAKE_PYTHON" ] && PY_FOR_CFG="$FAKE_PYTHON"
  cat > "$PROFILE/cordis.patch.yml" <<EOF
- insert:
  - id: capability-mount-service
    name: $REPO_ROOT/src/capabilities/mount_service/host.js
    config:
      repo: $REPO_COPY
      workdir: $REPO_ROOT
      python: $PY_FOR_CFG
- insert:
  - id: cap-mount-panel
    name: '@ros-hotplug/dsh-plugin-cap-mount-panel'
    inject: [capabilityMount]
- id: webserver
  config:
    host: '127.0.0.1'
    port: $PORT
EOF
  if [ -n "$DRIVER" ]; then
    cat >> "$PROFILE/cordis.patch.yml" <<EOF
- insert:
  - id: eval-driver
    name: $DRIVER
    inject: [capabilityMount]
EOF
  fi
  # 面板包复制进 profile node_modules(与 setup.sh 同形态).
  mkdir -p "$PROFILE/node_modules/@ros-hotplug/dsh-plugin-cap-mount-panel"
  cp -r "$REPO_ROOT/src/packages/cap-mount-panel/." \
        "$PROFILE/node_modules/@ros-hotplug/dsh-plugin-cap-mount-panel/"
  rm -rf "$PROFILE/node_modules/@ros-hotplug/dsh-plugin-cap-mount-panel/node_modules"

  # 1.5. robo preset(编程创建会话时 mount('robo') 需要它在 roster 里).
  bash "$REPO_ROOT/src/presets/robo/install.sh" "$EVAL_HOME" web >/dev/null

  # 2. netns: 域 43 rosbridge(9090) + 可选 sim_bridge(setsid 起, PID 落盘).
  ip netns del "$NETNS" 2>/dev/null || true
  ip netns add "$NETNS"
  ip netns exec "$NETNS" ip link set lo up
  ip netns exec "$NETNS" bash -c "
    source /opt/ros/humble/setup.bash && source /root/venvs/robo/bin/activate
    export HOME=/root ROS_DOMAIN_ID=43 ROS_LOG_DIR=$LOGDIR
    mkdir -p $LOGDIR
    setsid bash -c 'ros2 launch rosbridge_server rosbridge_websocket_launch.xml port:=9090' \
      > '$LOGDIR/eval-rosbridge.log' 2>&1 &
    echo \$! > '$LOGDIR/eval-rosbridge.pid'
    if [ '$NO_SIM' = '0' ]; then
      setsid bash -c '$VENV_PY $REPO_ROOT/src/ros2/sim_bridge/sim_bridge/two_arm_server.py' \
        > '$LOGDIR/eval-sim.log' 2>&1 &
      echo \$! > '$LOGDIR/eval-sim.pid'
    fi
    echo started
  "

  # 2.5. 等 rosbridge 9090 就绪(launch 启动需数秒; 就绪前 dsh web 的挂载服务
  # daemon 会连接失败). 超时报错并退出, 不带着坏环境继续.
  for i in $(seq 1 30); do
    if ip netns exec "$NETNS" bash -c '(echo > /dev/tcp/127.0.0.1/9090) 2>/dev/null' 2>/dev/null; then
      break
    fi
    sleep 1
    if [ "$i" = 30 ]; then
      echo "rosbridge 9090 未就绪, 详见 $LOGDIR/eval-rosbridge.log"
      exit 1
    fi
  done

  # 3. dsh web(3199, stdout 落盘供断言), PID 落盘供精确清理.
  ip netns exec "$NETNS" bash -c "
    export HOME=/root DSH_HOME=$EVAL_HOME ROS_LOG_DIR=$LOGDIR
    setsid bash -c 'dsh --profile web' > '$LOGDIR/eval-web.log' 2>&1 &
    echo \$! > '$LOGDIR/eval-web.pid'
    echo web-started
  "
  echo "已装配: DSH_HOME=$EVAL_HOME, netns=$NETNS, 日志=$LOGDIR"
}

stop_env() {
  for pidfile in eval-web.pid eval-rosbridge.pid eval-sim.pid; do
    if [ -f "$LOGDIR/$pidfile" ]; then
      pid="$(cat "$LOGDIR/$pidfile" 2>/dev/null || true)"
      [ -n "$pid" ] && kill -- "-$pid" 2>/dev/null || true
    fi
  done
  ip netns del "$NETNS" 2>/dev/null || true
  echo "已清理 netns=$NETNS"
}

case "$ACTION" in
  start) start_env ;;
  stop) stop_env ;;
  *) echo "用法: assemble-env.sh [start|stop] ..."; exit 1 ;;
esac
