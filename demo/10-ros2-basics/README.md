[中文](README.zh.md) | English

# demo/10 — ROS2 basics

## Build the intuition first (start here if new)

demo 06 only "installed ROS2". This chapter learns to **write your own ROS2 nodes** and understand the 4 communication mechanisms + 1 coordinate-frame mechanism.

| Concept | One-line meaning | Analogy |
|---|---|---|
| **node** | a process/program, the basic unit of ROS2 | a "person" |
| **topic** | pub/sub, one-to-many, continuous stream | group chat: anyone sends, subscribers receive |
| **service** | request/reply, one-to-one, one-shot | a phone call: ask once, answer once |
| **action** | long task + progress feedback, cancellable | ordering delivery: order → make → ship → done |
| **TF** | coordinate-frame relations: who is relative to whom, where, facing where | "where am I, relative to what" |

Remember: **nodes share no memory; they match up purely by these topic/service names** — that is exactly what makes ROS2 decoupled (one node crashing doesn't break the others).

## What you learn

- Write nodes with rclpy (ROS2's Python client library).
- Topic pub/sub: `talker.py` (publish) + `listener.py` (subscribe).
- Service request/reply: `add_two_ints_server.py` + `add_two_ints_client.py`.
- TF coordinate transforms (static + dynamic): static `tf_broadcaster.py`/`tf_listener.py` (send once + cache), dynamic `tf_dynamic_broadcaster.py`/`tf_dynamic_listener.py` (keep sending new messages).
- Observe the whole computation graph with the `ros2` CLI and `rqt_graph`.

## How to run

Prerequisite: ROS2 Humble (installed in demo 06). **Every terminal must first `source /opt/ros/humble/setup.bash`** (or put it in `.bashrc`).

### 1. Topic: publish + subscribe (two terminals)
```bash
# terminal 1
python3 talker.py

# terminal 2
python3 listener.py
```
Terminal 2 keeps printing `收到: "Hello World: N"`.

### 2. Service: one request, one reply (two terminals)
```bash
# terminal 1
python3 add_two_ints_server.py

# terminal 2
python3 add_two_ints_client.py        # 2 + 3
python3 add_two_ints_client.py 7 8    # 7 + 8
```
Terminal 2 prints `7 + 8 = 15`.

### 3. TF static: send once + latched + cached (two terminals)
```bash
# terminal 1
python3 tf_broadcaster.py

# terminal 2
python3 tf_listener.py
```
Terminal 2 prints `sensor 在 base_link 下: x=0.10 y=0.00 z=0.20` every second (the broadcaster sends once; the value never changes).

### 3b. TF dynamic: keep sending new messages (two terminals)
```bash
# terminal 1
python3 tf_dynamic_broadcaster.py

# terminal 2
python3 tf_dynamic_listener.py
```
Terminal 2's `moving_sensor: x=... y=...` keeps changing — the broadcaster sends a new position every tick, and the listener's buffer is updated by each new message.

### 4. Observe the computation graph
```bash
ros2 node list        # which nodes
ros2 topic list       # which topics
ros2 topic echo /chatter   # watch one topic's data stream
ros2 service list     # which services
ros2 run tf2_ros tf2_echo base_link sensor   # see the TF relation
rqt_graph             # graphical node + topic wiring
```

## What to observe

1. **Topic**: talker sends, listener receives — two processes that don't know each other, matched only by the topic name `chatter`.
2. **Service**: client sends one request, server replies once — ask and answer.
3. **TF static**: the position the listener queries is exactly the relation the broadcaster declared, proving TF works (send once + cache).
4. **TF dynamic**: `moving_sensor`'s position circles over time — each new message updates the buffer and the next lookup returns the new value (the answer to "how are new messages handled").
4. **rqt_graph**: you can see `talker → /chatter → listener` style wiring; the whole picture is the "computation graph".

## How it relates to the final goal

- This is the robotics middleware layer: demo 12's DSH↔ROS2 bridge and demo 13's hot-plugging both build on "node + topic + service + TF".
- "Topic" is the main channel DSH will later use to talk to ROS2 (via rosbridge); "TF" lets the agent know where each part is relative to the robot.
- demo 11 will redo this in C++ (rclcpp) and measure control rate / latency.
