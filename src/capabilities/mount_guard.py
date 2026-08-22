#!/usr/bin/env python3
"""
mount_guard.py - 挂载守卫(零信任, 阶段 0 固化, 由 demo/13 的 mount_guard.py 升级而来).

威胁模型: 能力代码可能来自外部分发、agent 现场生成, 或存储中被篡改.
因此每次挂载前先"验身": 对能力代码文件重算 SHA256, 与 manifest 里登记的一致才放行.
这是 design.zh.md §8 可靠性点 1(零信任/哈希校验)的应用层实现.

用法:
    python3 mount_guard.py <manifest.json> <capability> <tool_file>
    退出码 0 = 通过, 1 = 拒绝.

manifest.json 格式(与 demo/13 capabilities/manifest.json 相同):
    {"<capability>": {"sha256": "<hex>"}}

注: 阶段 1 会把它与 capability-spec.md 一起演进(manifest 字段随能力包定稿),
本文件只负责"校验"这一件事, 与挂载机制本身解耦.
"""
import hashlib
import json
import sys


def main():
    if len(sys.argv) < 4:
        print('用法: python3 mount_guard.py <manifest.json> <capability> <tool_file>')
        return 1
    manifest_path = sys.argv[1]
    cap = sys.argv[2]
    tool_file = sys.argv[3]

    try:
        with open(manifest_path) as f:
            manifest = json.load(f)
    except Exception as e:
        print('拒绝: 读不到 manifest %s (%s)' % (manifest_path, e))
        return 1

    if cap not in manifest:
        print('拒绝: manifest 里没有能力 "%s"' % cap)
        return 1

    expect = manifest[cap].get('sha256')
    if not expect:
        print('拒绝: 能力 "%s" 在 manifest 里缺少 sha256 字段' % cap)
        return 1

    with open(tool_file, 'rb') as f:
        actual = hashlib.sha256(f.read()).hexdigest()

    if actual != expect:
        print('拒绝: 哈希不匹配! 期望 %s 实际 %s (代码被篡改?)' % (expect, actual))
        return 1

    print('通过: 能力 "%s" 哈希校验一致, 允许挂载.' % cap)
    return 0


if __name__ == '__main__':
    sys.exit(main())
