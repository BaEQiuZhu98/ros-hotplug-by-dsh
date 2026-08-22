#!/usr/bin/env python3
"""
demo/13 - 挂载守卫(零信任): 能力挂载前校验 manifest 哈希.

威胁模型: 能力代码可能来自外部分发、agent 现场生成, 或存储中被篡改.
因此挂载前先"验身": 对能力代码文件重算 SHA256, 和 manifest.json 里登记的一致才放行.

用法:
    python3 mount_guard.py <capability> <tool_file>
    退出码 0 = 通过, 1 = 拒绝.
"""
import hashlib
import json
import sys

MANIFEST = 'capabilities/manifest.json'


def main():
    if len(sys.argv) < 3:
        print('用法: python3 mount_guard.py <capability> <tool_file>')
        return 1
    cap = sys.argv[1]
    tool_file = sys.argv[2]

    with open(MANIFEST) as f:
        manifest = json.load(f)
    if cap not in manifest:
        print('拒绝: manifest 里没有能力 "%s"' % cap)
        return 1

    expect = manifest[cap]['sha256']
    with open(tool_file, 'rb') as f:
        actual = hashlib.sha256(f.read()).hexdigest()

    if actual != expect:
        print('拒绝: 哈希不匹配! 期望 %s 实际 %s (代码被篡改?)' % (expect, actual))
        return 1

    print('通过: 能力 "%s" 哈希校验一致, 允许挂载.' % cap)
    return 0


if __name__ == '__main__':
    sys.exit(main())
