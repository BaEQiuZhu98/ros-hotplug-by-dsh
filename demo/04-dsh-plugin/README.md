# demo/04 — DSH plugins & tools

## What you learn

- **What a plugin is**: an object/function with `apply(ctx)`. `apply` runs on mount, registering capabilities or side effects.
- **What a tool is**: a "model-callable" capability, registered by a plugin into the tools registry.
- **Two delivery paths**:
  - Dynamic plugin (temporary, in-process): write-and-run via `cordis_define` + `cordis_run`.
  - Out-of-tree package (persistent, publishable): an npm package installed via `dsh plugin`.
- **host vs client**: files/commands/tools live on host; page UI lives on client. Tool registration is host-side.

### Core concept: the anatomy of a tool

See [`hello-tool.js`](hello-tool.js). A tool = 5 fields:

| Field | Role |
|---|---|
| `name` | tool name the agent sees |
| `description` | what it does; the model decides when to call it based on this |
| `parameters` | input parameters as a JSON Schema |
| `output` | output contract (`schema` for type, `render` decides what the model sees) |
| `execute` | the real logic: input `args`, returns a JSON-compatible value |

## How to run

### Path A: dynamic plugin (quick, in-process, temporary)

A dynamic plugin = register a piece of plugin code into the running DSH process **without writing files or installing packages**, and it takes effect immediately.

**Prerequisite: a `cordis` (creation-mode) session**

The `cordis_define` / `cordis_run` self-referential tools exist only in the `cordis` preset (= `standard` + that toolset; its display name is "创造模式", id `cordis`). Select it when creating a session in `dsh web`.

**Step 1: hand the code to the agent**

Tell the agent, pasting the `return { ... }` body from [`hello-tool.js`](hello-tool.js):

> Create a dynamic plugin that registers a `hello` tool. Use this as the host-half code:
> ```js
> return { apply(ctx) { harness.registerTool(ctx, harness.defineTool({ ... })) } }
> ```

**Step 2: the agent runs define → run**

The agent auto-loads the `cordis-plugin-development` skill, then:

1. `cordis_define` — registers the package (name + purpose + host-half code); **nothing runs yet**; returns a `dyn-<n>` id; a "definition card" with a launch control appears in the session.
2. `cordis_run` — actually evaluates the host half, registering `hello` into the tools registry; from the next model step, the agent can call it.

> Note: you don't type `cordis_define` arguments by hand — it's the agent's tool. Its exact schema is looked up by the agent via `cordis_inspect_list`, and the skill keeps usage correct. Also, `hello` needs only the host half; the client half is for plugins that want to put UI in the browser — leave it empty here.

**Step 3: watch the Run card**

After `cordis_run` returns `awaiting-approval` or `starting`, this step is async — wait for the system to report the final outcome (the card shows run status). No need to nudge it.

**Step 4: verify**

Say "greet me". On success, you see it call `hello({name: ...})` and return `hello, ...!`.

**Cleanup: stop / undefine**

- `cordis_stop` — stop (dispose the host half, withdraw the client half) but keep the definition, so it can run again.
- `cordis_undefine` — permanently delete.

> Two important boundaries:
> 1. **A dynamic package exists only in the current DSH process memory**: it writes no files, changes no `cordis.yml`, does not survive a restart, and disappears on `stop`/`undefine`/restart. To keep the result, use Path B or the normal dev flow.
> 2. **Trust posture = shell access**: the cordis toolset can mutate the live runtime; treat it as carefully as granting bash.

### Path B: out-of-tree package (real delivery, used in demo/13)

```bash
dsh plugin --profile web add <your-package>
```

Then add a plugin row in the composition (see demo/03's "capability = plugin row"). This is the resume-grade way to "create a real plugin" — done fully in demo/13.

## What to observe

1. After registration, the `hello` tool appears in the agent's tool catalog.
2. Ask it to greet you; it calls `hello({name: ...})` and returns `hello, ...!`.
3. Contrast with demo/01's bare Python tools: here the tool is no longer a function in a script, but a row of capability in the DSH composition.

## How it relates to the final goal

- demo/13's `dsh-plugin-robo` applies this exact pattern to **robot capabilities**: each motion primitive (grasp/move/place) is such a tool.
- "Hot-plugging" = mounting/unmounting those tools at runtime (see demo/05's spatiotemporal compositionality).
