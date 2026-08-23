#!/usr/bin/env bash
# install.sh - 安装 robo preset 到 DSH 的 agent preset 根(设计 §10.4).
#
# 用法: bash install.sh [DSH_HOME] [profile]
#   1. 把本目录(preset.yml/agent.cordis.yml/src/skills)复制到 $DSH_HOME/.agent-presets/robo.
#   2. 把臂管理器包(arm_manager/)复制到 $DSH_HOME/profiles/<profile>/node_modules/
#      下(树外包包形态: 其 import @deepseek-ai/dsh-scope 经 profiles/node_modules 回退解析).
#   3. 把 agent.cordis.yml 里的 __ARM_MANAGER__ 占位替换为臂管理器包绝对路径.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
DSH_HOME="${1:-${DSH_HOME:-$HOME/.dsh}}"
PROFILE="${2:-headless}"
DEST="$DSH_HOME/.agent-presets/robo"
ARM_PKG_DIR="$DSH_HOME/profiles/$PROFILE/node_modules/@ros-hotplug/dsh-plugin-arm-manager"

mkdir -p "$DEST"
cp -r "$HERE/preset.yml" "$HERE/agent.cordis.yml" "$HERE/src" "$HERE/skills" "$DEST/"

mkdir -p "$ARM_PKG_DIR"
cp -r "$HERE/arm_manager/." "$ARM_PKG_DIR/"
sed -i "s|__ARM_MANAGER__|$ARM_PKG_DIR|g" "$DEST/agent.cordis.yml"

echo "已安装 robo preset: $DEST"
echo "臂管理器包: $ARM_PKG_DIR"
echo "下一步: 新建会话选 preset \"机器人任务\"; 末端装配由能力挂载体系负责(web 面板)."
