#!/usr/bin/env bash
# install.sh - 安装 robo preset 到 DSH 的 agent preset 根(架构 v2).
#
# 用法: bash install.sh [DSH_HOME]
#   1. 把本目录(preset.yml/agent.cordis.yml/src/skills)复制到 $DSH_HOME/.agent-presets/robo.
#   2. 无路径占位需要替换(架构 v2: preset 不含能力行, 末端装配由挂载服务负责).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
DSH_HOME="${1:-${DSH_HOME:-$HOME/.dsh}}"
DEST="$DSH_HOME/.agent-presets/robo"

mkdir -p "$DEST"
cp -r "$HERE/preset.yml" "$HERE/agent.cordis.yml" "$HERE/src" "$HERE/skills" "$DEST/"

echo "已安装 robo preset: $DEST"
echo "下一步: 新建会话选 preset \"机器人任务\"; 末端装配由能力挂载服务负责(web 面板)."
