# demo/02 — Better AI coding with DSH

## What you learn

Reproduce the "AI-assisted engineering" playbook, on DSH:

| Technique | What it is | In this demo |
|---|---|---|
| Structure knowledge assets | write project conventions as docs the agent can read | `sample-skill/SKILL.md` |
| Solidify skills | package implicit constraints into on-demand skills | same SKILL.md |
| Progressive disclosure | don't dump all knowledge into context; load on use | the skill's `whenToUse` |
| AI code review | let the agent find low-level defects | `example/buggy.py` |

**Core concept: skill**
- A skill is an on-demand instruction bundle: a directory + a `SKILL.md`.
- `SKILL.md` has YAML frontmatter (required `name` in kebab-case, required `description`, optional `whenToUse`), then the body.
- The agent loads a skill only when it decides it should — that is **progressive disclosure**: it doesn't occupy context until needed.

## How to run

### 1. Look at the sample skill
```bash
cat sample-skill/SKILL.md
```
It encodes this repo's coding conventions (Chinese comments + English punctuation / no emoji / bilingual READMEs / stdlib-first) as an instruction.

### 2. Activate it (make DSH discover it)
The discovery root is the "project root", defined as the nearest `.git` ancestor — for us, the repo root `ros-hotplug-by-dsh`. So put the skill under the repo root's `.dsh/skills/`:

```bash
# run from the repo root
mkdir -p .dsh/skills/project-conventions
cp demo/02-ai-coding/sample-skill/SKILL.md .dsh/skills/project-conventions/SKILL.md
```

> Skill discovery roots (highest priority first, per DSH `dsh-skill-filesystem`):
> `<projectRoot>/.dsh/skills` → `<projectRoot>/.agents/skills` → custom → `~/.dsh/skills` → `~/.agents/skills`

### 3. Let DSH review code
```bash
# start DSH from the repo root (web or headless)
dsh web
```
Then in the conversation say:

> Review `demo/02-ai-coding/example/buggy.py`, point out every issue, and follow the project conventions.

## What to observe

1. **Whether the skill loads**: the agent should mention or follow the `project-conventions` rules.
2. **Which issues it finds**: `buggy.py` intentionally has 4 issues (answer key below).
3. **With vs without the skill**: move the skill away and ask again; see whether the agent still follows "Chinese comments + English punctuation" etc.

### buggy.py answer key (self-check)
| # | Location | Issue |
|---|---|---|
| 1 | `read_lines` | `open()` without `with` → file handle leak |
| 2 | `average_line_length(lines=[])` | mutable default argument accumulates across calls |
| 3 | `total / len(lines)` | division by zero on empty file |
| 4 | `except: pass` | bare except swallows every exception |

## How it relates to the final goal

- This is the **reproducible version** of "AI-assisted engineering": from now on, every demo's code uses this skill to keep the agent following conventions.
- `demo/04` explains the other kind of capability besides skills — plugins (tools). Together they are DSH's two main ways to extend capability.
