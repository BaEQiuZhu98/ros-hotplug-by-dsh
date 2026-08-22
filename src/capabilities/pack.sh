#!/usr/bin/env bash
# pack.sh - 能力包本地发布(打包成 npm tarball).
#
# 用法: bash pack.sh [能力目录名...]    (默认打包本目录下所有能力包)
# 产出: 每个包一个 <name>-<version>.tgz, 输出到 /tmp/cap-packs/(不进仓库).
#
# 为什么用 npm pack 而不是直接 file: 安装: pack 校验 package.json 完整性,
# 产出与公开 npm 发布一致的 tarball, 本地自验证后再公开时流程不变.
set -euo pipefail

cd "$(dirname "$0")"
OUT=/tmp/cap-packs
mkdir -p "$OUT"

# npm 的缓存/日志重定向到 /tmp: pack 不需要全局 cache, 也避免污染 ~/.npm.
export npm_config_cache=/tmp/cap-npm-cache
export npm_config_logs_dir=/tmp/cap-npm-logs
mkdir -p "$npm_config_cache" "$npm_config_logs_dir"

pkgs=("$@")
if [ ${#pkgs[@]} -eq 0 ]; then
  for d in */; do
    [ -f "$d/package.json" ] && pkgs+=("${d%/}")
  done
fi

for p in "${pkgs[@]}"; do
  if [ ! -f "$p/package.json" ]; then
    echo "跳过 $p: 没有 package.json"
    continue
  fi
  echo "打包 $p ..."
  (cd "$p" && npm pack --pack-destination "$OUT")
done

echo "完成. tarball 在 $OUT:"
ls -1 "$OUT"
