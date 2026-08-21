# demo/00 — DSH quickstart

## What you learn

- What DSH (DeepSeek Harness) is: an "everything-is-a-plugin" agent runtime.
- Two run modes: `headless` (CLI, run-and-exit) and `web` (browser GUI).
- The minimal loop: install → set key → run your first agent conversation.

> This is the **runtime base** for every later demo. Get it working before anything about agents/plugins/robots.

## How to run

### 0. Prerequisites
- Node.js ≥ 20 (22+ recommended): `node -v`
- npm
- a DeepSeek API Key (`sk-...`)

### 1. Install
```bash
npm install -g @deepseek-ai/dsh
dsh --version          # prints a version (e.g. 0.1.0-rc.x)
```
> If `dsh` is not on PATH, verify with `npx @deepseek-ai/dsh --version`.

### 2. Set the API key (DSH reads it from the environment)
```bash
export DEEPSEEK_API_KEY="sk-your-key"
```
> This is the environment variable DSH's `deepseek-official` model route reads by default (`apiKeyEnv: DEEPSEEK_API_KEY`).

### 3. First run (headless mode)
```bash
dsh --profile headless "Introduce yourself in one sentence and tell me the day of the week"
```
- The headless profile auto-initializes from a template on first use.
- It prints the final answer and exits.

### 4. Run the web GUI
```bash
dsh web
```
- Open the URL it prints (default http://localhost:3080) and chat in the browser.

### 5. Environment self-check (optional)
```bash
bash check.sh
```

## What to observe

1. **headless output**: the agent's final answer.
2. **web GUI**: a full conversation session — you see the "your message → agent reply" loop.
3. **What an agent really is**: not a magic black box, but "model + conversation loop + (optional) tools". That is the subject of `demo/01`.

## How it relates to the final goal

- Later `demo/04` (write a plugin), `demo/12` (DSH↔ROS2), and `demo/13` (hot-plugging) all run on this same DSH.
- The mental model to build here: **DSH splits "capabilities" into pluggable plugins, and an agent is just one consumer of those capabilities**.
