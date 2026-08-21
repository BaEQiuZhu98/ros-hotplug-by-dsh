# Disclosure Log — 披露与留证清单

> 目的：记录「率先公开」的可验证证据链，作为优先权主张的时间锚。
> 原则：**所有字段只填真实发生过的事**，不伪造、不预填。

---

## 1. 首次公开提交（Git）

| 字段 | 值 |
|---|---|
| 首次提交 commit hash | `0a31b4b24d1c7cb007af04128189dbaf802b573b` |
| 首次提交时间（committer date） | `2026-08-21T11:05:15+08:00` |
| 仓库地址 | `git@github.com:BaEQiuZhu98/ros-hotplug-by-dsh.git` |
| 首次推送时间 | `2026-08-21T11:08:53+08:00` |
| 仓库可见性 | `public` |

---

## 2. 第三方时间戳（已完成）

| 字段 | 值 |
|---|---|
| 时间戳服务 | FreeTSA（RFC 3161，https://freetsa.org） |
| 盖戳文件 1 | `DESIGN.zh.md` |
| 文件 1 SHA-256 | `79dcee268e2225219f6702b7a278aba76b262343f2365245970774f4436b2932` |
| 文件 1 回执 | `docs/timestamps/DESIGN.zh.md.tsr` |
| 文件 1 盖戳时间 | `2026-08-21T03:19:40Z` |
| 盖戳文件 2 | `docs/novelty-claim.zh.md` |
| 文件 2 SHA-256 | `a3420acc8cb3dcb8901fc3e61b7f209400730f5e4e2dbbfc3e6f5bb8b7e7e25e` |
| 文件 2 回执 | `docs/timestamps/novelty-claim.zh.md.tsr` |
| 文件 2 盖戳时间 | `2026-08-21T03:19:41Z` |
| 验证 CA | `docs/timestamps/freetsa-cacert.pem` |
| 验证结果 | `openssl ts -verify` → `Verification: OK` |

> 离线验证命令（任何人可复核）：
> `openssl ts -verify -data DESIGN.zh.md -in docs/timestamps/DESIGN.zh.md.tsr -CAfile docs/timestamps/freetsa-cacert.pem`

---

## 3. 公开传播

| 渠道 | 链接 | 发布时间 |
|---|---|---|
| GitHub 仓库 | `https://github.com/BaEQiuZhu98/ros-hotplug-by-dsh` | `2026-08-21T11:08:53+08:00` |
| 博客/社区（知乎/掘金/Medium…） | `[TBD]` | `[TBD]` |
| arXiv 预印本 | `[TBD]` | `[TBD]` |
| 演示视频（B站/YouTube） | `[TBD]` | `[TBD]` |
| Zenodo / OSF 存档（DOI） | `[TBD]` | `[TBD]` |

---

## 4. 本地证据备份清单

- [ ] 本地 git 历史完整保留（`git log --all --format=fuller`）
- [ ] 首次提交的 tarball 已导出并离线保存
- [ ] 关键文档（DESIGN/novelty-claim/prior-art）的 SHA-256 已记录
- [ ] 时间戳回执已保存到本地非公开位置

---

## 5. 检索留痕（证明「未见公开资料」，可选但建议）

| 检索日期 | 关键词 | 结果 |
|---|---|---|
| `[TBD]` | DSH 时空组合性 机器人 热插拔 | `[TBD]` |
| `[TBD]` | DSH spatiotemporal hot-plug robot | `[TBD]` |
| `[TBD]` | DeepSeek Harness robotics hot-plug | `[TBD]` |
