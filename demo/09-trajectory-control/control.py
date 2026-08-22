#!/usr/bin/env python3
"""
demo/09 - 控制回路: MuJoCo 单摆 + PID 力矩控制, 跟踪一条梯形角度轨迹.

先跑 trajectory.py 看数学, 再看本文件: 把 PID 用到仿真里的摆上.
摆受重力, 是天然的扰动, 所以 PID 必须持续出力才能把摆稳住、跟上轨迹.

用法:
    python3 control.py           # 无窗口: 目标角度 vs 实际角度 对比表(跟踪误差)
    python3 control.py --view    # 交互窗口: 看摆跟踪一条来回摆动的轨迹
"""
import argparse
import math
import time

import mujoco
import numpy as np

from trajectory import trapezoidal

XML = """
<mujoco>
  <option gravity="0 0 -9.81" timestep="0.002"/>
  <worldbody>
    <light pos="0 0 3" dir="0 0 -1"/>
    <geom name="floor" type="plane" size="1 1 0.1" rgba="0.8 0.8 0.8 1"/>
    <body name="pole" pos="0 0 0.5">
      <joint name="hinge" type="hinge" axis="0 1 0"/>
      <geom name="pole_geom" type="capsule" size="0.02" fromto="0 0 0 0 0 -0.3" rgba="0.9 0.3 0.3 1"/>
    </body>
  </worldbody>
  <actuator>
    <motor name="drive" joint="hinge" ctrlrange="-50 50"/>
  </actuator>
</mujoco>
"""

model = mujoco.MjModel.from_xml_string(XML)
data = mujoco.MjData(model)
DT = model.opt.timestep  # 0.002 秒


def run_headless():
    # 目标角度轨迹: 0 -> 1.0 rad(梯形速度), 之后保持 1.0 一段时间.
    t1, q1, qd1, _ = trapezoidal(0.0, 1.0, vmax=0.5, amax=1.0, dt=DT)
    hold_steps = int(1.0 / DT)
    total_steps = len(t1) + hold_steps

    Kp, Ki, Kd = 8.0, 3.0, 0.5
    integral = 0.0
    print("PID 跟踪梯形轨迹 0 -> 1.0 rad 后保持 (Kp=%.1f Ki=%.1f Kd=%.1f):"
          % (Kp, Ki, Kd))
    print("时间     目标q     实际q     误差")
    err_max = 0.0
    for i in range(total_steps):
        q_target = q1[i] if i < len(t1) else 1.0
        qd_target = qd1[i] if i < len(t1) else 0.0
        err = q_target - data.qpos[0]
        err_d = qd_target - data.qvel[0]
        integral += err * DT
        # PID: 比例(现在) + 积分(消稳态误差) + 微分(抑制振荡)
        data.ctrl[0] = Kp * err + Ki * integral + Kd * err_d
        mujoco.mj_step(model, data)
        err_max = max(err_max, abs(err))
        if i % 50 == 0:
            print("%6.2f   % .3f    % .3f    % .3f"
                  % (i * DT, q_target, data.qpos[0], err))
    print("最大跟踪误差: %.3f rad" % err_max)
    print("结论: 摆的实际角度紧贴目标轨迹, 误差很小(重力被 PID 持续出力抵消).")


def run_viewer():
    import mujoco.viewer
    Kp, Ki, Kd = 8.0, 3.0, 0.5
    integral = 0.0
    with mujoco.viewer.launch_passive(model, data) as viewer:
        t = 0.0
        while viewer.is_running():
            # 目标角度来回摆动(正弦), 摆用 PID 追它.
            q_target = 0.9 * math.sin(0.8 * t)
            qd_target = 0.9 * 0.8 * math.cos(0.8 * t)
            err = q_target - data.qpos[0]
            err_d = qd_target - data.qvel[0]
            integral += err * DT
            data.ctrl[0] = Kp * err + Ki * integral + Kd * err_d
            mujoco.mj_step(model, data)
            viewer.sync()
            t += DT
            time.sleep(DT)


def main():
    parser = argparse.ArgumentParser(description="demo/09 单摆 PID 轨迹跟踪.")
    parser.add_argument("--view", action="store_true", help="弹交互窗口实时显示(需要图形环境).")
    args = parser.parse_args()
    if args.view:
        run_viewer()
    else:
        run_headless()


if __name__ == "__main__":
    main()
