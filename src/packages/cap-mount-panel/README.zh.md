# cap-mount-panel(面板树外包)

末端能力面板的持久化形态: 双面 npm 包(host 半部 + web client 半部), 由 setup.sh 复制进
profile node_modules 并写入 profile 的 cordis.patch.yml 行, dsh web 重启后常驻, 不再依赖
动态插件(每次重启后由 agent 重新激活).

- host 半部 = `src/index.js`(零构建): 注册同源 JSON 路由 `/cap-mount/*`
  (cap_list / arm_mount / arm_unmount / reset_all), 语义与
  `src/capabilities/mount_service/panel.host.js` 一致.
- client 半部 = `src/client/index.js`, 由 tsdown 打成 `lib/client.js`
  (官方 client bundle 契约: `window.__ModuleLoader__.load` + 惰性 CJS 工厂),
  注册在 `conversation.input.dock` slot, 语义与 `panel.client.js` 一致,
  通道由包私有 harness 改为同源 fetch.

## 重建 client bundle

改 `src/client/index.js` 后在本目录执行:

```bash
npm install          # 首次: 装 devDependencies(tsdown)
npm run bundle       # 生成 lib/client.js
```

`lib/client.js` 是构建产物, 随包一起被 setup.sh 复制, 因此**提交仓库**;
改完源码必须重跑 bundle 再提交, 否则线上仍旧版.

## 安装

`bash src/setup.sh [DSH_HOME] [profile] [venv-python]` 会一并安装本包并写入
patch 行(id: cap-mount-panel, inject: capabilityMount), 然后重启 dsh web 即可.
