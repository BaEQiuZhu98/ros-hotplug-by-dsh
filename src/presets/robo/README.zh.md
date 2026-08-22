# src/presets/robo — 机器人任务 agent preset(阶段 2)

设计文档 §10.4 的 L2 运行载体: 一个**目录**(不是 npm 包), 装上后新建会话选「机器人任务」
即得到开箱即用的机器人任务 agent.

## 内容

| 文件 | 作用 |
|---|---|
| `preset.yml` | preset 显示元数据(name/description) |
| `agent.cordis.yml` | 组合: persona + observer + 能力包行(grasp/suction) + skills 挂载 |
| `src/observer.js` | 观测插件: 订阅 tools/change + 注册 capability_status 工具(零依赖) |
| `skills/robot-capability.zh.md` | 技能: 感知/自适应/验证步骤 |
| `install.sh` | 安装到 `$DSH_HOME/.agent-presets/robo` 并替换能力包路径占位 |
| `mount.sh` | 运维侧场景切换: `bash mount.sh <none|grasp|suction|both> [DSH_HOME] [profile]` 改写已安装 preset 里能力行的 disabled 标记(挂载/卸载), 重启会话生效(已实测 YAML 合法) |

## 安装与验证

```bash
# 0. 前置: 能力包已装进目标 profile(阶段 1 流程)
dsh plugin --profile headless add /tmp/cap-packs/ros-hotplug-dsh-plugin-grasp-1.0.0.tgz
dsh plugin --profile headless add /tmp/cap-packs/ros-hotplug-dsh-plugin-suction-1.0.0.tgz

# 1. 安装 preset(默认 DSH_HOME + headless profile)
bash src/presets/robo/install.sh

# 2. 会话选「机器人任务」preset; headless 验证则在 settings.yaml 设
#    agent-presets: { default: robo } 后:
dsh --profile headless "抓小球"
```

## 三次自适应验证(设计 §7.3, 同一句「抓小球」)

| 场景 | profile 里的能力包 | 实测结果(2026-08-22, 独立 DSH_HOME + headless --patch 验证) |
|---|---|---|
| 1 无末端 | 都没有 | agent 感知 mounted=[] 后报告「当前没有末端执行器, 无法抓取」, 不假装成功 |
| 2 夹爪 | grasp | agent 感知 mounted=[grasp] → 夹取策略 → 调 grasp(A) → sim_bridge: 臂 A 末端 = grasp, 触球到位 |
| 3 吸盘 | suction(换掉 grasp) | 同一句命令 → mounted=[suction] → 吸附策略 → 调 suction(A) → sim_bridge: 臂 A 末端 = suction |

每次换场景 = `dsh plugin add/remove` + 重新跑(新进程); agent 全程无感, 同一句命令自动换策略.
场景 3 中物理状态残留上一轮的 grasp, agent 仍以 mounted 为准选了吸附 - 感知语义正确.

### 验证方式说明(重要)

- **headless runner 不挂 preset**(agents.create 无 preset 参数), 所以用 `--patch <overlay>` 把
  robo 的行集合(persona 文本 + observer + ask-user + skills)作为 overlay 验证行内容.
  生成 overlay 的脚本见 README 附录; preset 的最终装载请用 web 会话选「机器人任务」确认.
- **部署 persona 是全局单槽**: 由 host 组合 `system-prompt` 行的 `config.persona` 持有;
  headless 验证时用 override 替换该文本; 真正生效路径是 preset 的 dsh-persona 行在
  agent 作用域注册同名 section 遮蔽部署 persona(机制一致).
- 实操坑: `dsh plugin remove` 会按"已安装状态"重算 `dsh.profile.bundles`, 可能把仍在
  dependencies 里的其他能力包从 bundles 摘掉; 换场景后要重新 `add` 目标包并确认 bundles.

## 同名遮蔽(2.4, nearest-wins)

- 全局(profile bundles)装 grasp 1.1.0(输出带 [v2]), preset 行挂 grasp 1.0.0(无 [v2]):
  robo 会话调 grasp 输出无 [v2](preset 作用域遮蔽全局), 非 robo 会话输出带 [v2].
- 说明: 能力包只注册工具、不发布服务, 按组合规则无需 isolate realm; 同名不串台的
  机制是**作用域注册遮蔽全局**(tools 服务的 scoped shadowing), isolate realm 用于
  preset 自持服务的隔离(editing-cordis-compositions 技能规则).
- 运行时证据(2026-08-22 实测): 同一作用域重复注册同名工具被拒绝, 报错
  `tool "X" is already registered (for a per-agent variant, register through that agent's agent.ctx instead)`;
  结合 tools 契约「Scoped registrations shadow globals」, 同名不串台 = 同层拒绝 + 跨层遮蔽两层保证.
  完整双会话演示(两个会话各自挂同名能力互不干扰)需 web UI, 步骤: 开两个「机器人任务」
  会话, 会话 1 的 profile 装 grasp、会话 2 装 suction(或各自 preset 行挂不同版本), 分别问「抓小球」.

## 环境约定

- 能力包路径: install.sh 把占位符换成 `$DSH_HOME/profiles/<profile>/node_modules`(pnpm hoisted).
- workdir/python 在组合的 config 里, 换机器改 install.sh 后的两处 config.
- persona 核心: 感知末端状态, 自适应选策略, 不做低层控制(设计 §7.2).
