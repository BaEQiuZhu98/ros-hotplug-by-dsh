#!/usr/bin/env python3
"""
demo/11 - Python 控制循环(rclpy): 高频定时器跑一个 PID, 测实际频率/抖动/耗时.

和 C++ 版(cpp_control/)做对比: 同样目标 1000 Hz 的 PID 循环, 看谁的
实际频率更高、抖动更小、单次计算更快. Python 有解释器开销和 GIL,
高频控制通常达不到目标频率, 这正是机器人控制层要用 C++ 的原因.

运行(先 source ROS2):
    python3 control_py.py
"""
import statistics
import time

import rclpy
from rclpy.node import Node

TARGET_HZ = 1000.0


class ControlLoop(Node):
    def __init__(self):
        super().__init__('control_py')
        self.period = 1.0 / TARGET_HZ
        # 定时器: 每 period 秒触发一次 tick(目标 1000 Hz).
        self.timer = self.create_timer(self.period, self.tick)
        self.last = None
        self.intervals = []
        self.compute_times = []
        self.q = 0.0
        self.integral = 0.0

    def tick(self):
        t0 = time.perf_counter()
        # ---- 假装的控制计算: PID 跟踪目标 1.0(和 C++ 版完全相同) ----
        err = 1.0 - self.q
        self.integral += err * self.period
        self.q += (20.0 * err + 40.0 * self.integral) * self.period
        # ---- 计算结束 ----
        t1 = time.perf_counter()
        if self.last is not None:
            # interval = 两次触发之间的真实间隔; compute = 这次计算本身耗时.
            self.intervals.append(t1 - self.last)
            self.compute_times.append(t1 - t0)
            if len(self.intervals) >= 2000:
                self.report()
        self.last = t1

    def report(self):
        avg = sum(self.intervals) / len(self.intervals)
        jitter = statistics.pstdev(self.intervals)   # 间隔的标准差 = 抖动
        avg_compute = sum(self.compute_times) / len(self.compute_times)
        self.get_logger().info(
            '实际频率 %.0f Hz (目标 %d Hz), 抖动 %.3f ms, 单次计算 %.3f ms'
            % (1.0 / avg, TARGET_HZ, jitter * 1000.0, avg_compute * 1000.0))
        self.intervals = []
        self.compute_times = []


def main(args=None):
    rclpy.init(args=args)
    node = ControlLoop()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
