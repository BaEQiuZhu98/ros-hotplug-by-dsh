# demo/01 — What is an agent

## What you learn

Build the correct mental model of an "agent" from zero. An agent is not magic — it is three parts assembled:

| Part | In this demo |
|---|---|
| **LLM** | a "conversation history → next reply" function |
| **Tools (tool calling)** | `get_time`, `calc` — ordinary Python functions the model can "request to call" |
| **Loop (ReAct)** | think → act → observe → think again, until a final answer |

Key concepts:
- **token**: the basic unit of text the model reads/writes (roughly "half a word").
- **tool calling**: the model does not answer directly; it returns a `tool_calls` request saying "please run `calc(expr="3*7+2")`".
- **ReAct loop**: model says "call a tool" → you run it → put the result back into history → model decides "call again" or "answer".

## How to run

```bash
# Prereq: Python 3.10+, zero third-party deps (stdlib only)
export DEEPSEEK_API_KEY="sk-your-key"

# make the agent use both tools
python3 agent.py "What time is it? Also compute 3*7+2"

# or trigger a single tool
python3 agent.py "What is 3*7+2?"
```

> If `deepseek-chat` is unavailable, set `export DEEPSEEK_MODEL=your-model`.

## What to observe

You will see a trace like this (the key chain: model decides to call tools → tools execute → results fed back → final answer):

```
user: What time is it? Also compute 3*7+2

step 0: model decides to call 2 tools
   tool: get_time() -> {'now': '2026-08-21T11:30:00'}
   tool: calc({'expr': '3*7+2'}) -> {'result': 23}

answer: It is 2026-08-21 11:30:00, and 3*7+2 = 23
```

**Try changing the question** so it uses one tool, or no tool at all, and watch the `tool_calls` branch appear / not appear.

## How it relates to the final goal

- The agent you ran in `demo/00` with DSH is essentially **an engineered version of this loop** (plus scopes, lifecycle, session management).
- `demo/04` replaces the "tools" with plugin tools registered in DSH; `demo/13` turns those tools into "robot capabilities" and adds/removes them at runtime — that is "hot-plugging".
- So: **understand this ~120-line minimal agent, and the DSH agent is no longer a black box.**
