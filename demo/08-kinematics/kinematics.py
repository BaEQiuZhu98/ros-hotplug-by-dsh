#!/usr/bin/env python3
"""
demo/08 - 运动学: DH 参数 + 正向运动学(FK) + 逆运动学(IK, 解析法 + 数值 Jacobian).

核心问题: demo 07 会了"已知关节角, 算末端在哪"(FK). 这一章反过来:
          给定末端目标位置, 反解出关节角(IK), 再代回 FK 验证确实到位.

手臂: 两关节(肩 + 肘), 都绕 Z 轴转, 杆长 a1 = a2 = 0.4, 在 X-Y 平面.
      这是教科书里最经典的"平面二连杆", 解析 IK 有闭式解(余弦定理).

只依赖 numpy, 不依赖 mujoco.

用法:
    python3 kinematics.py
"""
import math

import numpy as np

A1 = 0.4  # 第一根杆长
A2 = 0.4  # 第二根杆长


def dh(a, alpha, d, theta):
    """经典 DH 参数 -> 4x4 齐次变换.

    每个关节用 4 个数描述: a(杆长), alpha(扭转), d(偏置), theta(转角).
    变换 = RotZ(theta) -> TransZ(d) -> TransX(a) -> RotX(alpha).
    """
    ca, sa = np.cos(alpha), np.sin(alpha)
    ct, st = np.cos(theta), np.sin(theta)
    return np.array([
        [ct, -st * ca, st * sa, a * ct],
        [st, ct * ca, -ct * sa, a * st],
        [0.0, sa, ca, d],
        [0.0, 0.0, 0.0, 1.0],
    ])


def fk(q1, q2):
    """正向运动学: 关节角 -> 末端位置 [x, y]. 用 DH 表逐关节乘起来."""
    # DH 表: 关节1 = (a=A1, alpha=0, d=0, theta=q1), 关节2 = (a=A2, alpha=0, d=0, theta=q2).
    T01 = dh(A1, 0.0, 0.0, q1)
    T12 = dh(A2, 0.0, 0.0, q2)
    T02 = T01 @ T12
    p = T02 @ np.array([0.0, 0.0, 0.0, 1.0])
    # 等价几何公式(两条绕 Z 的旋转相加): x = a1*cos(q1) + a2*cos(q1+q2), y = a1*sin(q1) + a2*sin(q1+q2).
    return np.array([p[0], p[1]])


def ik_analytic(px, py, elbow_up=True):
    """逆运动学(解析法, 余弦定理): 末端目标 [px, py] -> 关节角 [q1, q2].

    二连杆平面臂有闭式解, 而且有两种姿态: 肘朝上 / 肘朝下.
    返回 None 表示目标超出臂展(不可达).
    """
    r2 = px * px + py * py
    c2 = (r2 - A1 * A1 - A2 * A2) / (2.0 * A1 * A2)
    if c2 < -1.0 or c2 > 1.0:
        return None
    s2 = np.sqrt(1.0 - c2 * c2)
    if not elbow_up:
        s2 = -s2
    q2 = np.arctan2(s2, c2)
    q1 = np.arctan2(py, px) - np.arctan2(A2 * s2, A1 + A2 * c2)
    return np.array([q1, q2])


def jacobian(q1, q2):
    """雅可比 J: 把"关节角速度"映射成"末端线速度"的 2x2 矩阵.

    J 的每一列是"这个关节单独转一点点, 末端往哪个方向动".
    反过来用它, 就能把"末端误差"反推成"关节该修正多少".
    """
    return np.array([
        [-A1 * np.sin(q1) - A2 * np.sin(q1 + q2), -A2 * np.sin(q1 + q2)],
        [A1 * np.cos(q1) + A2 * np.cos(q1 + q2), A2 * np.cos(q1 + q2)],
    ])


def ik_numeric(px, py, q_init=(0.3, 0.6), max_iter=500, tol=1e-8):
    """逆运动学(数值法, 阻尼最小二乘): 从初始猜测开始, 用雅可比一步步修正.

    步骤: 算当前末端与目标的误差 err -> 用 J 把 err 反推成关节修正量 dq
          -> q += dq, 直到误差小于 tol. 这是复杂机械臂(无闭式解)的通用做法.
    """
    q = np.array(q_init, dtype=float)
    target = np.array([px, py], dtype=float)
    for it in range(max_iter):
        cur = fk(q[0], q[1])
        err = target - cur
        if np.linalg.norm(err) < tol:
            return q, it, np.linalg.norm(err)
        J = jacobian(q[0], q[1])
        lam = 1e-4  # 阻尼: 防止 J J.T 接近奇异时修正量爆炸
        M = J @ J.T + lam * np.eye(2)
        dq = J.T @ np.linalg.solve(M, err)
        q = q + dq
    return q, max_iter, np.linalg.norm(err)


