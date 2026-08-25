#!/usr/bin/env bash
# setup.sh - 一键安装(路径集中化): git clone 后跑本脚本即可把挂载体系接入 DSH.
#
# 用法: bash src/setup.sh [DSH_HOME] [profile] [venv-python]
#   DSH_HOME    默认 ${DSH_HOME:-$HOME/.dsh}
#   profile     默认 web(挂载服务所在 profile; 面板与机器人会话都跑在这个 profile)
#   venv-python 默认 /root/venvs/robo/bin/python3(装有 roslibpy + mujoco)
#
# 做的事:
#   1. 把能力挂载服务行写入 $DSH_HOME/profiles/<profile>/cordis.patch.yml(幂等):
#      repo/workdir/python 全部取本机实际路径 —— 这是全项目唯一的路径来源,
#      面板与臂管理器都从挂载服务的 env() 读取, 不再各自硬编码.
#   2. 安装 robo preset 与臂管理器包(调 src/presets/robo/install.sh).
#   3. 打印后续步骤(重启 web / 建会话 / 起机器人侧).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
DSH_HOME="${1:-${DSH_HOME:-$HOME/.dsh}}"
PROFILE="${2:-web}"
PYTHON="${3:-/root/venvs/robo/bin/python3}"

if [ ! -x "$PYTHON" ]; then
  echo "找不到 venv python: $PYTHON"
  echo "请先建好装有 roslibpy 与 mujoco 的 venv, 再以 bash src/setup.sh <DSH_HOME> <profile> <venv-python> 运行."
  exit 1
fi
"$PYTHON" -c 'import roslibpy, mujoco' 2>/dev/null || {
  echo "$PYTHON 缺少 roslibpy 或 mujoco, 请先 pip install."
  exit 1
}

PROFILE_DIR="$DSH_HOME/profiles/$PROFILE"
PATCH_FILE="$PROFILE_DIR/cordis.patch.yml"
mkdir -p "$PROFILE_DIR"

# 0. profile 基础清单(幂等): 不存在则按 profile 名写默认 bundles(web/headless 模板).
PROFILE_MANIFEST="$PROFILE_DIR/package.json"
if [ ! -f "$PROFILE_MANIFEST" ]; then
  case "$PROFILE" in
    web)      BUNDLES='["@deepseek-ai/dsh-base","@deepseek-ai/dsh-web-app"]' ;;
    headless) BUNDLES='["@deepseek-ai/dsh-base","@deepseek-ai/dsh-headless"]' ;;
    *)        BUNDLES='["@deepseek-ai/dsh-base"]' ;;
  esac
  cat > "$PROFILE_MANIFEST" <<EOF
{"name":"dsh-profile-$PROFILE","private":true,"dependencies":{},"dsh":{"profile":{"bundles":$BUNDLES}}}
EOF
  echo "profile 清单已创建: $PROFILE_MANIFEST"
fi

# 1. 挂载服务行(幂等): 已存在则跳过, 否则追加到 profile 的 patch 层.
# loader 可能把用户 patch 写回为 "[]"(空列表): 视为无挂载服务行, 重新写入.
if [ -f "$PATCH_FILE" ] && grep -q 'id: capability-mount-service' "$PATCH_FILE" && ! grep -q '^\[\]$' "$PATCH_FILE"; then
  echo "挂载服务行已存在于 $PATCH_FILE, 跳过写入(如需改路径请手工更新该行 config)."
else
  if [ -f "$PATCH_FILE" ]; then
    echo "" >> "$PATCH_FILE"
  else
    cat > "$PATCH_FILE" <<'HEADER'
# Your patch layer for this dsh profile, applied after every bundle layer:
# a top-level YAML array of loader patch entries (id-targeted config
# overrides, disables, and insert lists; `!!js` expressions allowed).

HEADER
  fi
  cat >> "$PATCH_FILE" <<EOF
- insert:
  - id: capability-mount-service
    name: $REPO/src/capabilities/mount_service/host.js
    config:
      repo: $REPO/src/capabilities/repo
      workdir: $REPO
      python: $PYTHON
EOF
  echo "挂载服务行已写入 $PATCH_FILE"
fi

# 1.5. 面板树外包包(架构 v2 写入口, P2-12 持久化): 复制进 profile node_modules
#     并写入 patch 行. host 半部零构建; client 半部(lib/client.js)是仓库内已构建产物,
#     改面板源码后先在本包目录 pnpm run bundle 再跑本脚本.
PANEL_PKG_NAME='@ros-hotplug/dsh-plugin-cap-mount-panel'
PANEL_PKG_DIR="$PROFILE_DIR/node_modules/$PANEL_PKG_NAME"
mkdir -p "$PANEL_PKG_DIR"
cp -r "$REPO/src/packages/cap-mount-panel/." "$PANEL_PKG_DIR/"
rm -rf "$PANEL_PKG_DIR/node_modules"
if grep -q 'id: cap-mount-panel' "$PATCH_FILE" 2>/dev/null; then
  echo "面板行已存在于 $PATCH_FILE, 跳过写入."
else
  cat >> "$PATCH_FILE" <<EOF
- insert:
  - id: cap-mount-panel
    name: '$PANEL_PKG_NAME'
    inject: [capabilityMount]
EOF
  echo "面板行已写入 $PATCH_FILE"
fi

# 2. robo preset + 臂管理器包.
bash "$REPO/src/presets/robo/install.sh" "$DSH_HOME" "$PROFILE"

# 3. 后续指引.
echo ""
echo "===== 安装完成, 后续步骤 ====="
echo "1. 重启 dsh web(挂载服务与面板在启动时加载): Ctrl-C 后重新运行 dsh web"
echo "2. 刷新页面: 面板(末端能力)常驻输入区上方, 无需再动态激活"
echo "3. 新建会话选 preset「机器人任务」(robo 会话注册臂上下文)"
echo "4. 机器人侧(另开终端):"
echo "   ros2 launch rosbridge_server rosbridge_websocket_launch.xml"
echo "   source /opt/ros/humble/setup.bash && source $(dirname "$PYTHON")/activate && python3 $REPO/src/ros2/sim_bridge/sim_bridge/two_arm_server.py --view"
echo "5. 在「机器人任务」会话页面用面板装/卸末端, 点「去拿小球」交给 agent 决策执行."
