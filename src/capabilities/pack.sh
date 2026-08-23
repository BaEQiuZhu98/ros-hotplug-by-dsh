#!/usr/bin/env bash
# pack.sh - 能力发布外壳(架构 v2): 把能力仓库目录打包成 npm tarball.
#
# 用法: bash pack.sh <cap> <version> [<cap2> <version2> ...]
#   从 repo/<cap>/<version> 复制到临时目录, 生成发布用 package.json, npm pack.
#   产出: ros-hotplug-dsh-plugin-<cap>-<version>.tgz, 输出到 /tmp/cap-packs/.
#
# 为什么还需要 npm 外壳: 能力仓库目录是一等交付件(挂载服务直接加载);
# 公开分发时用 tarball 装机, 解包进目标机器的能力仓库后走同一挂载服务(安装 != 挂载).
set -euo pipefail

cd "$(dirname "$0")"
REPO=repo
OUT=/tmp/cap-packs
TMP=/tmp/cap-pack-tmp
mkdir -p "$OUT"

# npm 的缓存/日志重定向到 /tmp: pack 不需要全局 cache, 也避免污染 ~/.npm.
export npm_config_cache=/tmp/cap-npm-cache
export npm_config_logs_dir=/tmp/cap-npm-logs
mkdir -p "$npm_config_cache" "$npm_config_logs_dir"

if [ $# -eq 0 ] || [ $(( $# % 2 )) -ne 0 ]; then
  echo "用法: bash pack.sh <cap> <version> [<cap2> <version2> ...]"
  exit 1
fi

while [ $# -gt 0 ]; do
  cap="$1"; version="$2"; shift 2
  src="$REPO/$cap/$version"
  if [ ! -f "$src/host.js" ] || [ ! -f "$src/manifest.json" ]; then
    echo "跳过 $cap@$version: 仓库目录不完整($src)"
    continue
  fi
  echo "打包 $cap@$version ..."
  rm -rf "$TMP"; mkdir -p "$TMP/package"
  cp "$src/host.js" "$src/manifest.json" "$TMP/package/"
  # 发布用 package.json: 名称/版本来自能力与版本目录; 仅作分发载体, 不含挂载语义.
  cat > "$TMP/package/package.json" <<EOF
{
  "name": "@ros-hotplug/dsh-plugin-$cap",
  "version": "$version",
  "description": "ROS hot-plug capability: $cap end-effector tool (capability repo directory, mounted by the mount service)",
  "type": "module",
  "license": "MIT"
}
EOF
  (cd "$TMP/package" && npm pack --pack-destination "$OUT" >/dev/null)
done

echo "完成. tarball 在 $OUT:"
ls -1 "$OUT"
