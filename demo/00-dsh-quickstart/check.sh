#!/usr/bin/env bash
# demo/00 环境自检: 检查 node / npm / dsh / API key 是否就绪.
set -u

echo "== DSH quickstart 环境自检 =="

if command -v node >/dev/null 2>&1; then
  echo "node: $(node -v)"
else
  echo "node: 未安装(需要 Node.js >= 20)"
fi

if command -v npm >/dev/null 2>&1; then
  echo "npm:  $(npm -v)"
else
  echo "npm:  未安装"
fi

if command -v dsh >/dev/null 2>&1; then
  echo "dsh:  $(dsh --version 2>/dev/null || echo '已安装(版本未知)')"
else
  echo "dsh:  未安装(运行: npm install -g @deepseek-ai/dsh)"
fi

if [ -n "${DEEPSEEK_API_KEY:-}" ]; then
  echo "DEEPSEEK_API_KEY: 已设置(长度 ${#DEEPSEEK_API_KEY})"
else
  echo "DEEPSEEK_API_KEY: 未设置(运行: export DEEPSEEK_API_KEY=\"sk-...\")"
fi

echo "== 完成 =="
