#!/usr/bin/env bash
# install.sh - 安装 robo preset 到 DSH 的 agent preset 根, 并替换能力包路径占位.
#
# 用法: bash install.sh [DSH_HOME] [profile]
#   DSH_HOME: 默认 ${DSH_HOME:-$HOME/.dsh}
#   profile : 能力包所在的 profile(默认 headless), 能力包须已用 dsh plugin add 装好
#
# 做的事:
#   1. 把本目录(preset.yml/agent.cordis.yml/src/skills)复制到 $DSH_HOME/.agent-presets/robo.
#   2. 把 agent.cordis.yml 里的 __CAPABILITY_BASE__ 替换为
#      $DSH_HOME/profiles/<profile>/node_modules(pnpm hoisted 根).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
DSH_HOME="${1:-${DSH_HOME:-$HOME/.dsh}}"
PROFILE="${2:-headless}"
DEST="$DSH_HOME/.agent-presets/robo"
CAP_BASE="$DSH_HOME/profiles/$PROFILE/node_modules"

mkdir -p "$DEST"
cp -r "$HERE/preset.yml" "$HERE/agent.cordis.yml" "$HERE/src" "$HERE/skills" "$DEST/"
sed -i "s|__CAPABILITY_BASE__|$CAP_BASE|g" "$DEST/agent.cordis.yml"

echo "已安装 robo preset: $DEST"
echo "能力包基路径 = $CAP_BASE"
echo "下一步: 新建会话选 preset \"机器人任务\", 或在 settings 设 agent-presets.default: robo"
