# src/capabilities/mount_service — 能力挂载服务(热插拔本体)

设计文档 §10.3: host 常驻插件, 负责**准入检查**与**臂管理**; 实例的运行时挂载/卸载由会话内
臂管理器在臂作用域执行(§7.8). 唯一写入口 = web 面板; 不注册任何 agent 工具.

## 文件

| 文件 | 作用 |
|---|---|
| `host.js` | 挂载服务插件: mount(准入 + 臂管理) / unmount / list; 提供 `capabilityMount` 服务 |
| `panel.host.js` | 面板 host 半部(动态插件 code.host): 装/卸末端 RPC + 物理装配 |
| `panel.client.js` | 面板 client 半部(动态插件 code.client): 按臂两行 UI(装/卸 + 去拿小球 + 全部复位) |

## 服务契约

```text
registerArms({A: ctx, B: ctx})  臂管理器(会话内)注册臂上下文(作用域); 多会话各自追加
mount(cap, version, {arm})      准入检查(sha256 + 规则表, 先于任何卸载) -> 动态 import 能力插件
                                -> 在 arm 对应臂上下文上 ctx.plugin -> {ok, arm, cap, version}
unmount(arm)                    该臂全部上下文上的实例 fiber.dispose(只回收本臂)
list()                          {repo: [{cap, version}...], mounted: [{arm, cap, version}...]}
```

- **臂间独立**: 不同臂可挂同名能力(A/B 各挂 grasp), 同名 manipulate 实例按臂作用域隔离, 互不串台.
- **同臂防重**: 同一条臂重复挂同一 cap@version -> 拒绝; 同臂挂别的末端 -> 先卸载再挂(替换).
- **失败回滚**: 准入失败不动现有挂载; 新实例激活失败则恢复旧实例(旧末端照常可用).
- 挂/卸触发 `tools/change` 广播, observer 订阅感知.

## 面板职责(与 agent 分工)

- 面板: 装/卸末端(挂载 + set_tool 物理装配) + 「去拿小球」把消息发给 agent + 全部复位;
  面板不判断「该不该拿」、不执行抓取.
- agent: arm_status 感知 -> take_object 执行(策略在末端实例内部).
- 面板 client 半部当前是动态插件形态(进程内临时), 重启 dsh web 后需按 `panel.host.js` /
  `panel.client.js` 重新激活; 持久化(重启自动恢复)需将 client 半部做成组合挂载的 tsdown bundle.

## 安装(host 常驻)

把本行加入组合(web profile 的 patch 层), 配置指向能力仓库:

```yaml
- insert:
  - id: capability-mount-service
    name: /abs/path/to/src/capabilities/mount_service/host.js
    config:
      repo: /abs/path/to/src/capabilities/repo
      workdir: /root/my-project/ros-hotplug-by-dsh
      python: /root/venvs/robo/bin/python3
```

## 为什么是组合挂载的真实插件而不是动态插件

动态插件的沙箱 ctx 隐藏 `ctx.plugin`/`fiber` 等框架内部(报错: sandbox ctx does not expose
"plugin"), 而挂载/卸载需要这两条运行时原语; 本插件经组合挂载, 运行在完整 Cordis 环境,
与官方动态插件 cordis_run 同款机制.
