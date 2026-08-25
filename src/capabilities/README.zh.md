# src/capabilities — 能力与热插拔本体

设计文档 §10.3: 每个末端能力 = 一个**仓库目录**(host.js + manifest), 挂载后成为臂作用域上的
带策略实例; 热插拔 = 实例在臂作用域上的注册与撤销(运行时, 不重启). 唯一写者 = 人(web 面板);
agent 只经 arm_status/take_object 感知与执行, 不感知末端实现细节.

## 目录

| 文件/目录 | 作用 |
|---|---|
| `capability-spec.md` | 能力开发规范(模板 + manifest + 挂载体系契约 + 版本策略) |
| 挂载守卫(mount_guard) | 挂载前哈希校验(零信任; 实现在 `mount_service/host.js` 的 `loadPlugin()` 内联 sha256 比对, 挂载服务准入第一步) |
| `mount_service/` | 能力挂载服务(host 常驻: 准入检查 + 臂管理; web 面板为树外包包 `src/packages/cap-mount-panel`) |
| `repo/` | 能力仓库目录(一等交付件): `repo/<cap>/<version>/{host.js, manifest.json}`, host.js 零依赖 |
| `pack.sh` | 可选发布外壳: 仓库目录打包成 npm tarball(公开分发用) |

## 关键语义

- **能力 = 带策略实例**: grasp = 夹取策略, suction = 吸附策略; 实例同名注册 manipulate,
  靠臂作用域隔离(两臂可挂同名末端, 互不串台).
- **准入与作用域分工**: 配置表只做「放行/拒绝」(sha256 + 规则表), 作用域回答「挂在哪/何时生灭/谁看得见」.
- **同臂防重**: 同一条臂重复挂同一 cap@version 被拒; 挂别的末端自动替换.
- **agent 屏蔽细节**: agent 只有 arm_status(感知 ready)与 take_object(执行); 夹取/吸附策略在实例内部.
