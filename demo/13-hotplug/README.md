[中文](README.zh.md) | English

# demo/13 — Capability hot-plugging ★ flagship

## Build the intuition first (start here if new)

The previous 12 chapters built both halves: DSH (agent/plugin/spatiotemporal compositionality) and ROS2+MuJoCo (robot simulation + bridge). This chapter merges them into the project's single claim:

> **At runtime, mount/unmount robot "capabilities" the way you swap an end-effector, and the agent doesn't notice.**

This demo has **two complementary paths**:

- **Path A (agent tool hot-plugging)**: make "gripper/suction" each a DSH capability tool, `cordis_run` to mount, `cordis_stop` to unmount, demonstrating the 7 reliability points (see `docs/design.zh.md` §8).
- **Path B (web panel visualization closed loop)**: a web panel configures two arms' end-effectors (gripper/suction), sets the ball position, and picks an arm to touch the ball — the MuJoCo window follows live.

## File list

| File | Purpose |
|---|---|
| `robot_server.py` | Path A robot side: one arm + end-effector indicator (`--view`) |
| `two_arm_server.py` | Path B robot side: two arms + ball + tool config + touch + set ball |
| `send_capability.py` | send a capability name to `/capability_command` (path A) |
| `send_cmd.py` | generic: send one String to any topic (path B) |
| `capabilities/grasp_tool.js` | capability tool: gripper |
| `capabilities/suction_tool.js` | capability tool: suction cup |
| `capabilities/manifest.json` | capability metadata + code sha256 (pre-mount check) |
| `mount_guard.py` | pre-mount hash verification (zero-trust) |
| `web_hotplug_panel.js` | web panel plugin (host validation + client buttons) |
| `hotplug_walkthrough.md` | 7-reliability-point walkthrough (with real runtime records) |

## What you learn

- Capability = DSH plugin tool: mount/unmount = `cordis_run`/`cordis_stop`.
- Pre-mount zero-trust verification (manifest hash).
- The 7 reliability points: verify / multi-version / swap / rollback / event / shadowing / reclamation.
- One chain: capability → rosbridge → ROS2 topic → MuJoCo visualization.

## How to run (path A: agent tool hot-plugging)

Prerequisite: ROS2 Humble + MuJoCo + rosbridge + roslibpy (installed in demo 06/12).

```bash
# terminal 1
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
# terminal 2
source /opt/ros/humble/setup.bash && source ~/venvs/robo/bin/activate
python3 robot_server.py --view
```

```bash
# verify before mount
python3 mount_guard.py grasp capabilities/grasp_tool.js   # pass
```

Then in a cordis session, pass `capabilities/grasp_tool.js` as `code.host`, `cordis_define` + `cordis_run` → the agent can call `grasp()`, and the tip sphere turns red. See `hotplug_walkthrough.md` for the full 7-point walkthrough.

## How to run (path B: web panel visualization closed loop)

```bash
# terminal 1
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
# terminal 2
source /opt/ros/humble/setup.bash && source ~/venvs/robo/bin/activate
python3 two_arm_server.py --view   # MuJoCo window: two arms + yellow ball
```

In a cordis session, pass `web_hotplug_panel.js`'s host half as `code.host` and its client half as `code.client`, then `cordis_define` + `cordis_run`. A "双臂热插拔" panel appears above the input area:

```
臂 A  无  [夹爪] [吸盘] [触碰小球]
臂 B  无  [夹爪] [吸盘] [触碰小球]
小球  x [0.5] y [0.0] [设置]
```

- Click "夹爪/吸盘" → that arm's tip sphere turns red/blue.
- Change ball x/y → click "设置" → the yellow ball moves.
- Click "触碰小球" → that arm's tip chases the ball; if the arm has no end-effector → error "未配置末端执行器".
- Invalid input (e.g. ball position `abc`) → error.

## What to observe

1. **Mount-and-see / unmount-and-reclaim**: after mount the agent's tool table gains `grasp`; after unmount it disappears with no residue.
2. **Multi-version / swap / rollback**: see `hotplug_walkthrough.md` (actually demonstrated this session).
3. **Two-arm visualization closed loop**: the web panel changes config/ball position → the MuJoCo window follows live.

## How it relates to the final goal

- This demo is the **teaching/demonstration form** of the project's novelty claim (dynamic plugins: `cordis_define`/`cordis_run`/`cordis_stop`, process-local, gone on restart), demonstrating the 7 reliability points and the mechanism intuition of capability hot-plugging.
- The **production implementation form** lives in `src/` (capability repo dirs + mount service + arm/perception scopes + web panel): the same semantics — admission checks, runtime mount/unmount, multi-version swap, failure rollback — are landed as resident (out-of-tree) plugins in the mount system.
- Mechanism mapping between the two forms:

| Mechanism | demo/13 (demo form) | src/ (implementation form) |
|---|---|---|
| Capability form | dynamic plugin host half (in-process) | capability repo dir `repo/<cap>/<version>/{host.js, manifest.json}` |
| Mount/unmount | `cordis_run` / `cordis_stop` | web panel → mount service → arm/perception contexts `ctx.plugin`/`fiber.dispose` |
| Version swap/rollback | package versions + run pointers | version dirs + mount handles (auto-restore the old instance on failure) |
| Admission check | `mount_guard.py` manual hash comparison | mount-service inline sha256 + kind routing |

- In interviews, "runtime end-effector swap + zero-trust check + swap rollback" is backed by the `src/` mount system plus this demo's walkthrough.

## Appendix: reload after restart

The capability tools and the web panel are dynamic plugins (process-local), so they disappear after `dsh web` restarts; re-mount with the `cordis_define` + `cordis_run` steps above (sources are saved in this directory).

## Environment notes (hard-coded paths)

This demo is a teaching walkthrough; its code hard-codes machine-specific paths (`/root/my-project/ros-hotplug-by-dsh`, `/root/venvs/robo/bin/python3`). On another machine, rebuild the same paths per the demo/06 environment steps, or replace them manually. The production implementation centralizes paths in `src/setup.sh` (the mount service's `env()` is the single path source).
