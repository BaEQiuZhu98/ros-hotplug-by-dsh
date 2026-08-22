# src/capabilities — 能力与热插拔本体

能力仓库 + 挂载服务都在这里(设计文档 §10.3): 每个末端/感知能力 = 一个**仓库目录**(host.js + manifest),
热插拔本体 = **能力挂载服务**(运行时挂载/卸载, 不重启); agent 只感知, 不装配.

## 目录

| 文件/目录 | 作用 |
|---|---|
| `capability-spec.md` | 能力开发规范 v2(模板 + manifest 字段 + 挂载服务契约 + 换版/回滚) |
| `mount_guard.py` | 挂载前哈希校验(零信任, 从 demo/13 固化; 挂载服务 mount 的第一步) |
| `mount_service/` | 能力挂载服务(host 常驻插件: 校验 + `ctx.plugin` 运行时挂载 + `fiber.dispose` 卸载; 唯一写入口 = web 面板 RPC, 不注册 agent 工具) |
| `repo/` | 能力仓库目录(一等交付件): `repo/<cap>/<version>/{host.js, manifest.json}`, host.js 零依赖 |
| `pack.sh` | 可选发布外壳: 仓库目录打包成 npm tarball(公开分发用; 解包进仓库后走同一挂载服务) |

## 历史记录(旧实现, 已按新架构重构)

- 阶段 1 曾以 npm 树外包 + `dsh plugin add` 验证「安装 = 挂载」路径: 包进 `dsh.profile.bundles`、
  组合树挂行、升级/回滚 = 重装 tarball + 重启进程. 该路径**分发语义正确、挂载语义缺失**(冷插拔),
  已被挂载服务(热插拔)取代; 树外包降级为发布外壳.
- 阶段 2 曾把能力行放进 robo preset(会话作用域), 存在「全局 bundles 行兜底导致 preset disabled 失效」
  的问题; 现 preset 不含能力行, 末端装配统一由挂载服务负责(机器事实唯一).

## 用户决策(2026-08-22, 已确认)

- 交付形式按需选择: 仓库目录(开发/验证) / npm 发布外壳(公开分发) / 动态插件(调试).
- 唯一写者 = 人(web 面板); agent 只能感知(工具表 + capability_status + tools/change), 物理上无挂/卸工具.
- 挂载服务必须是组合挂载的真实插件: 动态沙箱 ctx 隐藏 `ctx.plugin` 等框架内部(已实测).
- SDK 保持薄(校验内置, 能力代码只调 bridge_client.py CLI).
- 灰度不做; 回滚保留(挂载句柄模型).
- 评测主打公开基线达成; native_swap 推迟(记 HANDOFF 待办).
