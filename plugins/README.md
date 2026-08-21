# plugins — 动态 Cordis 插件归档

这里归档本会话用 `cordis_define` + `cordis_run` 创建的两个「web 插件」的源码（动态 Cordis 插件的 `code.host` / `code.client` 两个半部）。

| 插件 | 目录 | 作用 |
|---|---|---|
| ros-hotplug-by-dsh-next-demo | `ros-hotplug-by-dsh-next-demo/` | 「demo 进度」面板：展示 16 个章节状态（已完成/待提交/可开始），支持单个提交、全部提交、一键开始写下一章 |
| ros-hotplug-sync-docs | `ros-hotplug-sync-docs/` | 「同步文档」面板：收集知识点/结论/关键特性，勾选后刷新 md |

> pluginId / packageId 每次重建都由 Host 重新分配，不要写死。最近一次重建为 `nxtdem-1`/`pkg-1` 与 `syncdc-2`/`pkg-2`。

每个目录两个文件：

- `host.js` — 进程内（Node）半部，跑 git / 读文件，暴露 `harness.handle(...)` RPC。
- `client.js` — 浏览器半部，在 `conversation.input.dock` 槽位注入 UI，用 `host.call(...)` 调 host。

## 重要：动态插件 vs 树外包

- 这两个是**动态插件**（进程内临时）。它们的代码只在运行中的 DSH 进程里，**重启 `dsh web` 后不会自动恢复**；`pluginId` / `packageId` 也会随进程消失。
- 本目录只是**源码归档**，用于留存和下次重建，不是可安装的持久插件。

## 重启后如何重建（在「创造模式/cordis」会话里）

重启后打开一个 cordis 会话，让 agent 执行（把下面两个目录里的 `host.js` / `client.js` 内容分别作为 `code.host` / `code.client` 传入）：

1. `cordis_define`（新插件，idPrefix 任意，如 `nxtdem` / `syncdc`），返回 pluginId/packageId。
2. `cordis_run`（mode `run`）激活。
3. 首次有 client 半部会触发一次授权，在 UI 里批准即可。

接口都在运行时以 `cordis_inspect_list` / `cordis_inspect_query` 为准，不要硬编码。

## 真正的「重启即用」：转树外包（未做）

要让它不依赖 agent 重建、`dsh web` 重启后直接可用，需要做成**树外包（persistent）插件**：

- 一个 npm 包，`package.json` 声明 `"dsh": { "host": {...}, "client": {...} }`。
- host/client 用树外包的 API（不是这里的 `harness.handle` / `host.call` 这两个动态专用内建）。
- 用 DSH 的构建链产出浏览器 bundle，再 `dsh plugin --profile web add <pkg>` 装进 web profile，并加入 `dsh.profile.bundles`。

这一步需要构建工具链和接口迁移，尚未执行；需要时再单独做。
