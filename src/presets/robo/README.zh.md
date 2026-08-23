# src/presets/robo — 机器人任务 agent preset

设计文档 §10.4 的 L2 运行载体: 一个**目录**(不是 npm 包), 装上后新建会话选「机器人任务」
即得到开箱即用的机器人任务 agent. preset 只感知与执行, **不装配末端、不感知末端实现细节**
(末端装配由挂载体系负责, §10.3).

## 内容

| 文件 | 作用 |
|---|---|
| `preset.yml` | preset 显示元数据(name/description) |
| `agent.cordis.yml` | 组合: persona + observer + 臂管理器 + arm_status/take_object + skills 挂载 |
| `src/observer.js` | 观测插件: 订阅 tools/change + 能力集汇报(零依赖) |
| `skills/robot-capability.zh.md` | 技能: 感知/决策/执行的操作手册 |
| `install.sh` | 安装到 `$DSH_HOME/.agent-presets/robo` |

## 职责边界(设计 §7.4/§7.11)

- **agent 只感知 ready、只调 take_object**: 不知道夹爪/吸盘, 不装配末端, 不做低层控制.
- **臂管理器(会话内)**: 预建 armA/armB 两个臂作用域(createScope), 执行挂载/卸载;
  挂载命令来自面板(经挂载服务), 臂层实例随会话生灭.
- **面板(唯一写者)**: 装/卸末端 + 把「去拿小球」指令发给 agent.

## 验证路径(设计 §7.12, 同一句「抓小球」)

| 场景 | 已挂载末端 | 期望行为 |
|---|---|---|
| 1 无末端 | 无 | arm_status 均 not ready -> agent 报告「当前没有末端执行器, 无法抓取」 |
| 2 夹爪 | 臂 A 挂 grasp(夹取策略) | 同一句命令 -> take_object(A) -> 夹取策略执行, 末端变红触球 |
| 3 吸盘 | 臂 A 换挂 suction(吸附策略) | 同一句命令 -> take_object(A) -> 吸附策略执行, 末端变蓝触球 |

- 全程不重启, agent 无感, 且 agent 从头到尾不知道「夹爪/吸盘」这些实现细节;
  策略切换的观测由 observer 日志与 sim_bridge 状态回传承担.
- 同名隔离: 两臂可同时挂同名末端(grasp), 各自实例按臂作用域互不串台.

## 环境约定

- 安装: `bash src/presets/robo/install.sh`(装到 `$DSH_HOME/.agent-presets/robo`).
- workdir/python 在组合行的 config 里, 换机器改 `agent.cordis.yml` 对应行.
- persona 核心: 感知末端状态(仅 ready), 自适应决策, 不做低层控制, 不感知末端实现细节(设计 §7.4).
