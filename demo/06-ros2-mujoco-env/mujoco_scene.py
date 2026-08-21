#!/usr/bin/env python3
"""
demo/06 - 最小 MuJoCo 场景: 一个受重力来回摆动的单摆.

目标: 验证 MuJoCo 工具链可用, 并第一次接触"模型(model) + 数据(data) + 步进(step)"
      这一套仿真核心概念. 场景用内联 XML 描述, 不需要外部模型文件.

运行前先安装 MuJoCo:
    pip install mujoco

用法:
    python3 mujoco_scene.py              # 无窗口: 打印摆杆角度表格(适合 headless)
    python3 mujoco_scene.py --view       # 弹交互窗口, 实时看摆杆摆动(需要图形环境, 如 WSLg)
    python3 mujoco_scene.py --steps 400  # 自定义无窗口模式下的步进步数
"""
import argparse
import time

import mujoco

# ---------------------------------------------------------------------------
# 1. 用 XML 字符串定义最小场景: 一根绕 Y 轴转动的摆杆.
#    MuJoCo 的场景用 MJCF(XML) 描述. 这里直接内联写死, 省去外部模型文件.
# ---------------------------------------------------------------------------
XML = """
<mujoco>
  <!-- 重力: 默认就是 (0, 0, -9.81). 显式写出是为了看清单位. -->
  <option gravity="0 0 -9.81"/>

  <worldbody>
    <!-- 一盏灯: 渲染时需要, 纯物理步进其实用不到. -->
    <light pos="0 0 3" dir="0 0 -1"/>

    <!-- 地面: 一个很大的平面, 只做视觉参照. -->
    <geom name="floor" type="plane" size="1 1 0.1" rgba="0.8 0.8 0.8 1"/>

    <!-- 摆杆: 位置在原点上方 0.5, 挂一个绕 Y 轴的单自由度铰链关节. -->
    <body name="pole" pos="0 0 0.5">
      <!-- hinge = 铰链关节(单自由度旋转); axis 指定旋转轴(绕 Y 轴). -->
      <joint name="hinge" type="hinge" axis="0 1 0"/>
      <!-- 摆杆的几何: 一根细长胶囊, 从铰链处竖直向下延伸 0.3. -->
      <geom name="pole_geom" type="capsule" size="0.02" fromto="0 0 0 0 0 -0.3" rgba="0.9 0.3 0.3 1"/>
    </body>
  </worldbody>
</mujoco>
"""

# ---------------------------------------------------------------------------
# 2. 把 XML 编译成"模型"(model), 再基于模型创建一份"数据"(data).
#    - model: 静态描述(几何/关节/质量等), 只编译一次, 只读.
#    - data : 运行时状态(位置/速度/受力等), 每次步进都会更新.
#    这个"静态/动态分离"是 MuJoCo 最核心的心智模型.
# ---------------------------------------------------------------------------
model = mujoco.MjModel.from_xml_string(XML)
data = mujoco.MjData(model)

# 初始角度: 让摆杆从 1.0 rad(约 57 度)开始, 偏离平衡位置才会在重力下摆动.
# qpos 是"广义坐标". 本例只有一个铰链关节, 所以 qpos 只有一个数.
data.qpos[0] = 1.0


def run_headless(steps):
    """无窗口模式: 步进 steps 步, 每 20 步打印一次摆杆角度."""
    print("开始步进 %d 步, 每 20 步打印一次摆杆角度:" % steps)
    print("步数      qpos[0] (rad)")

    # -----------------------------------------------------------------------
    # 3. 步进: mj_step 推进一个时间步(默认 dt = 0.002 秒), 并刷新 data 里的状态.
    #    循环里只做"推进 + 读状态", 这就是后面所有机器人仿真的最小骨架.
    # -----------------------------------------------------------------------
    for step in range(steps):
        mujoco.mj_step(model, data)
        if step % 20 == 0:
            # data.qpos[0] 是摆杆当前角度(弧度). 你会看到它在正负之间来回摆动.
            print("%4d      %.4f" % (step, data.qpos[0]))

    print("完成. 若角度随时间来回摆动, 说明 MuJoCo 物理引擎工作正常.")


def run_viewer():
    """交互窗口模式: 实时渲染摆杆摆动, 关窗口即退出."""
    # mujoco.viewer 需要图形环境(WSLg 或 X server). 懒加载, 无窗口模式不依赖它.
    import mujoco.viewer

    with mujoco.viewer.launch_passive(model, data) as viewer:
        while viewer.is_running():
            # 记录这一帧开始的时间, 用来把动画速度对齐到真实物理时间.
            step_start = time.time()
            mujoco.mj_step(model, data)
            viewer.sync()
            # 真实时间步进: 若这一帧算得比 dt 快, 就睡到下一帧该开始的时刻.
            wait = model.opt.timestep - (time.time() - step_start)
            if wait > 0:
                time.sleep(wait)


def main():
    parser = argparse.ArgumentParser(description="demo/06 最小 MuJoCo 场景: 受重力摆动的单摆.")
    parser.add_argument("--view", action="store_true", help="弹交互窗口实时显示(需要图形环境).")
    parser.add_argument("--steps", type=int, default=2000, help="无窗口模式下的步进步数(默认 2000).")
    args = parser.parse_args()

    if args.view:
        run_viewer()
    else:
        run_headless(args.steps)


if __name__ == "__main__":
    main()
