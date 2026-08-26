# eval/agent/task-set.md - T-E-01 任务集与成功判定口径(定义性用例产物)

> T-E-01 的产物 = eval/agent 的任务集与口径文档.
> 本文件只定义口径, 不含任何数值(数值实测后写入, 禁止预填).

## 1. 任务集

- 指令: 固定一句话, 「抓小球」/「用臂 X 去拿小球」变体归入同一任务.
- 末端状态三类, 每类 N 次(N 实测时定):
  1. 无末端(两臂都无实例);
  2. 夹爪(臂 A 挂 grasp@1.0.0);
  3. 吸盘(臂 A 挂 suction@1.0.0).
- 场景约束: 单臂执行(臂 B 始终保持无末端, 作为干扰选项).

## 2. 成功判定口径

- agent 输出与 `arm_status`/`take_object` 结果一致:
  - ready=false 时, agent 输出必须含「无法抓取/没有末端/不可用」类表述, 且**不得**调用 take_object;
  - ready=true 时, agent 调用 take_object, 且结果文本与末端策略匹配(夹取/吸附);
- 统计口径: 成功率 = 成功轮次 / 总轮次; 步数 = 每轮 agent 工具调用次数.

## 3. 基准定义

- oracle: 脚本直接按 `arm_status` 结果决策(ready=true 即调 take_object), 记为最优路径;
- random: 随机选择「调用/不调用、A/B」, 期望成功率 0.5 以下;
- 对比维度: agent 成功率 > random, 且与 oracle 的差距记录显著性说明.
