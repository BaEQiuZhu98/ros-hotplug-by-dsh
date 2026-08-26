# src/capabilities/mount_service — 能力挂载服务(热插拔本体)

设计文档 §10.3: host 常驻插件, 负责**准入检查**与**臂/槽上下文管理**; 实例的运行时挂载/卸载
由会话内臂管理器注册的上下文承载(§7.8). 唯一写入口 = web 面板(树外包包
`src/packages/cap-mount-panel`, 经 webServer /cap-mount 路由); 不注册任何 agent 工具.

## 文件

| 文件 | 作用 |
|---|---|
| `host.js` | 挂载服务插件: 准入 + 挂/卸 + 上下文管理 + 常驻 bridge daemon; 提供 `capabilityMount` 服务 |

## 服务契约

```text
registerArms({A: ctx, B: ctx})   臂管理器注册该会话的臂上下文(每会话一套, 多会话追加);
                                  返回注销函数(fn.pending = 向新上下文补挂当前能力的完成 Promise)
registerSlot(slot, ctx)          臂管理器注册感知槽上下文(每会话一套); 同上带补挂与注销
mount(cap, version, {arm})       准入检查(sha256 + kind 路由: 臂只收 end-effector) -> 动态 import
                                 能力插件 -> 在全部已注册的该臂上下文上 ctx.plugin -> {ok, arm, cap, version}
mount(cap, version, {slot})      感知槽路径(只收 sensor 类), 同构准入与挂载
unmount(arm) / unmountSlot(slot) 该臂/槽全部上下文上的实例 fiber.dispose(只回收本点)
scopedWaterfall(armCtx, name, args, next)  作用域化事件织入助手(实现由臂管理器注入)
list()                           {repo: [{cap, version, kind}...], mounted, slots, arms}
bridge(method, args)             常驻 bridge_client daemon 转发(能力实例与面板共用)
```

- **臂间独立**: 不同臂可挂同名能力(A/B 各挂 grasp), 同名 manipulate 实例按臂作用域隔离, 互不串台.
- **同臂防重**: 同一条臂重复挂同一 cap@version -> 拒绝; 同臂挂别的末端 -> 先卸载再挂(替换).
- **失败回滚**: 准入失败不动现有挂载; 新实例激活失败则恢复旧实例(旧末端照常可用).
- **会话自适应**: 新/恢复会话的上下文注册后, 挂载服务把当前已挂能力补挂到新上下文;
  会话注销时对称摘除其实例.
- 挂/卸触发 `tools/change` 广播, observer 订阅感知.
- **全局臂清单**: 机械臂数量的唯一权威 = 挂载服务行的 `config.arms`(默认 A/B).
  面板渲染、臂管理器建作用域、挂/卸校验都从 `list().arms` 动态跟随; 增加机械臂只改
  这一处配置(物理仿真模型与消息契约需另行扩展).

## 面板职责(与 agent 分工)

- 面板: 装/卸末端与感知(挂载 + set_tool 物理装配) + 拿小球行(把消息发给 agent) + 全部复位/
  单臂复位(卸载 + 末端复位 + 关节回原位) + 设定小球位置; 面板不判断「该不该拿」、不执行抓取.
- agent: arm_status 感知 -> take_object 执行(策略在末端实例内部).
- 面板的持久化形态 = 树外包包 `src/packages/cap-mount-panel`(host 半部 /cap-mount 路由 +
  client 半部 tsdown bundle), 由 `src/setup.sh` 安装进 profile, 重启 dsh web 常驻.

## 安装(host 常驻)

把本行加入组合(web profile 的 patch 层), 配置指向能力仓库与机械臂清单:

```yaml
- insert:
  - id: capability-mount-service
    name: /abs/path/to/src/capabilities/mount_service/host.js
    config:
      repo: /abs/path/to/src/capabilities/repo
      workdir: /root/my-project/ros-hotplug-by-dsh
      python: /root/venvs/robo/bin/python3
      arms: [A, B]
```

## 为什么是组合挂载的真实插件而不是动态插件

动态插件的沙箱 ctx 隐藏 `ctx.plugin`/`fiber` 等框架内部(报错: sandbox ctx does not expose
"plugin"), 而挂载/卸载需要这两条运行时原语; 本插件经组合挂载, 运行在完整 Cordis 环境.
