[English](README.md) | 中文

# demo/10 — ROS2 基础（ros2-basics）

## 先建立直觉（零基础从这里读）

demo 06 只是「装好了 ROS2」。这一章学会**自己写 ROS2 节点**，理解它的 4 种通信方式 + 1 个坐标系机制。

| 概念 | 一句话 | 类比 |
|---|---|---|
| **节点 node** | 一个进程/程序，ROS2 的基本单元 | 一个「人」 |
| **话题 topic** | 广播/订阅，一对多，持续流 | 群聊：谁都能发，谁订阅谁收到 |
| **服务 service** | 一问一答，一对一，一次性 | 打电话：问一次答一次 |
| **动作 action** | 长任务 + 进度反馈，可取消 | 点外卖：下单→做→送→完成，中间可查进度 |
| **TF** | 坐标系关系：谁相对谁、在哪、朝向哪 | 「我在哪，相对谁」 |

记住：**节点之间不共享内存，全靠这些「话题/服务」名字对上号**——这正是 ROS2 解耦（一个节点挂了不影响别人）的关键。

## 学什么

- 用 rclpy（ROS2 的 Python 客户端库）写节点。
- 话题 pub/sub：`talker.py`（发布）+ `listener.py`（订阅）。
- 服务 request/reply：`add_two_ints_server.py` + `add_two_ints_client.py`。
- TF 坐标变换（静态 + 动态）：静态 `tf_broadcaster.py`/`tf_listener.py`（发一次 + 缓存），动态 `tf_dynamic_broadcaster.py`/`tf_dynamic_listener.py`（持续发新消息）。
- 用 `ros2` 命令行和 `rqt_graph` 观察整个计算图。

## 怎么跑

前置：ROS2 Humble（demo 06 已装）。**每个终端都要先 `source /opt/ros/humble/setup.bash`**（或写进 `.bashrc`）。

### 1. 话题：发布 + 订阅（两个终端）
```bash
# 终端 1
python3 talker.py

# 终端 2
python3 listener.py
```
终端 2 会持续打印 `收到: "Hello World: N"`。

### 2. 服务：一问一答（两个终端）
```bash
# 终端 1
python3 add_two_ints_server.py

# 终端 2
python3 add_two_ints_client.py        # 2 + 3
python3 add_two_ints_client.py 7 8    # 7 + 8
```
终端 2 打印 `7 + 8 = 15`。

### 3. TF 静态：发一次 + 锁存 + 缓存（两个终端）
```bash
# 终端 1
python3 tf_broadcaster.py

# 终端 2
python3 tf_listener.py
```
终端 2 每秒打印 `sensor 在 base_link 下: x=0.10 y=0.00 z=0.20`（广播端只发一次，值永远不变）。

### 3b. TF 动态：持续发新消息（两个终端）
```bash
# 终端 1
python3 tf_dynamic_broadcaster.py

# 终端 2
python3 tf_dynamic_listener.py
```
终端 2 每秒打印的 `moving_sensor: x=... y=...` **一直在变**——广播端每秒发新位置，监听端的 buffer 被新消息持续更新。

### 4. 观察计算图
```bash
ros2 node list        # 有哪些节点
ros2 topic list       # 有哪些话题
ros2 topic echo /chatter   # 直接看某个话题的数据流
ros2 service list     # 有哪些服务
ros2 run tf2_ros tf2_echo base_link sensor   # 看 TF 关系
rqt_graph             # 图形化看节点+话题的连线
```

## 观察什么

1. **话题**：talker 发、listener 收，两个进程互不认识，只认话题名 `chatter`。
2. **服务**：client 发一次请求，server 回一次结果，一问一答。
3. **TF 静态**：listener 查出的位置正是 broadcaster 声明的关系，说明 TF 打通（发一次 + 缓存）。
4. **TF 动态**：`moving_sensor` 的位置随时间绕圈变化——新消息一到 buffer 就被更新，下一次 lookup 就读到新值（这就是「新消息怎么被处理」的答案）。
5. **rqt_graph**：能看到 `talker → /chatter → listener` 这类节点连线，整张图就是「计算图」。

## 与最终目标什么关系

- 这是机器人中间件层：demo 12 的 DSH↔ROS2 桥、demo 13 的热插拔，都建立在「节点 + 话题 + 服务 + TF」这套机制上。
- 「话题」是 DSH 后面跟 ROS2 通信的主通道（经 rosbridge）；「TF」让 agent 知道各个部件相对机器人的位置。
- demo 11 会把这套从 Python（rclpy）换成 C++（rclcpp），并测控制频率/延迟。
