# DESIGN — Technical Note & Design Rationale

> This file is the "staking" anchor: it states **what is claimed, why it is novel, how it is implemented, and how it is verified**. All later public artifacts (README / blog / arXiv / timestamp) derive from it.

---

## 1. Title & one-liner

**Hot-plugging embodied-robot capabilities via DSH spatiotemporal compositionality (ros-hotplug-by-dsh)**

Using DSH's *spatiotemporal compositionality* as the composition primitive for robot capability hot-plugging: **layered visibility in space, precise birth/death in time**.

---

## 2. Abstract

- **Problem**: embodied robots need to add/remove/replace capabilities at runtime (swap end-effectors, add sensors, upgrade skills), but existing approaches either require restarts, only cover the hardware layer, or are disconnected from the LLM-agent decision layer.
- **Method**: use DSH spatiotemporal compositionality (layered scopes + Cordis lifecycle) as the **capability-orchestration layer** on top of ROS2; wrap each robot capability as a DSH plugin tool, so hot-plugging = scope registration/disposal.
- **Result**: implement and verify four properties — **mount-and-see, unmount-and-reclaim, same-name isolation, agent-unaware switch** — plus Huawei-style reliability design (verification, multi-version, grayscale, rollback, event notification).

---

## 3. Motivation & background

- Real robots swap end-effectors (gripper ↔ suction), add sensors, and upgrade skills across tasks; ideally without restart, downtime, or side effects on other capabilities.
- Existing "reconfiguration" work mostly targets the hardware or ROS component layer, disconnected from the agent decision layer; LLM/agent robot frameworks mostly focus on a single task and lack precise lifecycle management for capability hot-plugging.
- Hence the need for an **upper-layer capability-orchestration primitive**: mount = immediately usable; unmount = exact resource reclamation; same-name capabilities do not cross-talk; versions can be grayscale-switched and rolled back.

---

## 4. Novelty claim (core · precise boundary)

### 4.1 Claim

> **The first to apply DSH spatiotemporal compositionality (layered scopes + Cordis lifecycle) to hot-plugging of embodied-robot capabilities, with a reproducible implementation and evaluation.**

### 4.2 What is NOT claimed (boundary)

| Explicitly not claimed | Why |
|---|---|
| Inventing "spatiotemporal compositionality" | It is DSH's existing mechanism (Cordis + scope) |
| First at "robot hot-plugging" | ROS2 lifecycle/composable nodes, AICA, Eclipse Muto already exist |
| First at "agent controlling ROS" | OpenRAL, RoboNeuron already exist |
| Hardware / real-time / electrical-safety hot-plugging | This project covers only the software capability layer |

### 4.3 Actual claim

The novelty is the combination of **this mechanism × this scenario × this implementation**:
- Mechanism: DSH layered scopes + parent-chain inheritance + nearest-wins + isolate realm + Cordis dispose + version timing (plugin/package/run).
- Scenario: hot-plugging of end-effectors / sensors / skills on embodied robots.
- Implementation: reproducible `demo/13-hotplug` with reliability design.

---

## 5. Related work comparison

| Work | Domain | Difference from this project |
|---|---|---|
| ROS2 lifecycle / composable nodes | ROS component lifecycle | Manages node state only; no agent visibility, same-type isolation, or version grayscale/rollback |
| AICA | Component-based reconfigurable robotics | Hardware/component layer; no LLM-agent orchestration layer |
| Eclipse Muto | Dynamic ROS stack orchestration | AV deployment orchestration |
| OpenRAL | ROS2-native agentic harness | Closest; this project's unique anchor is the specific "DSH spatiotemporal compositionality" mechanism |
| RoboNeuron | Foundation models × ROS modularity | Model integration; no precise hot-plug lifecycle |
| MCP | Generic tool protocol | A protocol standard; no scope/lifecycle orchestration semantics |

> Conclusion: the differentiator = **the specific "DSH spatiotemporal compositionality" primitive × the "capability hot-plugging" scenario × reliability design**.

