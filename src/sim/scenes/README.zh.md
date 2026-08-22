# src/sim — 可视化仿真资源

资源分两类: `models/` 放 MJCF 模型(几何与关节定义), `scenes/` 放预置场景(模型 + 初始状态的组合说明).

## models/

| 文件 | 内容 |
|---|---|
| `two_arm_scene.xml` | 双臂 + 小球默认场景, sim_bridge 的默认模型(demo/13 双臂服务器固化而来) |

## scenes/

当前只启用一个默认场景: `models/two_arm_scene.xml`, 初始状态写死在模型文件里(两臂伸直、小球在 (0.5, 0)).

后续按需扩展:

- 单臂场景(阶段 1 能力包单臂验证用);
- 夹爪/吸盘视觉变体(演示同名遮蔽时区分实例);
- 真机迁移时换成 `ros2_control` / `mujoco_ros2_control` 的场景, 本目录接口不变.

## 约定

- 模型文件是**唯一来源**: sim_bridge 默认从 `src/sim/models/` 加载, 改模型不改代码.
- 场景不写死在任何 Python 代码里; 需要新场景时加模型文件 + 在本 README 登记.
