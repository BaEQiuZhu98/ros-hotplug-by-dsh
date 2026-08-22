#!/usr/bin/env python3
"""
demo/09 - 轨迹控制: 轨迹生成(梯形速度 / 笛卡尔直线 / SLERP) + PID 闭环.

目标: 从 demo 08 的"知道末端该去哪"(IK)推进到
      1) 怎么"平稳地走过去"(轨迹生成), 2) 怎么"保证真的走准"(PID 闭环).

只依赖 numpy, 不依赖 mujoco.

用法:
    python3 trajectory.py
"""
import numpy as np


def trapezoidal(q0, q1, vmax, amax, dt):
    """关节空间梯形速度轨迹: 加速 -> 匀速 -> 减速, 从 q0 平滑走到 q1.

    返回 (t, q, qd, qdd) 四个等长数组. 速度 qd 的曲线是梯形(先升后平再降),
    所以叫"梯形速度轨迹". 加速度全程有界, 起步和停止都不会突然抖一下.
    """
    d = abs(q1 - q0)
    sign = 1.0 if q1 >= q0 else -1.0
    # 加速段时间 ta: 若距离不够长, 就达不到 vmax(变成三角形, 峰值速度 < vmax).
    if d < vmax * vmax / amax:
        ta = np.sqrt(d / amax)
    else:
        ta = vmax / amax
    vp = amax * ta                     # 峰值速度
    T = 2.0 * ta + (d - amax * ta * ta) / vp  # 总时长 = 加速 + 匀速 + 减速
    n = int(T / dt) + 1
    t = np.arange(n) * dt
    q = np.zeros(n)
    qd = np.zeros(n)
    qdd = np.zeros(n)
    for i, ti in enumerate(t):
        if ti < ta:                        # 加速段
            qdd[i] = amax
            qd[i] = amax * ti
            q[i] = 0.5 * amax * ti * ti
        elif ti < T - ta:                  # 匀速段
            qdd[i] = 0.0
            qd[i] = vp
            q[i] = 0.5 * amax * ta * ta + vp * (ti - ta)
        else:                              # 减速段
            tr = T - ti
            qdd[i] = -amax
            qd[i] = amax * tr
            q[i] = d - 0.5 * amax * tr * tr
    return t, q0 + sign * q, sign * qd, sign * qdd


def linear_interp(p0, p1, t):
    """笛卡尔直线插值: 末端位置在 p0 和 p1 之间按 t(0~1) 线性走直线."""
    p0 = np.asarray(p0, dtype=float)
    p1 = np.asarray(p1, dtype=float)
    return p0 + (p1 - p0) * t


def slerp(q0, q1, t):
    """四元数球面线性插值(SLERP): 姿态在 q0 和 q1 之间"匀速"旋转.

    q 顺序 [w, x, y, z]. 和线性插值不同, SLERP 保证中间每一步仍是单位四元数,
    角速度恒定(姿态转得均匀), 所以是姿态轨迹的标准做法.
    """
    q0 = np.asarray(q0, dtype=float)
    q1 = np.asarray(q1, dtype=float)
    dot = np.dot(q0, q1)
    if dot < 0.0:                 # 取最短旋转路径
        q1 = -q1
        dot = -dot
    dot = np.clip(dot, -1.0, 1.0)
    theta = np.arccos(dot)
    if theta < 1e-8:              # 几乎重合, 直接返回
        return q0.copy()
    s0 = np.sin((1.0 - t) * theta) / np.sin(theta)
    s1 = np.sin(t * theta) / np.sin(theta)
    return s0 * q0 + s1 * q1


def quat_angle_deg(q):
    """四元数 -> 旋转角(度). 只对绕单轴的情况直观(这里只用于展示)."""
    return np.degrees(2.0 * np.arccos(np.clip(q[0], -1.0, 1.0)))


def section(title):
    print("\n" + "=" * 56)
    print(title)
    print("=" * 56)


def simulate_pid():
    """PID 闭环仿真(一阶被控对象 + 常值扰动), 对比 P 只 vs PI.

    被控对象: q' = u + 扰动. 即位置 q 按"速度指令 u"变化, 外加一个常值扰动
    (相当于恒定负载/风, 一直把 q 往一个方向推).

    - P 只: 比例控制消不掉常值扰动, 会留下一个固定偏差(稳态误差).
    - PI : 再加积分项, 把扰动逐步抵消, 误差最终归 0.
    - D(微分)抑制振荡/超调, 在二阶对象上更明显, 这里用文字说明.
    """
    dt = 0.01
    goal = 1.0
    disturbance = 0.5

    def run(Kp, Ki, steps=400):
        q = 0.0
        integral = 0.0
        for _ in range(steps):
            err = goal - q
            integral += err * dt
            q += (Kp * err + Ki * integral + disturbance) * dt
        return q, goal - q

    print("被控对象: q' = u + 0.5(常值扰动), 目标 = 1.0.")
    q_p, e_p = run(3.0, 0.0)
    print("[P 只] Kp=3       -> 末值 %.4f, 稳态误差 %.4f (比例控制消不掉常值扰动)." % (q_p, e_p))
    q_pi, e_pi = run(4.0, 6.0)
    print("[PI]  Kp=4, Ki=6 -> 末值 %.4f, 稳态误差 %.4f (积分把扰动抵消, 误差归 0)." % (q_pi, e_pi))
    print("结论: I(积分)专门消灭固定偏差; D(微分)抑制振荡/超调(二阶对象更明显).")


def main():
    np.set_printoptions(precision=3, suppress=True)

    section("1) 关节空间梯形速度轨迹")
    t, q, qd, qdd = trapezoidal(0.0, 1.0, vmax=0.5, amax=1.0, dt=0.02)
    print("从 0 到 1.0 (vmax=0.5, amax=1.0):")
    print("  时间     位置q    速度qd   加速度qdd")
    for i in range(0, len(t), 8):
        print("  %.2f     %.3f     %.3f     %.2f" % (t[i], q[i], qd[i], qdd[i]))
    print("速度先升后平再降(梯形), 加速度只有 +1 / 0 / -1 三段, 起步不停顿.")

    section("2) 笛卡尔直线插值")
    p0 = np.array([0.0, 0.0])
    p1 = np.array([1.0, 0.5])
    print("末端从", p0, "直线走到", p1, ":")
    for s in (0.0, 0.25, 0.5, 0.75, 1.0):
        print("  t=%.2f ->" % s, linear_interp(p0, p1, s))

    section("3) 四元数 SLERP(姿态平滑插值)")
    q0 = np.array([1.0, 0.0, 0.0, 0.0])            # 恒等姿态(0 度)
    q1 = np.array([0.7071, 0.0, 0.0, 0.7071])      # 绕 Z 转 90 度
    print("姿态从 0 度匀速转到 90 度:")
    for s in (0.0, 0.25, 0.5, 0.75, 1.0):
        qm = slerp(q0, q1, s)
        print("  t=%.2f -> q=%s 角度=%5.1f 度 模长=%.4f"
              % (s, np.round(qm, 3), quat_angle_deg(qm), np.linalg.norm(qm)))
    print("角度线性增长(匀速旋转), 且每一步模长都保持 1(仍是合法四元数).")

    section("4) PID 闭环控制")
    simulate_pid()


if __name__ == "__main__":
    main()
