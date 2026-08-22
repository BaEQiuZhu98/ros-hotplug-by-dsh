# src/capabilities/capability-spec.md — 能力包开发规范 v1

> 本规范定义「能力包」(树外包)的标准形态. 一个能力包 = 一个 npm 包, 是可持久分发、
> 带版本与安全语义的热插拔载体; 热插拔机制本身由 DSH 提供(见 `docs/design.zh.md` §7.5).
> 读者: 能力开发者(写新末端/感知能力)与挂载方(人/平台/运维).

## 1. 定位与原则

- **能力 = 工具 + manifest + 版本**: 包注册一个 DSH 工具, 带 manifest 供挂载前校验, 版本号 = npm version.
- **校验前置**: 每次挂载前用 `mount_guard.py` 对代码文件重算 SHA256 与 manifest 比对(零信任).
- **不改 DSH**: 包只声明 `dsh` 字段与 patch 行, 不修改任何 DSH 源码.
- **灰度不做(用户决策 2026-08)**: 不做灰度切流; 保留版本升级与回滚(回滚 = 重装旧版本 + 重启进程, 见 §6).
- **SDK 保持薄(用户决策 2026-08)**: 能力代码只调 `src/bridge/bridge_client.py` 的 CLI, 不直接碰 rosbridge.

## 2. 包目录模板(以 grasp 为例)

```
grasp/
├── package.json          # npm 元数据 + dsh.bundle.patch 声明
├── cordis.patch.yml      # 组合补丁: 一行 entry, 把本包挂进组合树
├── src/
│   └── host.js           # ESM host 入口: 注册能力工具
├── manifest.json         # 能力元数据 + 代码 sha256(挂载校验)
└── README.zh.md          # 怎么打包/安装/验证/升级回滚
```

## 3. package.json 必需字段

```json
{
  "name": "@ros-hotplug/dsh-plugin-grasp",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": { "default": "./src/host.js" },
    "./cordis.patch.yml": "./cordis.patch.yml",
    "./package.json": "./package.json"
  },
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
}
```

- `dsh.bundle.patch`: 声明本包是一个 bundle 层(指向 cordis.patch.yml), 这是 `dsh plugin add` 之后
  包名被自动写进 profile `dsh.profile.bundles` 的依据(DSH 的 reconcilePlugins 机制).
- 无 `dependencies`: host.js 里裸导入 `@deepseek-ai/dsh-tools`, 由 DSH 的
  `$DSH_HOME/profiles/node_modules` 符号链接回退解析(DSH 内置机制, 不要声明依赖去触发 registry 下载).

## 4. cordis.patch.yml 行格式

```yaml
- insert:
  - id: capability-grasp        # 组合树内稳定 id
    name: '@ros-hotplug/dsh-plugin-grasp'   # 模块 specifier(包名 -> exports["."])
    config:                     # 传给插件 apply 的配置
      workdir: /path/to/repo    # bridge_client.py 所在仓库根
      python: /root/venvs/robo/bin/python3
```

- 行字段: `id`(稳定 id) / `name`(模块 specifier) / `config`(插件配置) / `disabled` / `inject`(可选).
- 卸载 = 从 patch 行删除或 `disabled: true` 后重启; 挂载 = 加行 + 重启(或首次安装).
- 同名隔离(两个 grasp 实例)与更细的作用域挂载属阶段 2 的 isolate realm 设计, 行格式不变.

## 5. host.js 契约

- ESM 命名导出 `{ apply, inject, name }`(Cordis Plugin), 官方形态:
  ```js
  import { defineTool } from '@deepseek-ai/dsh-tools'
  export const name = 'capability-grasp'
  export const inject = ['tools', 'shell']
  export function apply(ctx, config) {
    ctx.tools.register(defineTool({
      name: 'grasp',
      description: '...',
      parameters: { ... },        // JSON Schema
      output: { schema: { type: 'string' }, render(_args, value) { return [{ type: 'text', text: value }] } },
      async execute(args) { ... } // 只调 bridge_client.py CLI(薄 SDK), 不 import 任何 ROS 包
    }))
  }
  ```
