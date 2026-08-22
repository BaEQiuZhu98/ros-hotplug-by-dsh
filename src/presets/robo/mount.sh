#!/usr/bin/env bash
# mount.sh - 运维侧挂载/卸载末端能力(阶段 2 场景切换辅助).
#
# 设计 §7.2: 末端执行器由人/平台/运维在运行时热插拔, agent 无感. 本脚本就是
# "运维"的那只手: 修改已安装 preset 的能力行(grasp/suction 行的 disabled 标记),
# 对应「挂载 = 作用域注册工具 / 卸载 = 移除工具」, 进程重启后生效.
#
# 用法: bash mount.sh <none|grasp|suction|both> [DSH_HOME] [profile]
#   none    = 卸载全部末端能力(场景 1: 无末端)
#   grasp   = 只挂夹爪(场景 2)
#   suction = 只挂吸盘(场景 3)
#   both    = 夹爪 + 吸盘都挂(组合/遮蔽测试用)
#   DSH_HOME: 默认 ${DSH_HOME:-$HOME/.dsh}
#   profile : 仅用于报错提示与路径提示, 能力行路径本身由 install.sh 已替换好
#
# 前置: 能力包 tarball 已用 dsh plugin --profile <name> add 装进 profile
# (node_modules 里要真的有包文件, 否则该行挂载后 boot 会失败).
set -euo pipefail

SCENE="${1:?用法: bash mount.sh <none|grasp|suction|both> [DSH_HOME] [profile]}"
DSH_HOME="${2:-${DSH_HOME:-$HOME/.dsh}}"
PROFILE="${3:-headless}"
FILE="$DSH_HOME/.agent-presets/robo/agent.cordis.yml"

if [ ! -f "$FILE" ]; then
  echo "找不到 $FILE, 请先运行 bash install.sh $DSH_HOME $PROFILE"
  exit 1
fi

case "$SCENE" in
  none|grasp|suction|both) ;;
  *) echo "未知场景 \"$SCENE\", 只能是 none/grasp/suction/both"; exit 1 ;;
esac

# 纯标准库 python3 做行编辑: 对 capability-grasp / capability-suction 两行,
# 在 id 行后写入 disabled 标记(先删掉旧标记避免重复), 其余行原样保留.
python3 - "$FILE" "$SCENE" <<'PY'
import re
import sys

path, scene = sys.argv[1], sys.argv[2]
mounted = {
    'none': [],
    'grasp': ['capability-grasp'],
    'suction': ['capability-suction'],
    'both': ['capability-grasp', 'capability-suction'],
}[scene]

lines = open(path, encoding='utf-8').read().splitlines()
out = []
for line in lines:
    m = re.match(r'^- id: (capability-(?:grasp|suction))\s*$', line)
    if m:
        rid = m.group(1)
        out.append(line)
        # 标记语义: 挂载 = disabled: false, 卸载 = disabled: true.
        out.append('  disabled: ' + ('false' if rid in mounted else 'true'))
        continue
    # 跳过旧的 disabled 标记(上一轮 mount.sh 写入的), 避免重复键.
    if re.match(r'^\s+disabled:\s*(true|false)\s*$', line):
        continue
    out.append(line)

open(path, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print('场景 = %s, 已写入 %s' % (scene, path))
for rid in ('capability-grasp', 'capability-suction'):
    state = '挂载(disabled: false)' if rid in mounted else '卸载(disabled: true)'
    print('  %s -> %s' % (rid, state))
PY

echo "下次启动 dsh --profile $PROFILE 生效."
