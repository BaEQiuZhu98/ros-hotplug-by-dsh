#!/usr/bin/env python3
"""
demo/07 - 刚体变换: 旋转矩阵 / 欧拉角 / 四元数 / 齐次变换.

核心问题: 怎么用数学描述"位置 + 朝向", 并把"转一下 + 移一下"一路接力,
          算出机械臂末端在哪. 本文件只讲数学, 不依赖 mujoco.

用法:
    python3 transforms.py
"""
import numpy as np


def rot_x(a):
    """绕 X 轴旋转 a 弧度, 返回 3x3 旋转矩阵."""
    c, s = np.cos(a), np.sin(a)
    return np.array([[1.0, 0.0, 0.0],
                     [0.0, c, -s],
                     [0.0, s, c]])


def rot_y(a):
    """绕 Y 轴旋转 a 弧度, 返回 3x3 旋转矩阵."""
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, 0.0, s],
                     [0.0, 1.0, 0.0],
                     [-s, 0.0, c]])


def rot_z(a):
    """绕 Z 轴旋转 a 弧度, 返回 3x3 旋转矩阵."""
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, -s, 0.0],
                     [s, c, 0.0],
                     [0.0, 0.0, 1.0]])


def euler_to_matrix(rpy):
    """欧拉角 -> 旋转矩阵. 采用 XYZ 固定角(等价于绕体轴 ZYX). 输入 [rx, ry, rz]."""
    rx, ry, rz = rpy
    return rot_z(rz) @ rot_y(ry) @ rot_x(rx)


def quat_to_matrix(q):
    """四元数 -> 旋转矩阵. q 顺序为 [w, x, y, z](与 MuJoCo / ROS2 一致)."""
    w, x, y, z = q
    return np.array([
        [1.0 - 2.0 * (y * y + z * z), 2.0 * (x * y - z * w), 2.0 * (x * z + y * w)],
        [2.0 * (x * y + z * w), 1.0 - 2.0 * (x * x + z * z), 2.0 * (y * z - x * w)],
        [2.0 * (x * z - y * w), 2.0 * (y * z + x * w), 1.0 - 2.0 * (x * x + y * y)],
    ])


def matrix_to_quat(R):
    """旋转矩阵 -> 四元数(Shepperd 方法, 数值稳定). 返回 [w, x, y, z]."""
    tr = R[0, 0] + R[1, 1] + R[2, 2]
    if tr > 0.0:
        S = np.sqrt(tr + 1.0) * 2.0
        w = 0.25 * S
        x = (R[2, 1] - R[1, 2]) / S
        y = (R[0, 2] - R[2, 0]) / S
        z = (R[1, 0] - R[0, 1]) / S
    elif R[0, 0] > R[1, 1] and R[0, 0] > R[2, 2]:
        S = np.sqrt(1.0 + R[0, 0] - R[1, 1] - R[2, 2]) * 2.0
        w = (R[2, 1] - R[1, 2]) / S
        x = 0.25 * S
        y = (R[0, 1] + R[1, 0]) / S
        z = (R[0, 2] + R[2, 0]) / S
    elif R[1, 1] > R[2, 2]:
        S = np.sqrt(1.0 + R[1, 1] - R[0, 0] - R[2, 2]) * 2.0
        w = (R[0, 2] - R[2, 0]) / S
        x = (R[0, 1] + R[1, 0]) / S
        y = 0.25 * S
        z = (R[1, 2] + R[2, 1]) / S
    else:
        S = np.sqrt(1.0 + R[2, 2] - R[0, 0] - R[1, 1]) * 2.0
        w = (R[1, 0] - R[0, 1]) / S
        x = (R[0, 2] + R[2, 0]) / S
        y = (R[1, 2] + R[2, 1]) / S
        z = 0.25 * S
    q = np.array([w, x, y, z])
    return q / np.linalg.norm(q)


