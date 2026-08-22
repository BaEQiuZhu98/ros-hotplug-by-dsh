# src/capabilities — 能力包(树外包)目录

热插拔的**载体**都在这里(设计文档 §10.3): 每个末端/感知能力一个 npm 包, DSH 负责热插拔机制.

## 当前状态(阶段 1 已完成)

| 文件 | 作用 |
|---|---|
| `capability-spec.md` | 能力包开发规范 v1(模板 + manifest 字段 + 发布/升级/回滚流程) |
| `mount_guard.py` | 挂载前哈希校验(零信任, 从 demo/13 固化) |
| `pack.sh` | 本地发布: npm pack 成 tarball(输出 /tmp/cap-packs/) |
| `grasp/` | 第一个能力包 v1.1.0(package.json + cordis.patch.yml + src/host.js + manifest 真实 sha256 + README) |

## 阶段 1 验证记录(2026-08-22, 全部真实跑通)

- 本地发布: `pack.sh` 产出 `ros-hotplug-dsh-plugin-grasp-1.0.0.tgz` / `-1.1.0.tgz`.
- 安装: `dsh plugin --profile web|headless add <tarball>` → 包名自动进入 profile 的 `dsh.profile.bundles`, 组合树出现 `capability-grasp` 行.
- 装载: 独立 DSH_HOME 下 boot 日志出现 `[capability-grasp] grasp 工具已注册`.
- 驱动: headless agent 调用 `grasp` → 经 bridge SDK → rosbridge → sim_bridge(日志: 臂 A 末端执行器 = grasp, 关节角到位).
- 升级/回滚: 装 1.1.0 → 工具输出带 [v2]; 重装 1.0.0 → 输出回到 v1(树外包回滚 = 重装旧版本 + 重启进程).

## 用户决策(2026-08-22, 已确认)

- 能力包先在本地发布自验证(公开 npm 后置).
- SDK 保持薄(校验内置, 能力代码只调 bridge_client.py CLI).
- 灰度不做; 回滚保留验证(树外包粒度 = 进程重启; 秒级回滚属动态插件模型, 见 HANDOFF §8).
- 评测主打公开基线达成; native_swap 推迟(记 HANDOFF 待办).

## 后续(阶段 2+)

- `suction/`、`detect/`: 按 capability-spec.md 模板复制扩展.
- client 面板: 需要时按 capability-spec.md §9(tsdown + 回源仓库照抄配置).
- 真机/公开发布: 换 package name 与发布流程, 包结构不变.
