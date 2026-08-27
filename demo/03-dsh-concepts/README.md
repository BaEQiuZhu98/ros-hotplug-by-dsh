[中文](README.zh.md) | English

# demo/03 — DSH core concepts: everything is a plugin

## What you learn

Build the DSH mental model. One sentence: **in DSH, any capability (tool, skill, persona, prompt section) is not hard-coded; it is composed from "plugin rows".**

### Concept map

```
capability = plugin row
      |
      |  one row = id + package name + config
      |
      v
composition file (cordis.yml)
      |
      +-- host composition:  process-level, one copy. registries / permissions / sandbox / model route / storage
      |
      +-- agent preset composition:  per-session. tools / persona / skills / compaction
      |
      v
profile = several bundles stacked in order + user patch
      |
      v
a session (agent) mounts a subset of capabilities from the preset
```

### Key terms

| Term | One-liner |
|---|---|
| plugin | an `apply(ctx)` function that registers capabilities or side effects on `ctx` |
| plugin row | one entry in `cordis.yml`: `id` + package `name` + `config` |
| composition | a `cordis.yml` file declaring a set of plugin rows |
| plane | host (process-level, shared across sessions) vs agent preset (per-session) |
| profile | startup config = several bundles stacked + your own patch |
| tool | a model-callable capability, registered by a plugin into the tools registry |
| skill | on-demand instructions/knowledge, registered from files or at runtime (see demo/02) |

### A real example

In the `standard` preset composition, every row is one capability:

```yaml
- id: tool-bash          # this row = "give the agent a bash tool"
  name: '@deepseek-ai/dsh-tool-bash'

- id: tool-skill         # this row = "give the agent a skill-loading tool"
  name: '@deepseek-ai/dsh-tool-skill'
```

`id` names the capability, `name` is the npm package implementing it, `config` is its configuration. Adding a capability = adding a row.

## How to run

```bash
bash explore.sh
```

It will, in order:
1. print the npm global root;
2. list the built-in presets (standard / code / minimal / cordis);
3. show the first 40 lines of the `standard` composition (see "one row = one capability" for real);
4. dump the first 30 lines of the default config tree (see the combined result).

You can also inspect manually:
```bash
dsh web --dump-default-config    # web profile's default config tree (bundle layers, no user patch)
dsh web --dump-config            # config tree after your local patch is applied
```

> Note: `--dump-config` and `--dump-default-config` are not standalone flags; they must be paired with a profile (they dump "a given profile's" config tree). `dsh web` above is an alias for `dsh --profile web`; other profiles work the same, e.g. `dsh --profile headless --dump-default-config`.

## What to observe

1. In `standard/agent.cordis.yml`, each `- id: ...` is a capability: `tool-bash` (shell), `tool-fs` (files), `tool-skill` (skill loading), `tool-web` (web search)...
2. **Why some rows are wrapped in a `group`**: services that must be isolated are wrapped with an `isolate` realm (the deep-dive topic of `demo/05`).
3. The host/preset split: host owns "shared across sessions", preset owns "differs per session".

## How it relates to the final goal

- The "robot capability hot-plugging" you will build is essentially: **insert a row (mount a capability) or remove a row (unmount a capability) into the composition at runtime**.
- So the "capability = plugin row" mental model built here is the direct foundation for `demo/13` hot-plugging.
- `demo/04` has you actually "insert a row": write a plugin that registers your own tool.
