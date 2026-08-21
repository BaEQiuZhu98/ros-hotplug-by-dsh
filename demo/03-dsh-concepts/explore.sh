#!/usr/bin/env bash
# demo/03: 探查 DSH 的"一切皆插件"组合结构. 说明见 README.
set -u

echo "== 1. npm 全局安装根 =="
GLOBAL_ROOT="$(npm root -g 2>/dev/null)"
if [ -n "$GLOBAL_ROOT" ]; then
  echo "$GLOBAL_ROOT"
else
  echo "(未找到 npm 全局根, 请确认已安装 Node/npm)"
fi

echo ""
echo "== 2. 内置 agent presets =="
PRESET_DIR="$GLOBAL_ROOT/@deepseek-ai/dsh/config/agent-presets"
if [ -d "$PRESET_DIR" ]; then
  ls -1 "$PRESET_DIR"
else
  echo "(未找到 $PRESET_DIR)"
fi

echo ""
echo "== 3. standard preset 的组合文件(前 40 行) =="
if [ -f "$PRESET_DIR/standard/agent.cordis.yml" ]; then
  head -40 "$PRESET_DIR/standard/agent.cordis.yml"
else
  echo "(未找到 standard/agent.cordis.yml)"
fi

echo ""
echo "== 4. dump web profile 默认配置树(前 30 行) =="
if command -v dsh >/dev/null 2>&1; then
  # 注意: --dump-default-config 不是独立开关, 必须配合 profile 使用.
  # 这里用 dsh web 这个别名(等价于 --profile web).
  dsh web --dump-default-config 2>/dev/null | head -30
else
  echo "(dsh 未安装)"
fi

echo ""
echo "== 完成 =="