---

## 6. Core concept: DSH spatiotemporal compositionality (brief)

Details in `docs/` (TBD). Key points:

- **Space axis**: capabilities are layered and realm-partitioned. Host composition (process-level) vs agent-preset composition (per-session); scope parent chain (global layer → preset standing layer → per-agent layer); registration views inherit **downward, nearest wins**; event admission extends **upward**; `isolate` realm isolates same-type services.
- **Time axis**: Cordis plugin `apply → effect → dispose` for precise birth/death; standing mounts/generations; dynamic plugin version timing — plugin (instance) / package (immutable version) / run (activation attempt) — with rollback.
- **Anchor contract**: **the registration context determines both visibility and ownership** — space (who can see) and time (who lives/dies) are bound by one anchor, preventing "visible but dead / alive but invisible".

---

## 7. System design

### 7.1 Layered architecture

```
[task / natural-language instruction]
        ↓
DSH Agent (decision orchestration)
        ↓ tool calls
DSH Plugin (capability tools: grasp / suction / detect …)  ← hot-plugging happens here
        ↓ rosbridge (WebSocket ↔ ROS2)
ROS2 control layer (C++ control node + Python sim bridge)
        ↓
MuJoCo simulation (Franka + end-effectors + scene)
```

### 7.2 Hot-plug mechanism design

| Operation | Mechanism | Effect |
|---|---|---|
| Mount capability | register plugin tool in robot scope | immediately visible/usable to agent |
| Unmount capability | dispose that plugin | exact reclamation of subscriptions/connections; agent-unaware |
| Replace capability | multi-version coexistence + `update` grayscale switch | old/new coexist, smooth switch |
| Same-name isolation | `isolate` realm | two gripper/suction instances never cross-talk |
| Failure rollback | `run`(current) vs `update`(target) | auto-rollback to previous version on activation failure |
| Change awareness | event broadcast + agent subscription | agent auto-perceives capability add/remove |

---

## 8. Reliability design (Huawei experience → project)

| Huawei experience | This project's counterpart | Verification |
|---|---|---|
| Zero-trust pipeline | Verify manifest / hash before mount; reject invalid | tampered manifest → rejected |
| Active/standby redundancy + multi-version | One capability, multiple coexisting versions | v1/v2 registered simultaneously without conflict |
| Grayscale upgrade + zero downtime | `update` grayscale switch, agent-unaware | task unaffected during switch |
| Second-level auto rollback | auto-rollback to previous version on failure | inject fault → auto-rollback |
| Pub/sub event notification | capability add/remove broadcasts events; agent subscribes | event received on mount/unmount |
| Hardware-difference shielding | capability abstraction; same-type shadow by name | two end-effectors shadow correctly |
| High availability / no leaks | isolate + dispose for exact cleanup | no residual connection/state after unmount |

> This section turns "Huawei experience" into "verifiable project capability" — the interview differentiator.

---

## 9. Verification metrics

| Metric | Acceptance criteria |
|---|---|
| Mount-and-see | agent can call the new tool immediately after mount |
| Unmount-and-reclaim | no residual subscription/connection after unmount (teardown observable) |
| Same-name isolation | two same-type capabilities register without conflict, no cross-talk |
| Agent-unaware switch | task success rate unchanged during `update` |
| Failure rollback | auto-rollback after injected fault; old capability still usable |

---

## 10. Limitations & future

- Covers only the **software capability layer**; hardware (electrical/connectivity), hard real-time, and safety boundaries are out of scope.
- Future: real hardware (ros2_control hardware_interface), cross-process/machine hot-plugging, integration with data loop / world models.

---

## 11. Disclosure & timestamp

> First public commit, FreeTSA timestamp receipts, and publication links: see [`docs/disclosure-log.md`](docs/disclosure-log.md).

---

## 12. References

> TBD: DSH docs, AICA, OpenRAL, RoboNeuron, ROS2 lifecycle nodes, software reconfiguration surveys, etc.