def ik_velocity(q, px, py, kp=10.0):
    """速度级逆解(一步): 把"末端位置误差"反解成"关节速度", 再乘比例增益 kp.

    这是最简单的比例控制器: 离目标越远, 关节速度越大; 越近越小.
    和 ik_numeric 的区别: 这里只算"这一步该往哪走多少", 由调用方逐帧积分, 用于实时追踪.
    """
    q1, q2 = q
    cur = fk(q1, q2)
    err = np.array([px - cur[0], py - cur[1]])
    J = jacobian(q1, q2)
    lam = 1e-3  # 阻尼, 防止 J J.T 接近奇异时修正量爆炸
    M = J @ J.T + lam * np.eye(2)
    return kp * (J.T @ np.linalg.solve(M, err))


def demo_chase():
    section("追着目标跑: 速度级逆解 + 比例控制")
    dt = 0.02
    w_target = 1.5   # 目标绕圆角速度(rad/s)
    kp = 8.0         # 比例增益
    max_dq = 2.5     # 关节速度上限(rad/s), 让手臂有速度上限, 追不上时就会落后
    q = np.array([0.3, 0.6])
    print("目标绕半径 0.55 的圆以 %.1f rad/s 运动, 手臂用比例控制追(kp=%.1f, 关节速度上限 %.1f rad/s)."
          % (w_target, kp, max_dq))
    print("时间   目标x   目标y   末端x   末端y   误差")
    for i in range(40):
        t = i * dt
        tx = 0.55 * math.cos(w_target * t)
        ty = 0.55 * math.sin(w_target * t)
        dq = ik_velocity(q, tx, ty, kp)
        norm = np.linalg.norm(dq)
        if norm > max_dq:
            dq = dq * (max_dq / norm)
        q = q + dq * dt
        ex, ey = fk(q[0], q[1])
        err = math.hypot(tx - ex, ty - ey)
        if i % 5 == 0:
            print("%4.1f  % .3f  % .3f  % .3f  % .3f  %.3f" % (t, tx, ty, ex, ey, err))
    print("观察: 目标跑得快时手臂跟不上, 误差不为 0(落后), 末端走的是'追赶曲线'而不是目标圆.")


def section(title):
    print("\n" + "=" * 56)
    print(title)
    print("=" * 56)


def main():
    np.set_printoptions(precision=4, suppress=True)

    section("正向运动学 FK: 关节角 -> 末端位置")
    q1, q2 = 0.6, 0.9
    print("手臂: 两关节都绕 Z 转, 杆长 a1 = a2 =", A1, "在 X-Y 平面.")
    print("关节角 q =", [q1, q2], "-> 末端位置 =", fk(q1, q2))

    section("逆运动学 IK: 目标位置 -> 关节角")
    target = np.array([0.5, 0.3])
    print("给定末端目标点 target =", target)

    q_up = ik_analytic(target[0], target[1], elbow_up=True)
    print("\n解析法(肘朝上): q =", q_up)
    print("  代回 FK 验证: fk(q) =", fk(q_up[0], q_up[1]),
          ", 误差 =", np.linalg.norm(fk(q_up[0], q_up[1]) - target))

    q_down = ik_analytic(target[0], target[1], elbow_up=False)
    print("解析法(肘朝下): q =", q_down)
    print("  代回 FK 验证: fk(q) =", fk(q_down[0], q_down[1]),
          ", 误差 =", np.linalg.norm(fk(q_down[0], q_down[1]) - target))

    q_num, iters, err = ik_numeric(target[0], target[1])
    print("\n数值法(Jacobian 迭代): q =", q_num, ", 迭代", iters, "步, 误差 =", err)
    print("  代回 FK 验证: fk(q) =", fk(q_num[0], q_num[1]))

    section("不可达检测")
    far = np.array([1.5, 0.0])
    print("目标", far, "超出臂展(最长", A1 + A2, "), 解析法返回:", ik_analytic(far[0], far[1]))

    print("\n结论: 解析法和数值法求出的关节角, 代回 FK 都回到目标点(误差接近 0).")
    print("一个目标通常有两个解析解(肘朝上/朝下), 数值解收敛到其中一个.")

    demo_chase()


if __name__ == "__main__":
    main()
