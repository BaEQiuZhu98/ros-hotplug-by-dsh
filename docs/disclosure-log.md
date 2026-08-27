[中文](disclosure-log.zh.md) | English

# Disclosure Log — evidence checklist

> Purpose: record the verifiable evidence chain of "first public disclosure", as the temporal anchor for the priority claim.
> Principle: **fill only what actually happened**; never fabricate or pre-fill.

---

## 1. First public commit (Git)

| Field | Value |
|---|---|
| First commit hash | `0a31b4b24d1c7cb007af04128189dbaf802b573b` |
| First commit time (committer date) | `2026-08-21T11:05:15+08:00` |
| Repository URL | `git@github.com:BaEQiuZhu98/ros-hotplug-by-dsh.git` |
| First push time | `2026-08-21T11:08:53+08:00` |
| Repository visibility | `public` |

---

## 2. Third-party timestamp (done)

| Field | Value |
|---|---|
| Timestamp service | FreeTSA (RFC 3161, https://freetsa.org) |
| Stamped file 1 | `DESIGN.zh.md` |
| File 1 SHA-256 | `79dcee268e2225219f6702b7a278aba76b262343f2365245970774f4436b2932` |
| File 1 receipt | `docs/timestamps/DESIGN.zh.md.tsr` |
| File 1 stamp time | `2026-08-21T03:19:40Z` |
| Stamped file 2 | `docs/novelty-claim.zh.md` |
| File 2 SHA-256 | `a3420acc8cb3dcb8901fc3e61b7f209400730f5e4e2dbbfc3e6f5bb8b7e7e25e` |
| File 2 receipt | `docs/timestamps/novelty-claim.zh.md.tsr` |
| File 2 stamp time | `2026-08-21T03:19:41Z` |
| Verification CA | `docs/timestamps/freetsa-cacert.pem` |
| Verification result | `openssl ts -verify` → `Verification: OK` |

> Offline verification (anyone can re-check):
> `openssl ts -verify -data DESIGN.zh.md -in docs/timestamps/DESIGN.zh.md.tsr -CAfile docs/timestamps/freetsa-cacert.pem`

> **The stamped files were later renamed/merged**: `DESIGN.zh.md` is now `design.zh.md` (merged into the design doc), and `novelty-claim.zh.md` is now `novelty.zh.md` (merged into the status-quo & highlights doc); both have been refreshed since, so their current hashes no longer match the receipts. This does not weaken the time anchor (hash receipts + first-commit hash + push time jointly support priority). To re-check, take the git historical versions at stamping time, e.g.:
> `git show <first-commit hash>:DESIGN.zh.md > /tmp/DESIGN.zh.md`,
> then run the openssl verification above against /tmp/DESIGN.zh.md; `novelty-claim.zh.md` likewise.

---

## 3. Public dissemination

| Channel | Link | Publish time |
|---|---|---|
| GitHub repo | `https://github.com/BaEQiuZhu98/ros-hotplug-by-dsh` | `2026-08-21T11:08:53+08:00` |
| Blog/community (Zhihu/Juejin/Medium…) | `[TBD]` | `[TBD]` |
| arXiv preprint | `[TBD]` | `[TBD]` |
| Demo video (Bilibili/YouTube) | `[TBD]` | `[TBD]` |
| Zenodo / OSF archive (DOI) | `[TBD]` | `[TBD]` |

---

## 4. Local evidence backup checklist

- [ ] local git history kept intact (`git log --all --format=fuller`)
- [ ] first-commit tarball exported and stored offline
- [ ] SHA-256 of key docs (DESIGN/novelty-claim/prior-art) recorded
- [ ] timestamp receipt stored in a local non-public location

---

## 5. Search trail (evidence of "not found in public sources", optional but recommended)

| Search date | Keywords | Result |
|---|---|---|
| `[TBD]` | DSH 时空组合性 机器人 热插拔 | `[TBD]` |
| `[TBD]` | DSH spatiotemporal hot-plug robot | `[TBD]` |
| `[TBD]` | DeepSeek Harness robotics hot-plug | `[TBD]` |
