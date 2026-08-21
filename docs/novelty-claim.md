# Novelty Claim (precise boundary)

> This is the core staking statement, sharing the same source as [`../DESIGN.md`](../DESIGN.md) section 4, expanded into a standalone citable page.

---

## One-sentence claim

> **The first to apply DeepSeek Harness (DSH) spatiotemporal compositionality (layered scopes + Cordis lifecycle) to hot-plugging of embodied-robot capabilities, with a reproducible implementation and evaluation.**

## The three constituents of the claim

The novelty is not a single word but the **combination** of three:

| Constituent | Content |
|---|---|
| **Mechanism** | DSH layered scopes + parent-chain inheritance + nearest-wins + `isolate` realm + Cordis `dispose` + version timing (plugin/package/run) |
| **Scenario** | hot-plugging of embodied-robot capabilities: runtime add/remove/replace of end-effectors (gripper ↔ suction), sensors, skills |
| **Implementation** | reproducible `demo/13-hotplug` with reliability design (verification / multi-version / grayscale / rollback / event / isolation / reclamation) |

**All three are required**: drop "mechanism" and it becomes ordinary robot hot-plugging; drop "scenario" and it becomes a pure DSH mechanism demo; drop "implementation" and it becomes an unverifiable idea.

## Explicitly NOT claimed (boundary)

| Not claimed | Why | Evidence |
|---|---|---|
| Inventing "spatiotemporal compositionality" | It is DSH's existing mechanism (Cordis + scope) | DSH source/docs |
| First at "robot hot-plugging" | ROS2 lifecycle nodes, AICA, Eclipse Muto already exist | see [`prior-art.md`](prior-art.md) |
| First at "agent controlling ROS" | OpenRAL, RoboNeuron already exist | see [`prior-art.md`](prior-art.md) |
| Hardware / hard-real-time / electrical-safety hot-plugging | this project covers only the software capability layer | DESIGN section 10 |

## Why this boundary

Over-claiming is spotted instantly and erodes credibility; under-claiming loses significance. The correct framing: **the specific combination of this mechanism × this scenario × this implementation is not yet found in public sources**. This is honest, verifiable, and leaves enough differentiation.

## How to verify the claim

| Checkpoint | Method |
|---|---|
| Not in public sources | periodic search (keywords below), record date and results |
| Reproducible | anyone can run `demo/13-hotplug` per its README and reproduce the four metrics |
| Temporal priority | governed by the commit hash + timestamp + push in [`disclosure-log.md`](disclosure-log.md) |

**Suggested periodic search keywords**: `DSH 时空组合性 机器人 热插拔`, `DSH spatiotemporal hot-plug robot`, `DeepSeek Harness robotics hot-plug`, `Cordis scope robot reconfiguration`.

## Escalation path for the wording

- Stage 1 (now): in-repo statement, wording as above.
- Stage 2: public blog/community, keep "first" but attach the prior-art comparison.
- Stage 3: arXiv preprint, switch to academic wording (drop "first", use "we present", backed by verifiable experiments).
