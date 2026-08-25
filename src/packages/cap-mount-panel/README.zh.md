# cap-mount-panel(面板树外包)

末端能力面板的持久化形态: 双面 npm 包(host 半部 + web client 半部), 由 setup.sh 复制进
profile node_modules 并写入 profile 的 cordis.patch.yml 行, dsh web 重启后常驻.

- host 半部 = `src/index.js`(零构建): 注册同源 JSON 路由 `/cap-mount/*`
  (cap_list / arm_mount / arm_unmount / reset_all), 臂名合法性由挂载服务
  `config.arms` 统一校验, 本半部只转发.
- client 半部 = `src/client/index.js`, 由 tsdown 打成 `lib/client.js`
  (官方 client bundle 契约: `window.__ModuleLoader__.load` + 惰性 CJS 工厂),
  注册在 `conversation.input.dock` slot; 通道为同源 fetch.
  臂行按挂载服务的全局臂清单(`cap_list` 的 `arms` 字段)动态渲染.

## 重建 client bundle

改 `src/client/index.js` 后在本目录执行:

```bash
pnpm install         # 首次: 装 devDependencies(tsdown)
pnpm run bundle      # 生成 lib/client.js
```

`lib/client.js` 是构建产物, 随包一起被 setup.sh 复制, 因此**提交仓库**;
改完源码必须重跑 bundle 再提交, 否则线上仍旧版.

## 安装

`bash src/setup.sh [DSH_HOME] [profile] [venv-python]` 会一并安装本包并写入
patch 行(id: cap-mount-panel, inject: capabilityMount), 然后重启 dsh web 即可.
