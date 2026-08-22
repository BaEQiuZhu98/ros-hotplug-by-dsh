#!/usr/bin/env python3
"""
demo/08 - 逆运动学驱动到位: 给定目标点, 反解关节角, 让 MuJoCo 里的手臂够过去.

先跑 kinematics.py 看数学, 再看本文件: 把"反解关节角"用到仿真里的手臂上.

手臂同 kinematics.py: 两关节绕 Z 轴, 杆长 0.4, 在 X-Y 平面.

用法:
    python3 ik_demo.py           # 无窗口: 目标 -> 关节角 -> MuJoCo 末端 对比表
    python3 ik_demo.py --view    # 交互窗口: 手臂实时追踪一个绕圆运动的目标点(绿色小球)
"""
import argparse
import math
import time

import mujoco
import numpy as np

from kinematics import ik_analytic, ik_velocity

# ---------------------------------------------------------------------------
# 1. 平面二连杆: 关节都绕 Z 轴, 杆沿 +X 伸, 在 X-Y 平面内运动.
# ---------------------------------------------------------------------------
XML = """
<mujoco>
  <option gravity="0 0 -9.81"/>
  <worldbody>
    <light pos="0 0 3" dir="0 0 -1"/>
    <geom name="floor" type="plane" size="1 1 0.1" rgba="0.8 0.8 0.8 1"/>

    <body name="link1" pos="0 0 0.5">
      <joint name="joint1" type="hinge" axis="0 0 1"/>
      <geom name="link1_geom" type="capsule" size="0.03" fromto="0 0 0 0.4 0 0" rgba="0.9 0.3 0.3 1"/>
      <body name="link2" pos="0.4 0 0">
        <joint name="joint2" type="hinge" axis="0 0 1"/>
        <geom name="link2_geom" type="capsule" size="0.03" fromto="0 0 0 0.4 0 0" rgba="0.3 0.5 0.9 1"/>
        <site name="ee" pos="0.4 0 0"/>
      </body>
    </body>

    <!-- 目标点: 一个 mocap 小球, 位置每帧由代码设置(mocap_pos), 用于可视化"要够到的点". -->
    <body name="target" mocap="true" pos="0.5 0 0.5">
      <geom name="target_geom" type="sphere" size="0.04" rgba="0.2 0.9 0.2 1"/>
    </body>
  </worldbody>
</mujoco>
"""

model = mujoco.MjModel.from_xml_string(XML)
data = mujoco.MjData(model)
EE_ID = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_SITE, "ee")
TARGET_BODY = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_BODY, "target")
TARGET_MOCAP = model.body_mocapid[TARGET_BODY]  # mocap 下标(本模型只有一个 mocap 体)
TARGET_Z = 0.5  # 手臂所在水平面高度


def run_headless():
    targets = [(0.5, 0.3), (0.2, 0.6), (-0.4, 0.2), (0.0, 0.4)]
    print("== IK 驱动到位验证: 目标 -> 关节角 -> MuJoCo 末端 ==")
    print("  目标位置           关节角             MuJoCo 末端        位置误差")
    for tx, ty in targets:
        q = ik_analytic(tx, ty)
        if q is None:
            print("[% .3f % .3f]  不可达(超出臂展)" % (tx, ty))
            continue
        data.qpos[0] = q[0]
        data.qpos[1] = q[1]
        mujoco.mj_forward(model, data)
        ee = data.site_xpos[EE_ID]
        err = math.hypot(ee[0] - tx, ee[1] - ty)
        print("[% .3f % .3f]  [% .3f % .3f]  [% .3f % .3f]  %.2e"
              % (tx, ty, q[0], q[1], ee[0], ee[1], err))
    print("结论: 反解出的关节角, 让 MuJoCo 里的手臂末端误差接近 0, 即驱动到位.")


def run_viewer():
    import mujoco.viewer
    dt = 0.01              # 每帧仿真时间步
    w_target = 1.5         # 目标绕圆角速度(rad/s), 比手臂更快, 造成"追不上"
    kp = 8.0               # 手臂比例增益
    max_dq = 2.5           # 手臂关节速度上限(rad/s)
    with mujoco.viewer.launch_passive(model, data) as viewer:
        t = 0.0
        while viewer.is_running():
            # 目标: 绕半径 0.55 的圆快速运动.
            tx = 0.55 * math.cos(w_target * t)
            ty = 0.55 * math.sin(w_target * t)
            data.mocap_pos[TARGET_MOCAP] = [tx, ty, TARGET_Z]

            # 手臂: 不瞬间跳到位, 而是根据"位置差异"用雅可比反解成关节速度,
            # 限幅后积分, 一步一步追过去 -> 目标跑得快时就会落后, 轨迹也随目标变化.
            q = np.array([data.qpos[0], data.qpos[1]])
            dq = ik_velocity(q, tx, ty, kp)
            norm = np.linalg.norm(dq)
            if norm > max_dq:
                dq = dq * (max_dq / norm)
            data.qpos[0] = q[0] + dq[0] * dt
            data.qpos[1] = q[1] + dq[1] * dt

            mujoco.mj_forward(model, data)
            viewer.sync()
            t += dt
            time.sleep(dt)


def main():
    parser = argparse.ArgumentParser(description="demo/08 逆运动学驱动到位.")
    parser.add_argument("--view", action="store_true", help="弹交互窗口实时显示(需要图形环境).")
    args = parser.parse_args()
    if args.view:
        run_viewer()
    else:
        run_headless()


if __name__ == "__main__":
    main()
