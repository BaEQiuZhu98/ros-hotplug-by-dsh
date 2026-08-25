# src/capabilities/capability-spec.md — 能力开发规范

> 本规范定义「末端能力」的标准形态与挂载流程. 一个能力 = 末端硬件 + 驱动策略的完整单元,
> 挂载后成为机械臂作用域上的一个**带策略实例**; 热插拔 = 实例在臂作用域上的注册与撤销.
> 读者: 能力开发者(写新末端能力)与挂载方(经 web 面板操作).

## 1. 定位与原则

- **能力 = 带策略的末端实例**: grasp = 夹取策略, suction = 吸附策略; 实例实现策略,
  agent 只看到「这条臂能否拿东西」(arm_status)与「去拿」(take_object), 看不到夹爪/吸盘细节.
- **一等交付件 = 能力仓库目录**: `repo/<capability>/<version>/{host.js, manifest.json}`, host.js 零依赖.
  npm 树外包是可选**发布外壳**(pack.sh 打包 tarball 分发, 解包进仓库后走同一挂载流程).
- **唯一写者 = 人**: 挂载/卸载只经 web 面板 RPC → 能力挂载服务; agent 的工具表里没有挂/卸工具.
- **热插拔 = DSH 的运行时挂载机制**: 挂载服务在臂管理器注册的**臂上下文(作用域)**上执行 `ctx.plugin(...)` / `fiber.dispose()`,
  插入即见、拔出即回收, 全程不重启.
- **准入检查(配置表, 不是作用域)**: 每次挂载前 mount_guard 对 host.js 重算 SHA256 与 manifest 比对,
  再经挂载服务的规则表(该臂允许的末端类型 / 同臂防重 / 替换规则).

## 2. 能力目录模板(以 grasp 为例)

```
repo/grasp/1.0.0/
├── host.js            # ESM 能力插件(零依赖): 注册同名 manipulate 实例 + 策略实现
└── manifest.json      # 能力元数据 + host.js 的 sha256(准入校验)
```

## 3. host.js 契约

- **零依赖**: 不 import 任何包, 只用注入的服务与手写 Tool 契约; 同构能力之间允许模板化重复(零依赖约束下每个能力目录自包含, 这是有意取舍).
- ESM 命名导出 `{ apply, inject, name }`(Cordis Plugin):

```js
export const name = 'capability-grasp'
export const inject = ['tools', 'capabilityMount']
export function apply(ctx, config = {}) {
  // config 由臂管理器注入(workdir/python 等)
  const unregister = ctx.tools.register({
    name: 'manipulate',   // 每臂一个同名实例, 靠臂作用域隔离(§7.2)
    description: '该臂当前末端的操控实例(内部策略).',
    parameters: { type: 'object', properties: {}, required: [] },
    output: { schema: { type: 'string' }, render(_args, value) { return [{ type: 'text', text: value }] } },
    async execute() {
      // 策略: 1) 感知物理末端匹配(不匹配报错, 绝不改变装配) 2) 执行策略步 3) 状态校验
      return '策略执行结果'
    },
  })
  return () => { unregister() }
}
```

- Tool 契约 = DSH 标准(`{name, description, parameters(JSON Schema), output{schema,render}, execute}`), 不造新协议.
- 执行链: execute → `ctx.capabilityMount.bridge(method, args)`(挂载服务常驻的 SDK daemon 通道)
  → rosbridge → sim_bridge. 能力依赖挂载服务的 bridge 通道(分发给无挂载服务的主机不可独立运行,
  这是挂载体系的约定依赖).
- 副作用全部随插件 dispose 回收(apply 返回 disposer).

## 4. manifest.json 字段与准入校验

```json
{
  "grasp": {
    "name": "grasp",
    "version": "1.0.0",
    "description": "夹爪末端: 夹取策略",
    "tool": "host.js",
    "sha256": "<sha256 of host.js>"
  }
}
```

- `sha256` 必须真实计算: `sha256sum host.js`.
- 挂载前校验: 挂载服务 mount 的第一步 = sha256 与 manifest 比对, 不通过直接拒绝.

## 5. 挂载体系(准入 + 臂作用域)

- **能力挂载服务(mount_service)**: host 常驻插件(组合挂载, 非动态沙箱——动态沙箱 ctx 隐藏
  `ctx.plugin`/`fiber` 等框架内部). 职责:
  - 准入检查: sha256 + 规则表(该臂允许的末端类型 / 同臂防重 / 替换);
  - 臂管理: 按臂记录 {arm, cap, version}; 动态 import 能力插件后在臂上下文上落位;
  - 不注册任何 agent 工具.
- **臂管理器(robo preset 内, 会话级)**: 会话创建时在 agent 上下文下预建 armA/armB 两个空作用域
  (`createScope(agentCtx, 'armA'/'armB')`)并 registerArms 注册到挂载服务; 挂载 = 挂载服务在目标
  臂上下文上 `ctx.plugin`(注册 manipulate 实例), 卸载 = 该臂上下文 `fiber.dispose()`(只回收本臂实例).

```text
mount(cap, version, {arm})  准入检查 -> 动态 import -> 挂载服务在 armX 上下文 ctx.plugin
                            -> 同臂防重: 臂 X 已挂同 cap@version 拒绝; 已挂别的先卸载(替换)
unmount(arm)                臂作用域 dispose(该能力实例注销; 不影响另一臂)
list()                      {repo, mounted: [{arm, cap, version}]}
```

- **臂间独立**: 不同臂可挂同名能力(A/B 各挂 grasp), 同名 manipulate 实例按作用域隔离, 互不串台.
- **失败回滚**: 换挂先摘旧再挂新(存在短暂窗口), 新实例激活失败自动恢复旧实例(尽力, 恢复失败显式告警).
- **事件**: 挂/卸触发 `tools/change` 广播, observer 订阅感知.

## 6. 版本策略: 换版与回滚

- 版本 = 能力目录名(语义化版本目录 `1.0.0`/`1.1.0`).
- 换版: 面板选新版本 → 该臂卸载旧实例 + 挂载新实例, agent 的 arm_status/take_object 语义不变.
- 回滚: 换挂失败(挂载返回 error, restored 字段标明恢复结果)→ 自动恢复旧实例(尽力); 也可显式换回旧版本.
- 灰度切流不演示; 秒级回滚是句柄模型的原生能力.

## 7. 分发流程(npm 发布外壳, 可选)

```bash
bash src/capabilities/pack.sh <cap> <version>   # repo 目录打包成 npm tarball(公开分发用)
```

- 开发/本地验证直接写仓库目录, 无打包环节.
- 装机 = tarball 解包进目标机器的能力仓库; 安装不等于挂载, 挂载全部经挂载体系(web 面板).

## 8. 与动态插件的区别

| | 能力仓库 + 挂载体系(本规范) | 动态插件 |
|---|---|---|
| 形态 | 目录 + host 常驻插件 + 会话内臂管理器 | 进程内临时, 会话级 |
| 挂载 | 面板 RPC → 准入 → 臂作用域 ctx.plugin | cordis_define + cordis_run |
| 写权限 | 只有人(面板) | 只有 agent 会话 |
| 卸载 | 臂作用域 fiber.dispose | cordis_stop |
| 版本/回滚 | 版本目录 + 句柄 | package/run 指针 |
| 沙箱 | 无(真实插件环境) | 有(禁框架内部, 不能承载挂载服务) |
| 用途 | 正式交付 + 热插拔本体 | 调试/一次性演示 |