- Tool 契约 = DSH 标准 Tool(`{name, description, parameters, output{schema,render}, execute}`), 用 DSH 现成接口, 不造新协议.
- execute 内: `ctx.shell.resolve({command, workdir, timeoutMs})` + `ctx.shell.run(spec)`,
  命令形态 `python bridge_client.py <method> <args...>`, 解析 JSON 输出, 返回人类可读文本.
- 所有副作用(工具注册等)必须随插件 dispose 回收: `ctx.tools.register(...)` 返回 disposer, 用 `ctx.on('dispose', ...)` 或返回给 Cordis 管理.

## 6. manifest.json 字段与挂载校验

```json
{
  "grasp": {
    "name": "grasp",
    "version": "1.0.0",
    "description": "夹爪能力: 把指定臂末端切到夹爪并触碰小球",
    "tool": "src/host.js",
    "sha256": "<sha256 of src/host.js>"
  }
}
```

- 键 = 能力名, 顶层是能力字典(与 demo/13 兼容, 一个 manifest 可登记多个能力).
- `sha256` 必须真实计算: `sha256sum src/host.js`.
- 挂载前校验(零信任, 对应 design §8 可靠性点 1):
  `python3 src/capabilities/mount_guard.py <包>/manifest.json grasp <包>/src/host.js`
  退出码 0 = 放行, 1 = 拒绝. 校验通过后才允许 `dsh plugin add`.
- 注意: DSH 本身无 sha256/manifest 校验(只有 sha1 缓存 rev), 本步是应用层安全边界.

## 7. 版本策略: 升级与回滚(灰度不做)

- 版本 = package.json 的 `version`(npm 语义).
- **升级**: 发布新版本(本地 tarball) → `dsh plugin --profile <name> add <新 tarball>` → 重启进程.
- **回滚**: `dsh plugin --profile <name> add <旧 tarball>`(pnpm 语义) → 重启进程. DSH 树外包模型
  无进程内版本指针, 回滚粒度 = 进程重启(分钟级).
- **秒级回滚/灰度属另一套机制**: 进程内动态插件(plugin/package/run 时序, `currentPackageId` 指针,
  `run`/`update` 切换)才是秒级回滚; 树外包是"持久分发"载体, 两者分工不同(见 HANDOFF §8).
- 同一能力多版本共存: npm 单一解析, 一个 profile 内同名包只有一个版本; 需要共存时用动态插件模型.

## 8. 本地发布流程(公开 npm 前自验证)

```bash
# 打包(在能力包目录): 产出 <name>-<version>.tgz
bash ../../pack.sh .        # 或 npm pack

# 安装到目标 profile(本地 tarball, 不碰 registry)
dsh plugin --profile <name> add /path/to/<name>-<version>.tgz

# 查看组合树是否挂上本包
dsh --profile <name> --dump-config
```

验证线: `dsh plugin add` → 组合树出现能力行 → 进程重启后工具表出现能力工具 → 调用工具经 SDK 驱动 sim_bridge.

## 9. client 半部(预留, 暂不要求)

- 需要浏览器面板的能力才加 `dsh.client`(platform/inject/immediately)与 `exports["./client"]`.
- 构建工具: `tsdown`(与 DSH 生态一致), client 半部必须产出
  `window.__ModuleLoader__.load({id, factory})` 形态的经典脚本(factory = 惰性 CJS 闭包).
- tsdown 具体配置未随 npm 发布, 动工前回源仓库 github.com/deepseek-ai/deepseek-harness
  读 `packages/client/*` 的 tsdown 配置照抄(见 `.dsh/research/tree-package-build-chain.zh.md` §8).
- 本仓库阶段 1 的能力包只有 host 半部(零构建); 阶段 2 的观测面板按本节补 client 半部.

## 10. 与动态插件的区别(防混淆)

| | 树外包(本规范) | 动态插件(demo 13) |
|---|---|---|
| 形态 | npm 包, 持久分发 | 进程内临时, 会话级 |
| 安装 | `dsh plugin add` + 重启 | `cordis_define` + `cordis_run` |
| 版本 | npm version | package/run 不可变版本 + 指针 |
| 回滚 | 重装旧版本 + 重启(分钟级) | `run`(current) 秒级回滚 |
| 用途 | 正式交付载体 | 演示/开发/快速试错 |
