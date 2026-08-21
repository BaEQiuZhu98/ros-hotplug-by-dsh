#!/usr/bin/env python3
"""
demo/02 代码审查练习: 统计文本文件的行数与平均行长.

注意: 本文件故意埋了若干问题, 用于练习"让 DSH agent 审查代码".
建议先自己或让 agent 找出问题, 再看 README 里的答案.
"""
import sys


def read_lines(path):
    # 问题1: 直接 open 而没有用 with, 文件句柄不会被关闭(资源泄漏)
    f = open(path, "r")
    lines = f.readlines()
    return lines


def average_line_length(lines=[]):
    # 问题2: 可变默认参数 lines=[], 多次调用会累积上一次的数据
    total = 0
    for line in lines:
        total += len(line)
    # 问题3: 空文件时 len(lines) 为 0, 会触发除零错误
    return total / len(lines)


def main():
    if len(sys.argv) < 2:
        print("用法: python3 buggy.py <文件路径>")
        return
    lines = read_lines(sys.argv[1])
    print("行数:", len(lines))
    print("平均行长:", average_line_length(lines))


if __name__ == "__main__":
    try:
        main()
    except:  # 问题4: 裸 except 吞掉所有异常, 出错时静默失败
        pass
