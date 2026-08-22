# demo/02 — 用 DSH 更好地 AI Coding

## 学什么

复现「AI 辅助研发效能体系」的四件套, 用 DSH 落地:

| 技巧 | 是什么 | 本 demo 对应 |
|---|---|---|
| 知识资产结构化 | 把项目规范写成文档, 让 agent 可理解 | `sample-skill/SKILL.md` |
| 技能固化(Skill) | 把隐含约束封装成按需加载的 skill | 同一个 SKILL.md |
| 渐进式披露 | 不把全部知识塞进上下文, 而是"用到才加载" | skill 的 `whenToUse` 机制 |
| AI 代码审查 | 让 agent 找低级缺陷 | `example/buggy.py` |

**核心概念: skill**
- skill 是一个「按需加载的指令包」, 一个目录 + 一个 `SKILL.md`.
- `SKILL.md` 顶部是 YAML frontmatter(必填 `name` 用 kebab-case, 必填 `description`, 可选 `whenToUse`), 下面是正文.
- 只有 agent 觉得「该用这个 skill 了」才会加载它, 这就是**渐进式披露**: 平时不占上下文, 用时才注入.

## 怎么跑

### 1. 看样例 skill
```bash
cat sample-skill/SKILL.md
```
它把本仓库的编码规范(中文注释 + 英文标点 / 不用 emoji / 中英双语 README / 优先标准库)固化成了一段指令.

### 2. 激活它(让 DSH 能发现)
skill 的发现根是「项目根」. 项目根 = 最近的 `.git` 祖先目录, 也就是本仓库根 `ros-hotplug-by-dsh`. 所以要把 skill 放进项目根的 `.dsh/skills/`:

```bash
# 在仓库根目录执行
mkdir -p .dsh/skills/project-conventions
cp demo/02-ai-coding/sample-skill/SKILL.md .dsh/skills/project-conventions/SKILL.md
```
Project-code-writing-specification
> skill 发现根(优先级从高到低, 见 DSH `dsh-skill-filesystem` 文档):
> `<projectRoot>/.dsh/skills` → `<projectRoot>/.agents/skills` → 自定义 → `~/.dsh/skills` → `~/.agents/skills`

### 3. 让 DSH 审查代码
```bash
# 在仓库根目录启动 DSH(web 或 headless)
dsh web
```
然后在对话里说:

> 请审查 `demo/02-ai-coding/example/buggy.py`, 指出所有问题, 并遵守项目规范.

## 观察什么

1. **skill 是否被加载**: agent 应主动提到或遵循 `project-conventions` 里的规范.
2. **审查出哪些问题**: `buggy.py` 故意埋了 4 个问题(答案见下).
3. **对比有/无 skill**: 试着把 skill 移走再问一遍, 看 agent 是否还遵循「中文注释 + 英文标点」等规范.

### buggy.py 的答案(自查用)
| # | 位置 | 问题 |
|---|---|---|
| 1 | `read_lines` | `open()` 没用 `with`, 文件句柄泄漏 |
| 2 | `average_line_length(lines=[])` | 可变默认参数, 多次调用会累积 |
| 3 | `total / len(lines)` | 空文件时除零 |
| 4 | `except: pass` | 裸 except 吞掉所有异常 |

## 与最终目标什么关系

- 这就是「AI 辅助研发」经验的**可复现版本**: 以后所有 demo 的代码, 都用这个 skill 约束 agent 遵守规范.
- `demo/04` 会把「skill」之外的另一种能力「plugin(工具)」讲清楚; 两者加在一起, 就是 DSH 扩展能力的两种主要方式.
