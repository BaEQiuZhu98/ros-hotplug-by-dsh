# src/presets/robo — 机器人任务 agent preset(阶段 2, 架构 v2)

设计文档 §10.4 的 L2 运行载体: 一个**目录**(不是 npm 包), 装上后新建会话选「机器人任务」
即得到开箱即用的机器人任务 agent. **preset 只负责感知与策略, 不装配末端**(能力由挂载服务负责, §10.3).

## 内容

| 文件 | 作用 |
|---|---|
| `preset.yml` | preset 显示元数据(name/description) |
| `agent.cordis.yml` | 组合: persona + observer + skills 挂载(**无能力行**) |
| `src/observer.js` | 观测插件: 订阅 tools/change + 注册 capability_status 工具(零依赖) |
| `skills/robot-capability.zh.md` | 技能: 感知/自适应/验证步骤 |
| `install.sh` | 安装到 `$DSH_HOME/.agent-presets/robo` |

## 安装

```bash
bash src/presets/robo/install.sh            # 默认装到 $DSH_HOME/.agent-presets/robo
# 新会话选「机器人任务」preset 即可(web UI); headless 验证另见下.
```

## 三次自适应验证(设计 §7.3, 同一句「抓小球」)

末端由**挂载服务**切换(web 面板, 见 `../capabilities/capability-spec.md`), 全程不重启:

| 场景 | 已挂载能力 | 期望 agent 行为 |
|---|---|---|
| 1 无末端 | 无 | 感知 mounted=[] 后报告「当前没有末端执行器, 无法抓取」 |
| 2 夹爪 | grasp | 感知 mounted=[grasp] → 夹取策略 → 调 grasp(A) |
| 3 吸盘 | suction(换掉 grasp) | 同一句命令 → mounted=[suction] → 吸附策略 → 调 suction(A) |

- agent 全程无感, 同一句命令自动换策略; 换版/回滚同路径(挂载服务句柄).
- 感知语义: 判断「有没有末端能力」以 **mounted(工具表)为准**; `physical.tools`(sim_bridge 回传)
  是执行切换后的结果, 挂载初期可能还是 none, 调用能力工具后才变.

## 旧实现的历史记录(已按架构 v2 重构)

- 曾把能力行写进本 preset + `mount.sh` 改 disabled 标记切换场景: 存在「profile bundles 全局行兜底,
  preset disabled 失效」问题, 且挂载粒度 = 重启会话(冷). 现删除能力行与 mount.sh,
  末端装配统一由挂载服务负责(机器事实唯一, 热挂载).
- headless runner 不挂 preset(agents.create 无 preset 参数): headless 验证用 `--patch` overlay
  挂 robo 的行集合(persona 文本 + observer + ask-user + skills); preset 的正式装载以 web 会话为准.
- 部署 persona 是全局单槽(host 组合 `system-prompt` 行的 `config.persona`); preset 的 dsh-persona
  行在 agent 作用域注册同名 section 遮蔽部署 persona(机制一致).

## 同名遮蔽(nearest-wins)

- 运行时证据(2026-08-22 实测): 同一作用域重复注册同名工具被拒绝
  (`tool "X" is already registered (for a per-agent variant, register through that agent's agent.ctx instead)`);
  结合 tools 契约「Scoped registrations shadow globals」, 同名不串台 = 同层拒绝 + 跨层遮蔽两层保证.
- 能力只注册工具、不发布服务, 按组合规则无需 isolate realm; isolate realm 用于挂载服务
  多实例隔离(两个夹爪)与 preset 自持服务的隔离(editing-cordis-compositions 技能规则).

## 环境约定

- persona 核心: 感知末端状态, 自适应选策略, 不做低层控制(设计 §7.2).
- workdir/python 在 observer 行 config 里, 换机器改 `agent.cordis.yml` 的 robo-observer 行.
