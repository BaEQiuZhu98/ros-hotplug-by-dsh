[English](README.md) | 中文

# demo/05 — DSH 时空组合性(spatiotemporal compositionality)

## 学什么

这是本项目新颖性的**理论基石**, 也是 demo/13 热插拔的理论来源. 完整版见 [`../../docs/spatiotemporal-compositionality.zh.md`](../../docs/spatiotemporal-compositionality.zh.md), 这里聚焦"看得见的证据".

一句话: **DSH 里任何能力都是由"插件行"组合出来的; 这个组合同时有空间结构(分层分域摆放)和时间结构(挂载/撤销/版本). 两者由同一个锚点绑定: 注册的上下文, 同时决定这项注册的可见性和生命周期.**

### 空间轴: 谁看得见谁

```
全局层(global)
   └─ agent preset 常驻挂载(父作用域)
        └─ 每个存活 agent(子作用域)
```

两条规则:
- **注册视图向下继承**: 子作用域看得见祖先各层; 同名时**最近者胜**(nearest-wins).
- **事件放行向上扩展**: 祖先监听器能收到子孙事件; 反向永不成立.

### 时间轴: 谁在何时生灭

- **Cordis 生命周期**: `apply(注册) -> effect(副作用) -> dispose(撤销)`. 每项贡献都带撤销函数, 所以"拔掉"可逆.
- **动态插件版本时序**: plugin(实例) / package(不可变版本) / run(激活尝试), 支持 `update` 切版与回滚.

### 锚点契约

> 注册的上下文同时决定可见性与所有权, 防止一个注册在 A 作用域可见、却随 B 作用域被销毁.

## 怎么跑: 看真实证据

时空组合性不是抽象概念, 在 DSH 自己的组合文件里处处可见. 跑 demo/03 的 `explore.sh`, 或直接看 standard preset:

```bash
# 看 standard preset 的隔离域(isolate realm)
grep -n "isolate" "$(npm root -g)/@deepseek-ai/dsh/config/agent-presets/standard/agent.cordis.yml"
```

你会看到三处真实的 `isolate`(隔离域):

```yaml
# 例1: plan 模式状态按 agent 隔离
- id: planning
  name: cordis:group
  group: true
  isolate:
    planMode: true          # 每个 agent 一份独立的 plan 状态

# 例2: 压缩状态与结果裁剪器共享一个隔离域
- id: compaction
  group: true
  isolate:
    compaction: true
    toolResultPruner: true

# 例3: 工作流引擎只在本 preset 内可见
- id: delegation
  group: true
  isolate:
    workflowEngine: true
```

## 观察什么(三个关键机制, 对照真实代码理解)

### 1. 作用域遮蔽(nearest-wins)
- 一个能力名在"全局层"和"当前 agent 层"都注册时, **近者胜出**.
- 这正是 demo/02 里 skill 能"覆盖默认"的原理: 项目 skill 覆盖用户 skill, 用户 skill 覆盖内置 skill.

### 2. isolate 隔离(realm)
- `isolate: true` 表示"每个挂载会话一份私有实例", 同类服务不串台.
- 对应热插拔里"两个夹爪/吸盘实例互不串台"的需求.
- 规则很硬: **在 preset 里裸注册一个会发布服务的插件行是被禁止的**, 必须用带 isolate 的 group 包起来, 否则第二个会话挂载就冲突.

### 3. dispose 回收(生命周期)
- 每个 `apply(ctx)` 里的贡献(工具注册、事件监听、订阅)都必须能被撤销.
- 停止/更新/移除插件时, 按序 teardown, 无泄漏.
- 对应热插拔里"卸载能力 = 精确回收其连接/状态".

## 与最终目标什么关系

demo/13 的"机器人能力热插拔", 就是把这套机制落到具体场景:

| 热插拔需求 | 时空组合性机制 |
|---|---|
| 运行时插入新能力 | 在 robot 作用域注册工具(空间+时间) |
| 运行时拔出能力 | dispose 插件, 精确 teardown(时间) |
| 同型能力不串台 | isolate realm(空间) |
| 升级不重启 | package 不可变 + update 回滚(时间) |
| 增删被 agent 感知 | 事件广播 + 订阅(时间+空间) |

**一句话**: 先看懂"能力=插件行"(demo/03)、"工具=可调用能力"(demo/04)、"作用域+生命周期=时空组合性"(本 demo), 热插拔就是"运行时插一行/拔一行".
