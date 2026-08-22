# demo/12 — DSH ↔ ROS2 bridge

## Build the intuition first (start here if new)

The previous 11 chapters separately learned DSH (agent/plugin) and ROS2 (node/topic/control). This chapter connects them; the full chain is:

```
agent sentence / web panel inputs the end-effector position
   ↓
DSH plugin (the move_arm tool, or a web frontend panel)
   ↓ runs a Python script (the end-effector position first becomes joint angles via IK)
   ↓
rosbridge (WebSocket, translating JSON into ROS2)
   ↓ /joint_command
arm_server (ROS2 + MuJoCo) —— the arm moves (visualized in a MuJoCo window)
```

Key point: **a DSH plugin runs in Node.js and cannot import rclpy**, so rosbridge acts as the "translator" that lets non-ROS programs (Node/Python scripts) call ROS2. That is the "decoupling" — DSH and ROS2 don't directly depend on each other.

## What you learn

- rosbridge: ROS2's WebSocket bridge, letting non-ROS clients call ROS2.
- One full chain: DSH plugin → rosbridge → ROS2 topic → MuJoCo arm.
- End-effector position → joint angles (IK, reusing demo 08's law of cosines) → send the command.
- Two DSH plugins: the `move_arm` tool (callable by the agent) and a web panel (visualization closed loop).
- A MuJoCo window with smooth animation: ROS callbacks and rendering run in the same loop.

## How to run

Prerequisite: ROS2 Humble + MuJoCo (demo 06), plus two extras:

```bash
sudo apt install -y ros-humble-rosbridge-suite   # rosbridge
pip install roslibpy                             # Python bridge client
```

### 1. Start rosbridge (one terminal)
```bash
source /opt/ros/humble/setup.bash
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```
Listens on `ws://localhost:9090`.

### 2. Start the arm (visualization, one terminal)
```bash
source /opt/ros/humble/setup.bash
source ~/venvs/robo/bin/activate    # make rclpy and mujoco both available
python3 arm_server.py --view        # opens a MuJoCo window; the arm follows smoothly
```
> Without `--view` it only prints the end-effector position (no graphics, for testing).

### 3. Verify layer by layer (bypass DSH first)
```bash
# 3a. send joint angles with the native ROS command
ros2 topic pub /joint_command std_msgs/msg/Float32MultiArray "{data: [0.5, 0.8]}" --once

# 3b. send joint angles via rosbridge
python3 bridge_client.py 0.5 0.8

# 3c. send an end-effector position (internally IK'd into joint angles first)
python3 move_ee.py 0.5 0.3
```
Each send makes the `arm_server` terminal print the received joint angles / end-effector position; with `--view`, the arm in the window smoothly turns to the target.

### 4. Attach DSH (two plugins, reload after restart)
In a cordis session:
- **move_arm tool**: pass `dsh_move_arm_tool.js` as `code.host`, then `cordis_define` + `cordis_run`. The agent can then call `move_arm(q1, q2)`.
- **web panel**: pass `web_arm_panel.js`'s host half as `code.host` and its client half as `code.client`, then `cordis_define` + `cordis_run`. A "机械臂末端 x/y + 发送" panel then appears above the input area.

## What to observe

1. **Layer-by-layer verification**: `ros2 topic pub` → `bridge_client.py` → `move_ee.py` → DSH plugin; each layer is independently testable.
2. **Decoupling**: `arm_server` doesn't care who sends; the bridge imports no ROS packages; the DSH plugin imports no rclpy. They match only by the topic name `/joint_command`.
3. **Visualization closed loop**: change x/y in the web panel → the arm in the MuJoCo window follows smoothly ("one sentence / one input → arm motion").

## How it relates to the final goal

- This is the foundation for demo 13's hot-plugging flagship: demo 13 will add/remove "capability tools" (grasp/suction/detect…) at runtime on this "DSH ↔ ROS2" bridge, and each capability ultimately drives ROS2 through it.
- "agent / web frontend calls ROS2 via rosbridge" is the hard evidence of "connecting DSH to the robot" on the resume.

## Appendix: plugin code & reloading after restart

- Plugin sources are saved in this directory: `dsh_move_arm_tool.js` (move_arm tool, host-only) and `web_arm_panel.js` (web panel, host + client halves).
- Both are **dynamic plugins** (process-local), so they disappear after `dsh web` restarts; reload them with the `cordis_define` + `cordis_run` steps in section 4.
- Note: when `move_arm` / the web panel runs the bridge script from the host, it must explicitly use demo 06's venv Python (`/root/venvs/robo/bin/python3`), because the system `python3` has no `roslibpy`.
