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
- **准入检查(配置表, 不是作用域)**: 每次挂载前挂载守卫(mount_guard, 实现在
  `mount_service/host.js` 的 `loadPlugin()`)对 host.js 重算 SHA256 与 manifest 比对,
  再经挂载服务的 kind 路由(臂只收 end-effector、感知槽只收 sensor / 同点防重 / 替换规则).

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
  // config 由挂载服务注入(workdir/python/arm 等)
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

### 3.1 能力间协作: waterfall 执行链

- **作用域化发射必须经挂载服务助手**: 能力实例是零依赖(禁 import 任何包), 而跨作用域的事件织入需要 dsh-scope 的载体——一律调用 `ctx.capabilityMount.scopedWaterfall(armCtx, 'manipulate_execute', [req], 终端函数)`, 不得直接 `ctx.waterfall`(非作用域发射会跨会话拦截泄漏).
- **req 契约**:
  ```js
  { arm: 'A' | 'B', target: [x, y] | null }   // target 为空 = 盲抓预设位置(执行原语自定)
  ```
- **拦截器约定**(写给增强器开发者, 如 sensor 类能力):
  - 只用**闭包 ctx**(回调的 this 是 dispatch 载体, 不是监听器自身或调用点, 不得依赖);
  - 只许「原地修改 req 字段 + 调用 next()」; 不改字段也应 next();
  - 不 next() 且返回非 undefined = **带原因否决**(该值上抛为执行结果);
  - **fail-open 是视觉类拦截器的默认策略**: 感知数据不可用时放行(目标为空 → 执行原语的盲分支)+ 日志告警, 不否决、不抛错;
  - 多拦截器顺序 = 注册序(可 `{prepend: true}` 插队);
  - 单一职责: 数据注入方只注入数据不改编排, 编排(优先目标位置否则预设点)永远在执行原语内部.
- **命中判定在执行原语内**: move_to(收敛完成式)返回 `{ok, ee, ball}`(workspace 系), 距离阈值 0.05m; 「sim 算、能力只判」, 输出文案供测试断言.

## 4. manifest.json 字段与准入校验

```json
{
  "grasp": {
    "name": "grasp",
    "version": "1.0.0",
    "kind": "end-effector",
    "description": "夹爪末端: 夹取策略",
    "tool": "host.js",
    "sha256": "<sha256 of host.js>"
  }
}
```

- `sha256` 必须真实计算: `sha256sum host.js`.
- `kind` ∈ {`end-effector`, `sensor`, `skill`}, **缺省视为 `end-effector`**. 挂载服务按 kind 路由挂载点: end-effector → 臂作用域; sensor → 感知槽(agent 层).
- 挂载前校验: 挂载服务 mount 的第一步 = sha256 与 manifest 比对, 不通过直接拒绝; 准入顺序 = sha256 → kind 校验(槽位类型匹配, 不匹配拒绝并说明) → 规则表 → 落位.

## 5. 挂载体系(准入 + 臂作用域)

- **能力挂载服务(mount_service)**: host 常驻插件(组合挂载, 非动态沙箱——动态沙箱 ctx 隐藏
  `ctx.plugin`/`fiber` 等框架内部). 职责:
  - 准入检查: sha256 + kind 路由(臂只收 end-effector、感知槽只收 sensor / 同点防重 / 替换);
  - 上下文管理: 按臂/槽记录当前挂载 {cap, version}; 动态 import 能力插件后在对应上下文上落位;
    新注册的会话上下文自动补挂当前能力, 会话注销时对称摘除;
  - 不注册任何 agent 工具.
- **臂管理器(robo preset 内, 会话级)**: 为每个会话建立 armA/armB 两条臂作用域与感知槽
  (`createScope(agentCtx, armKey, { parent: 会话 agent 作用域 })`)并 registerArms 注册到挂载服务;
  错过事件/恢复的会话在首次执行 arm_status/take_object 时懒补建; 挂载 = 挂载服务在目标
  臂上下文上 `ctx.plugin`(注册 manipulate 实例), 卸载 = 该臂上下文 `fiber.dispose()`(只回收本臂实例).

```text
mount(cap, version, {arm})  准入检查 -> 动态 import -> 在全部已注册的该臂上下文 ctx.plugin
                             -> 同臂防重: 臂 X 已挂同 cap@version 拒绝; 已挂别的先卸载(替换)
mount(cap, version, {slot})  感知槽路径(只收 sensor 类), 同构准入与挂载
unmount(arm)                 该臂各上下文 dispose(该能力实例注销; 不影响另一臂)
list()                       {repo, mounted: [{arm, cap, version}], slots, arms}
```

- **臂间独立**: 不同臂可挂同名能力(A/B 各挂 grasp), 同名 manipulate 实例按作用域隔离, 互不串台.
- **失败回滚**: 换挂先摘旧再挂新(存在短暂窗口), 新实例激活失败自动恢复旧实例(尽力, 恢复失败显式告警).
- **事件**: 挂/卸触发 `tools/change` 广播, observer 订阅感知.

## 6. 版本策略: 换版与回滚

- 版本 = 能力目录名(语义化版本目录 `1.0.0`/`1.1.0`).
- 换版: 面板选新版本 → 该臂卸载旧实例 + 挂载新实例, agent 的 arm_status/take_object 语义不变.
- 回滚: 换挂失败(挂载返回 error, restored 字段标明恢复结果)→ 自动恢复旧实例(尽力); 也可显式换回旧版本.

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
