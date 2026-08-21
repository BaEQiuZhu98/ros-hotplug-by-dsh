# demo/05 — DSH spatiotemporal compositionality

## What you learn

This is the **theoretical foundation** of the project's novelty, and the source of demo/13 hot-plugging. Full treatment in [`../../docs/spatiotemporal-compositionality.md`](../../docs/spatiotemporal-compositionality.md); here we focus on visible evidence.

One sentence: **in DSH, any capability is composed from "plugin rows"; that composition has both a spatial structure (layered, realm-partitioned placement) and a temporal structure (mount/undo/version). Both axes are bound by one anchor: the registration context determines both the visibility and the lifetime of that registration.**

### Space axis: who sees whom

```
global layer
   └─ agent preset standing mount (parent scope)
        └─ each live agent (child scope)
```

Two rules:
- **Registration view inherits downward**: a child scope sees its ancestors' layers; on collision, **nearest wins**.
- **Event admission extends upward**: ancestor listeners receive descendant events; never the reverse.

### Time axis: who lives/dies when

- **Cordis lifecycle**: `apply(register) -> effect(side effect) -> dispose(undo)`. Every contribution carries its undo, so "unplugging" is reversible.
- **Dynamic plugin version timing**: plugin (instance) / package (immutable version) / run (activation attempt), supporting `update` and rollback.

### The anchor contract

> The registration context determines both visibility and ownership, preventing a registration from being visible in one scope but disposed with another.

## How to run: see the real evidence

Spatiotemporal compositionality is not abstract — it appears throughout DSH's own composition files. Run demo/03's `explore.sh`, or inspect the standard preset directly:

```bash
grep -n "isolate" "$(npm root -g)/@deepseek-ai/dsh/config/agent-presets/standard/agent.cordis.yml"
```

You will see three real `isolate` realms:

```yaml
# example 1: plan-mode state isolated per agent
- id: planning
  name: cordis:group
  group: true
  isolate:
    planMode: true          # each agent gets its own plan state

# example 2: compaction state and the result pruner share one realm
- id: compaction
  group: true
  isolate:
    compaction: true
    toolResultPruner: true

# example 3: the workflow engine is visible only within this preset
- id: delegation
  group: true
  isolate:
    workflowEngine: true
```

## What to observe (three mechanisms, against real code)

### 1. Scope shadowing (nearest-wins)
- When the same capability name is registered in the global layer and the current agent layer, **the nearest wins**.
- This is why demo/02's skill can "override defaults": project skills shadow user skills, which shadow bundled skills.

### 2. isolate realm
- `isolate: true` means "one private instance per mounting session"; same-type services never cross-talk.
- Maps to the hot-plug need of "two gripper/suction instances never cross-talk".
- The rule is strict: **registering a service-publishing row loose in a preset is forbidden** — it must be wrapped in an isolated group, or the second session's mount collides.

### 3. dispose reclamation (lifecycle)
- Every contribution in `apply(ctx)` (tool registration, event listener, subscription) must be undoable.
- On stop/update/remove, teardown happens in order, with no leaks.
- Maps to the hot-plug need of "unmounting a capability = exact reclamation of its connections/state".

## How it relates to the final goal

demo/13's "robot capability hot-plugging" applies these mechanisms to a concrete scenario:

| Hot-plug need | Spatiotemporal mechanism |
|---|---|
| Insert a capability at runtime | register a tool in the robot scope (space + time) |
| Remove a capability at runtime | dispose the plugin, exact teardown (time) |
| Same-type capabilities never cross-talk | isolate realm (space) |
| Upgrade without restart | immutable package + update rollback (time) |
| Agent perceives add/remove | event broadcast + subscription (time + space) |

**One line**: first understand "capability = plugin row" (demo/03), "tool = callable capability" (demo/04), "scope + lifecycle = spatiotemporal compositionality" (this demo) — then hot-plugging is just "insert/remove a row at runtime".
