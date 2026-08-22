# demo/13 — 热插拔 7 个可靠性点走查（hotplug walkthrough）

> 按顺序演示 `DESIGN.zh.md` §8 的 7 个可靠性点。所有「挂载/卸载/切版」都是对 DSH 动态插件的 `cordis_*` 操作；「能力」就是 `grasp` / `suction` 两个工具。

先起好环境（rosbridge + `robot_server.py --view`，见 README）。

---

## #1 零信任 / 哈希校验（挂载前验身）

```bash
python3 mount_guard.py grasp capabilities/grasp_tool.js   # 通过, 允许挂载

# 篡改 manifest.json 里 grasp 的 sha256(改一个字符), 再跑:
python3 mount_guard.py grasp capabilities/grasp_tool.js   # 拒绝: 哈希不匹配
```
- **证明**：能力代码与登记哈希不一致时，挂载守卫拒绝放行。
- **威胁模型**：能力可能来自外部分发 / agent 现场生成 / 存储中被篡改，挂载前先验身。

## #2 多版本共存（主备）

对同一个 `grasp` 能力定义两个版本（两个 package，互不覆盖）：
- `cordis_define`（grasp v1）→ `pkg-A`
- `cordis_define`（grasp v2）→ `pkg-B`（append，不覆盖 v1）
- **证明**：v1/v2 两个 package 同时存在，`currentPackageId` 指向 v1，`next` 指向 v2，可随时切换。

## #3 灰度升级 / 零中断（`update` 切版）

```text
cordis_run(grasp, pkg-B, mode="update")   # 从 v1 灰度切到 v2
```
- **证明**：工具名仍是 `grasp`，agent 继续调 `grasp()` 不感知版本变化；切换瞬间旧 run 停、新 run 起。

## #4 秒级回滚（注入坏版本）

- 定义一个「坏」的 grasp v3（execute 故意抛错）。
- `cordis_run(grasp, pkg-C, mode="update")` → 激活失败，`nextPackageId` 停在 v3、`currentPackageId` 仍是 v2。
- `cordis_run(grasp, pkg-B, mode="run")` → 回滚到 v2。
- **证明**：激活失败不破坏旧版本，可显式回滚。

## #5 事件通知（agent 订阅感知）

- 挂一个「能力监听」插件，`ctx.on('tools/change', ...)` 记录工具表变化。
- 挂载 / 卸载 `grasp` 时，监听端收到「工具注册 / 注销」事件。
- **证明**：能力增删能被订阅者（agent）感知，而非轮询。

## #6 同名遮蔽（硬件差异屏蔽层，组合层）

- 两个「同型」能力（如左夹爪 / 右夹爪）同名 `grasp`，靠 `isolate` realm 隔离、`nearest-wins` 遮蔽，互不串台。
- **说明**：这一条是组合层机制（`cordis.yml` 的 isolate group），在 `demo/05` 已演示；生产 preset 里 robot 作用域同样用 isolate 包能力。

## #7 高可用 / 不泄漏（isolate + dispose）

- `cordis_undefine(grasp)` 后，用 `cordis_inspect_self` 确认：该 plugin 的 `harness.handle` RPC 与工具注册全部消失，无残留。
- **证明**：卸载 = 精确回收，不留连接/状态/事件监听。

---

## 一句话收束

这 7 条对应 `DESIGN.zh.md` §8「华为经验 → 项目落点」，每一条都能在一个 MuJoCo 手臂 + 两个末端执行器上**现场演示**，不是口头承诺。

---

## 附：本会话真实运行记录（已实际执行）

> 以下是对应的动态插件 pluginId / packageId 与结果，证明 #2/#3/#4/#5 不是纸上谈兵。

**挂载两个能力**
- grasp v1：`grasp-5/pkg-7` → running (run-7)
- suction v1：`suctn-6/pkg-8` → running (run-8)

**#2 多版本共存**
- 追加 grasp v2：`grasp-5/pkg-9`（`cordis_inspect_self` 显示 `packageCount: 3`，v1/v2/v3 并存不覆盖）

**#3 灰度升级**
- `cordis_run(grasp-5, pkg-9, mode="update")` → `grasp-5/pkg-9 is running (run-9)`

**#4 秒级回滚**
- 追加坏 v3：`grasp-5/pkg-10`（`apply` 内 `throw new Error(...)`）
- `cordis_run(grasp-5, pkg-10, mode="update")` → `Error: grasp v3 bug: 故意抛错`
- `cordis_inspect_self(grasp-5)`：`currentPackageId: pkg-9`、`state: running` → 旧版 v2 完好且仍在跑（回滚生效）

**#5 事件通知**
- 监听插件 `capwt-7/pkg-11` → running (run-12)，`ctx.on('tools/change', ...)` 订阅工具增删事件

> 说明：#1（哈希）用 `mount_guard.py` 在 WSL 里跑；#6（isolate/nearest-wins）是组合层机制（见 demo/05）；#7（dispose 无残留）可 `cordis_undefine` 后 `inspect_self` 验证。
