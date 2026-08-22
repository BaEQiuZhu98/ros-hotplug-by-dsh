# src/capabilities/capability-spec.md — 能力开发规范 v2

> 本规范定义「能力」的标准形态与挂载流程. 一个能力 = 一个末端执行器/传感器/技能,
> 封装成一个 DSH 工具; 热插拔本体 = 能力挂载服务(运行时挂载/卸载, 不重启).
> 读者: 能力开发者(写新末端/感知能力)与挂载方(人/平台/运维, 经 web 面板操作).

## 1. 定位与原则

- **能力 = 工具 + manifest + 版本**: host.js 注册一个 DSH 工具; manifest 供挂载前校验; 版本目录供换版/回滚.
- **一等交付件 = 能力仓库目录**: `repo/<capability>/<version>/{host.js, manifest.json}`, 零依赖.
  npm 树外包只是可选**发布外壳**(pack.sh 打包 tarball 分发, 解包进仓库后走同一挂载服务).
- **唯一写者 = 人**: 挂载/卸载/换版只经 web 面板 RPC 调挂载服务; agent 的工具表里没有挂/卸工具,
  物理上无法修改末端装配(读/写路径分离, 见 design.zh.md §7.6).
- **热插拔 = DSH 的运行时挂载机制**: 挂载服务 `ctx.plugin(...)` / `fiber.dispose()`(即动态插件
  `cordis_run` 的底层同款机制), 插入即见、拔出即回收, 全程不重启.
- **校验前置(零信任)**: 每次挂载前 mount_guard 对 host.js 重算 SHA256 与 manifest 比对.
- **不改 DSH 源码**: 只复用其公开机制.

## 2. 能力目录模板(以 grasp 为例)

```
repo/grasp/1.0.0/
├── host.js            # ESM 能力插件(零依赖): 注册能力工具
└── manifest.json      # 能力元数据 + host.js 的 sha256(挂载校验)
```

## 3. host.js 契约

- **零依赖**: 不 import 任何包(仓库目录在 node_modules 解析链之外, 且自包含利于分发),
  只用注入的服务与手写 Tool 契约.
- ESM 命名导出 `{ apply, inject, name }`(Cordis Plugin):

```js
export const name = 'capability-grasp'
export const inject = ['tools', 'shell']
export function apply(ctx, config = {}) {
  // config 来自挂载服务的仓库配置(workdir/python 等)
  const unregister = ctx.tools.register({
    name: 'grasp',
    description: '把机械臂末端执行器切换到"夹爪", 并让该臂去触碰小球.',
    parameters: { type: 'object', properties: { arm: { type: 'string', enum: ['A', 'B'] } }, required: [] },
    output: { schema: { type: 'string' }, render(_args, value) { return [{ type: 'text', text: value }] } },
    async execute(args) {
      // 只调 bridge_client.py CLI(薄 SDK), 不直接碰 rosbridge
      return 'grasp 已触发'
    },
  })
  return () => { unregister() }   // dispose 精确回收
}
```

- Tool 契约 = DSH 标准(`{name, description, parameters(JSON Schema), output{schema,render}, execute}`), 不造新协议.
- 执行链: execute → `ctx.shell` 调 `bridge_client.py <method> <args...>` → rosbridge → sim_bridge.
- 副作用全部随插件 dispose 回收(apply 返回 disposer).

## 4. manifest.json 字段与挂载校验

```json
{
  "grasp": {
    "name": "grasp",
    "version": "1.0.0",
    "description": "夹爪能力: 把指定臂末端切到夹爪并触碰小球",
    "tool": "host.js",
    "sha256": "<sha256 of host.js>"
  }
}
```

- 顶层是能力字典(一个 manifest 可登记多个能力, 与 demo/13 兼容).
- `sha256` 必须真实计算: `sha256sum host.js`.
- 挂载前校验: 挂载服务 mount 的第一步 = 调 `mount_guard.py manifest.json <cap> host.js`,
  不通过直接拒绝(DSH 自身无 sha256/manifest 校验, 本步是应用层安全边界).

## 5. 能力挂载服务(mount_service, host 常驻插件)

- **形态**: 组合挂载的真实插件(host 常驻行), **不是动态沙箱插件**——动态插件的沙箱 ctx
  刻意隐藏 `ctx.plugin`/`fiber` 等框架内部(实测报错: sandbox ctx does not expose "plugin").
- **API**(Cordis Service 或私有 RPC, 供 web 面板调用; **不注册 agent 工具**):

```text
mount(cap, version):  1) mount_guard 校验 sha256  2) 动态 import host.js
                      3) ctx.plugin(plugin, config) 挂到机器作用域(异步安装, 等待就绪)
                      4) 记录句柄 {id, cap, version, fiber}  5) 返回 {ok, id} / {ok:false, error}
unmount(id):          await fiber.dispose()(异步回收) -> 返回 {ok}
list():               仓库能力清单 + 当前已挂载清单
```

- **换版/回滚**: 换版 = unmount(旧) + mount(新); 新版本挂载失败则旧句柄保留(旧能力仍在).
- **同名隔离**: 多实例(两个夹爪)挂载时用 isolate realm 包住子树(nearest-wins/作用域遮蔽).
- **事件**: 挂/卸触发 `tools/change` 广播, agent 的观测插件订阅感知(挂载服务不负责通知, 事件是注册的天然副作用).

## 6. 版本策略: 换版与回滚(灰度不做)

- 版本 = 能力目录名(语义化版本目录 `1.0.0`/`1.1.0`).
- 换版: 人在面板选新版本 → unmount(旧) + mount(新), 工具名不变, agent 无感.
- 回滚: 新版本激活失败(挂载返回 error)→ 旧句柄保留, 旧能力照常可用; 也可显式换回旧版本.
- 灰度不做(用户决策 2026-08); 秒级回滚是挂载服务句柄模型的原生能力.

## 7. 分发流程(npm 发布外壳, 可选)

```bash
# 打包: 把 repo/<cap>/<version> 打成 npm tarball(公开分发用)
bash src/capabilities/pack.sh <cap>

# 装机: tarball 解包进目标机器的能力仓库(不是 dsh plugin add; 安装 != 挂载)
# 挂载: 全部经挂载服务(web 面板), 运行时生效
```

- 开发/本地验证直接写仓库目录, 无打包环节.
- 树外包与动态插件的分工: 仓库目录 = 持久交付载体; npm = 发布外壳; 动态插件 = 调试/一次性演示.

## 8. 与动态插件的区别(防混淆)

| | 能力仓库 + 挂载服务(本规范) | 动态插件(demo 13) |
|---|---|---|
| 形态 | 目录 + host 常驻插件 | 进程内临时, 会话级 |
| 挂载 | 面板 RPC → ctx.plugin(机器作用域, 全局可见) | cordis_define + cordis_run(会话作用域) |
| 写权限 | 只有人(面板) | 只有 agent 会话 |
| 卸载 | await fiber.dispose() | cordis_stop |
| 版本/回滚 | 版本目录 + 句柄 | package/run 指针 |
| 沙箱 | 无(真实插件环境) | 有(禁框架内部, 不能承载挂载服务) |
| 用途 | 正式交付 + 热插拔本体 | 演示/开发/快速试错 |