def axis_angle_to_matrix(axis, angle):
    """轴角 -> 旋转矩阵(Rodrigues 公式). axis 会被归一化. 这是第四种朝向写法."""
    axis = np.asarray(axis, dtype=float)
    axis = axis / np.linalg.norm(axis)
    K = np.array([[0.0, -axis[2], axis[1]],
                  [axis[2], 0.0, -axis[0]],
                  [-axis[1], axis[0], 0.0]])
    return np.eye(3) + np.sin(angle) * K + (1.0 - np.cos(angle)) * (K @ K)


def make_ht(R, t):
    """由旋转 R 和平移 t 组成 4x4 齐次变换: 一次搞定"先转再移"."""
    T = np.eye(4)
    T[:3, :3] = R
    T[:3, 3] = t
    return T


def apply_ht(T, p):
    """用齐次变换 T 变换一个三维点 p, 返回变换后的点."""
    p = np.asarray(p, dtype=float)
    ph = np.ones(4)
    ph[:3] = p
    return (T @ ph)[:3]


def section(title):
    print("\n" + "=" * 56)
    print(title)
    print("=" * 56)


def main():
    np.set_printoptions(precision=4, suppress=True)

    section("第一层: 位置 = 3 个数")
    pos = np.array([2.0, 0.0, 1.0])
    print("手机在房间里的位置(离墙, 离地, 离门) =", pos)
    print("一个点的位置, 用 3 个数 [x, y, z] 就能说清.")

    section("第二层: 朝向还需要另外 3 个数")
    print("手机在同一个位置, 还可以竖着/横着/面朝上摆, 所以光有位置不够.")
    print("位置(3 个数) + 朝向(3 个数) = 位姿, 共 6 个自由度.")
    rpy = np.array([0.3, -0.5, 0.8])
    R = euler_to_matrix(rpy)
    q = matrix_to_quat(R)
    print("\n同一个朝向, 三种等价写法(就像 0.5 = 1/2 = 50%):")
    print("  写法 1 - 欧拉角(绕 X/Y/Z 各转多少) :", rpy, "rad")
    print("  写法 2 - 旋转矩阵(3x3 朝向说明书) :")
    print("          ", R[0])
    print("          ", R[1])
    print("          ", R[2])
    print("  写法 3 - 四元数(4 个数的压缩包)   :", np.round(q, 4))
    R2 = quat_to_matrix(q)
    print("\n互转验证: 四元数 -> 矩阵, 再和原矩阵比, 最大误差 =", np.max(np.abs(R - R2)))
    print("误差接近 0, 说明三种写法说的是同一个朝向, 没丢信息.")

    section("第三层: 变换 = 转一下 + 移一下")
    print("例子: 你从原点出发, 面朝 +Z 方向, 依次做:")
    print("  (1) 右转 q0 = 0.5 rad")
    print("  (2) 向前走 L1 = 0.4 米")
    print("  (3) 再右转 q1 = 0.8 rad")
    print("  (4) 再向前走 L2 = 0.4 米")
    q0, q1 = 0.5, 0.8
    L1 = L2 = 0.4
    # "向前走" 是沿着"你当前面朝的方向"走, 所以先转、再沿新朝向走一段.
    d1 = rot_y(q0) @ np.array([0.0, 0.0, 1.0])      # 转完 q0 后面朝的方向(单位向量)
    p1 = d1 * L1                                     # 沿这个方向走 L1
    d2 = rot_y(q0 + q1) @ np.array([0.0, 0.0, 1.0])  # 再转 q1 后面朝的方向
    p2 = p1 + d2 * L2                                # 再沿新方向走 L2
    print("\n你现在的位置 =", np.round(p2, 4))
    print("把人换成机械臂的两根杆, 就是 arm.py 里的正向运动学(FK).")

    section("打包: 齐次变换 = 旋转 + 平移 合成一个 4x4")
    t = np.array([0.1, 0.2, 0.3])
    T = make_ht(R, t)
    print("旋转 R + 平移 t =", t, "打包成一个 4x4 矩阵 T:")
    print(T)
    p = np.array([1.0, 2.0, 3.0])
    print("一个点 p =", p, "被 T 一次变换到 T*p =", apply_ht(T, p))
    print("4x4 矩阵一次搞定先转再移, 机械臂每一根杆都这样接力.")


if __name__ == "__main__":
    main()
