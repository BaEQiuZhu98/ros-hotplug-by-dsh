[中文](spatiotemporal-compositionality.zh.md) | English

# DSH Spatiotemporal Compositionality — explained

> This is the methodological foundation of the project and its core teaching document. Goal: turn DSH's "spatiotemporal compositionality" into a reusable mental model that transfers to robot hot-plugging.
> Basis: DSH source/docs (`dsh-scope` package, `editing-cordis-compositions` skill, `cordis-plugin-development` skill).

---

## 0. One sentence

**In DSH, any capability (tool, skill, service, prompt section) is not hard-coded but composed from "plugin rows"; this composition has both a spatial structure (layered, realm-partitioned placement) and a temporal structure (mounting, disposal, version evolution).**

Both axes are bound by a single anchor so they never contradict:

> **The registration context determines both the visibility and the lifetime of that registration.**

---

## 1. Space axis: who sees whom (Scope / Layer / Plane / Realm)

### 1.1 Two planes

| Plane | What it is | Lifetime |
|---|---|---|
| **Host composition** | process-level: the registries themselves (tools/systemPrompt/agents/sessions), cross-session storage/permissions/sandbox/model routing | one per process, persistent |
| **Agent-preset composition** | what one session contributes: tool plugins, persona, prompt sections, compaction policy | one per session, mounted/unmounted with it |

> The criterion is not "is this agent-related" but "**must it be shared across sessions**". Shared → host; per-session → preset.

### 1.2 Scope chain — the core of the space axis

```
global layer
   └─ agent preset standing mount (parent scope)
        └─ each live agent (child scope, one per agent)
```

Two opposing rules:

- **Registration view inherits downward**: a child scope sees its ancestors' layers; on name collision, **nearest shadows farthest** (nearest-wins).
- **Event admission extends upward**: a listener tagged with an ancestor receives descendant events; **never the reverse**.

> Plainly: **upper layers set global defaults, lower layers override; broadcast flows bottom-up, never top-down.**

### 1.3 Layers and realms

- **Layer**: a registry has a "global layer + one layer per exact scope"; reads `merge` along the scope chain with insertion-ordered name shadowing. `peek()` reads only one's own layer — **one's own restrictions/guards must not silently inherit ancestors'**.
- **Realm**: decides whether a service is process-global or per-session isolated. Hard rule: **registering a service-publishing row loose in a preset is forbidden** — wrap the provider **and all its consumers** in a group with an `isolate` realm, or the second session's mount collides.

---

## 2. Time axis: who lives/dies when (Lifecycle / Generation / Version)

### 2.1 Cordis lifecycle (the lowest-level time rule)

Each plugin is an `apply(ctx)` function; every contribution must be exactly undoable:

```
apply (register) → effect/on (side effect) → dispose (undo)
```

- `ctx.effect()` returns a disposer;
- stop/update/remove tears down in order;
- **no process-level or page-level leaked side effects**.

This is the ground of temporal compositionality: **every contribution carries its own undo**, so "unplugging" is reversible and predictable.

### 2.2 Standing mount & generation

A preset uses `standingKeyFor(id)` for mount validation: it **actually composes the preset's plugin subtree for real**. Success installs a **standing generation** that lives until process exit; failure disposes the whole subtree, leaving nothing behind.

### 2.3 Dynamic plugin version timing (plugin / package / run)

Three clearly separated time concepts:

| Concept | Meaning | Reversibility |
|---|---|---|
| **Plugin** | stable instance (`pluginId`) | long-lived |
| **Package** | **immutable** code version (`packageId`) | changing code appends a new package, never overwrites |
| **PluginRun** | each activation attempt (`pluginRunId`) | single-shot |

This yields explicit timing semantics: `run` (first/restart/rollback), `update` (switch version), `stop` (pause but keep versions), `undefine` (permanent delete), with current/next version pointers supporting "update failed → rollback".

---

## 3. The anchor contract: how the two axes combine

> **The registration context determines both visibility and ownership, preventing a registration from being visible in one scope but disposed with another.**

This is the real problem spatiotemporal compositionality solves — **space (who sees) and time (who lives/dies) must be bound by one anchor**, otherwise you get "ghost registrations": something visible is already dead, or something alive is invisible.

---

## 4. Transfer to robot hot-plugging (this project's core mapping)

| Robot hot-plug need | Spatiotemporal counterpart |
|---|---|
| Insert a new sensor/gripper/camera at runtime | register a plugin tool in the robot scope → immediately visible/usable (space + time) |
| Remove/replace a module at runtime | dispose that plugin → exact teardown (time) |
| Multiple end-effectors/devices coexist | one child scope per module, parent-chain inheritance, same-name nearest-wins (space) |
| Same-type modules never cross-talk | `isolate` realm isolation (space) |
| Upgrade a module without restarting the robot | immutable Package + `run`/`update` rollback (time) |
| Capability visible only to a given agent/session | global layer vs preset layer vs per-agent layer (space) |
| Decision layer perceives capability add/remove | event broadcast + agent subscription (time + space) |

---

## 5. Glossary

| Term | One line |
|---|---|
| plane | host (process-level) vs agent preset (per-session) |
| scope | a tagged context; registrations are visible and alive with it |
| scope chain | parent chain: view inherits downward, events extend upward |
| layer | a registry's global or exact-scope contribution, merged along the chain on read |
| nearest-wins | same-name registrations shadow along the parent chain |
| realm / isolate | controls whether a service is process-global or per-session isolated |
| apply / effect / dispose | the Cordis lifecycle triad: register / side-effect / undo |
| standing mount / generation | long-lived composition installed after preset validation |
| plugin / package / run | dynamic plugin's three time levels: instance / immutable version / activation attempt |
| anchor contract | registration context = visibility + ownership |
