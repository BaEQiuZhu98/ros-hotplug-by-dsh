#!/usr/bin/env python3
"""
demo/07 - 机械臂正向运动学(FK)验证: 一根两关节臂 + MuJoCo.

目标: 用刚体变换手工算末端位姿, 和 MuJoCo 内置算出的位置比对,
      证明"转一下 + 移一下"这套数学和仿真引擎一致. 手臂是教学用两关节简化臂,
      demo/08 与 demo/09 继续沿用这条简化臂.

先跑 transforms.py 建立直觉, 再看本文件: 机械臂就是把"人走路"换成"两根杆".

用法:
    python3 arm.py           # 无窗口: 打印 FK vs MuJoCo 对比表
    python3 arm.py --view    # 交互窗口: 看两关节臂来回摆动(需要图形环境)
"""
import argparse
import math
import time

import mujoco
import numpy as np

from transforms import rot_y

# ---------------------------------------------------------------------------
# 1. 用 XML 定义一个两关节平面臂(在 X-Z 平面内, 绕 Y 轴转).
#    肩(shoulder)在原点, 肘(elbow)在第一根杆末端, 末端执行器 site 叫 "ee".
# ---------------------------------------------------------------------------
XML = """
<mujoco>
  <option gravity="0 0 -9.81"/>
  <worldbody>
    <light pos="0 0 3" dir="0 0 -1"/>
    <geom name="floor" type="plane" size="1 1 0.1" rgba="0.8 0.8 0.8 1"/>

    <body name="link1" pos="0 0 0">
      <joint name="shoulder" type="hinge" axis="0 1 0"/>
      <geom name="link1_geom" type="capsule" size="0.03" fromto="0 0 0 0 0 0.4" rgba="0.9 0.3 0.3 1"/>
      <body name="link2" pos="0 0 0.4">
        <joint name="elbow" type="hinge" axis="0 1 0"/>
        <geom name="link2_geom" type="capsule" size="0.03" fromto="0 0 0 0 0 0.4" rgba="0.3 0.5 0.9 1"/>
        <site name="ee" pos="0 0 0.4"/>
      </body>
    </body>
  </worldbody>
</mujoco>
"""

L1 = 0.4  # 第一根杆长
L2 = 0.4  # 第二根杆长

model = mujoco.MjModel.from_xml_string(XML)
data = mujoco.MjData(model)
EE_ID = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_SITE, "ee")


def fk(q0, q1):
    """正向运动学: 由肩角 q0 / 肘角 q1 算末端位置与姿态.

    把每根杆想象成"转一下 + 移一下":
      杆 1: 先绕肩转 q0, 再沿新朝向伸出 L1 -> 得到肘的位置.
      杆 2: 在肘上再转 q1(两关节都绕 Y, 总转角 q0+q1), 再伸出 L2 -> 得到末端.
    """
    # 杆 1: "转一下"得到朝向, "移一下"沿朝向走 L1.
    d1 = rot_y(q0) @ np.array([0.0, 0.0, 1.0])       # 转完 q0 后面朝的方向
    p_elbow = d1 * L1                                 # 沿朝向伸出 L1
    # 杆 2: 在前一个朝向基础上再转 q1, 再沿新朝向走 L2.
    d2 = rot_y(q0 + q1) @ np.array([0.0, 0.0, 1.0])  # 再转 q1 后面朝的方向
    p_ee = p_elbow + d2 * L2                          # 末端 = 肘 + 第二段
    return p_ee, rot_y(q0 + q1)                       # 位置 + 朝向(末端旋转矩阵)


def run_headless():
    poses = [
        (0.0, 0.0),
        (0.5, 0.8),
        (-0.3, 1.1),
        (1.0, -0.6),
        (-0.8, -0.4),
    ]
    print("== 两关节臂 FK 验证: 手工计算 vs MuJoCo ==")
    print("  q0     q1    FK 末端位置            MuJoCo 末端位置        位置误差")
    for q0, q1 in poses:
        data.qpos[0] = q0
        data.qpos[1] = q1
        mujoco.mj_forward(model, data)
        fk_pos, _ = fk(q0, q1)
        mj_pos = data.site_xpos[EE_ID].copy()
        err = np.max(np.abs(fk_pos - mj_pos))
        print("%5.2f %5.2f  [% .3f % .3f % .3f]  [% .3f % .3f % .3f]  %.2e"
              % (q0, q1, fk_pos[0], fk_pos[1], fk_pos[2],
                 mj_pos[0], mj_pos[1], mj_pos[2], err))

    # 再验证姿态: 末端旋转矩阵也应等于 rot_y(q0+q1).
    q0, q1 = 0.4, -0.9
    data.qpos[0] = q0
    data.qpos[1] = q1
    mujoco.mj_forward(model, data)
    _, fk_mat = fk(q0, q1)
    mj_mat = data.site_xmat[EE_ID].copy()
    print("\n姿态验证: q0=%.2f q1=%.2f, FK 旋转矩阵 vs MuJoCo 旋转矩阵, 最大误差 = %.2e"
          % (q0, q1, np.max(np.abs(fk_mat - mj_mat))))
    print("结论: 位置与姿态误差都接近 0, 说明转一下 + 移一下这套数学和 MuJoCo 内置计算一致.")


def run_viewer():
    import mujoco.viewer
    with mujoco.viewer.launch_passive(model, data) as viewer:
        t = 0.0
        while viewer.is_running():
            # 让肩和肘按不同频率摆动, 末端在 X-Z 平面画弧.
            data.qpos[0] = 0.8 * math.sin(t)
            data.qpos[1] = 0.9 * math.sin(0.7 * t)
            mujoco.mj_forward(model, data)
            viewer.sync()
            t += 0.01
            time.sleep(0.01)


def main():
    parser = argparse.ArgumentParser(description="demo/07 两关节臂 FK 验证.")
    parser.add_argument("--view", action="store_true", help="弹交互窗口实时显示(需要图形环境).")
    args = parser.parse_args()
    if args.view:
        run_viewer()
    else:
        run_headless()


if __name__ == "__main__":
    main()
