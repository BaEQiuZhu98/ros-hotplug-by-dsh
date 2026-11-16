# BiAdapt 项目：ROS2 Jazzy 命令清单

本清单基于当前环境 `ros2 --help` 实际输出整理（ROS2 Jazzy，Ubuntu 24.04，Gazebo Harmonic）。只列已注册的命令；不同安装可能略有差异。

## 0. 通用约定

- 使用前先 `source /opt/ros/jazzy/setup.bash`。
- 任意命令查帮助：`ros2 <command> -h`、`ros2 <command> <sub> -h`。
- 本项目在沙箱下运行，`HOME` 要指向可写目录（如 `/tmp/gz_home`），否则 Gazebo/ROS2 日志报错。
- CLI 依赖 ROS2 daemon；`ros2 node/topic/service list` 看不到对象时先查 `ros2 daemon status`。

## 1. action

动作通信：长任务、有反馈、可取消。

| 子命令 | 说明 | 用途 | 注意 |
|---|---|---|---|
| `info` | 查看某 action 的服务端与客户端信息 | 调试 action 服务端 | 需 action 名 |
| `list` | 列出当前注册的 action 名 | 确认 action 是否发布 | 只列已注册的 |
| `send_goal` | 发送 action 目标并回显反馈与结果 | 手动测试动作（导航到点、抓取） | 需 action 类型与 JSON 字段 |
| `type` | 查看 action 的类型 | 确认接口定义 | 需 action 名 |

## 2. bag

录制与回放 ROS 数据。

| 子命令 | 说明 | 用途 | 注意 |
|---|---|---|---|
| `burst` | 以快于原速发布 bag 数据 | 快速回放 | 下游可能过载 |
| `convert` | 转换 bag 格式或设置 | 兼容旧 bag | 注意新旧格式差异 |
| `info` | 查看 bag 元信息 | 确认录制内容与时长 | 只读 |
| `list` | 列出可用 bag 插件 | 确认存储与压缩插件 | 插件管理用 |
| `play` | 回放 bag | 复现实验、离线调试 | 注意时间倍率与 loop |
| `record` | 录制话题到 bag | 采集仿真数据供分析或训练 | 注意磁盘空间，`-a` 录全部 |
| `reindex` | 重建 bag 元信息 | bag 损坏恢复 | 只对损坏或中断的 bag |

## 3. component

组件化节点管理。

| 子命令 | 说明 | 用途 | 注意 |
|---|---|---|---|
| `list` | 列出容器与组件 | 查看组件化节点 | 需组件化架构 |
| `load` | 把组件加载进容器 | 运行时加载节点 | 容器需在运行 |
| `standalone` | 以独立容器运行组件 | 组件独立测试 | 需插件名 |
| `types` | 列出已注册组件类型 | 查可用组件 | 依赖 ament index |
| `unload` | 从容器卸载组件 | 运行时热卸载，与故障资源回收相关 | 需容器与组件 id |

## 4. daemon

CLI 守护进程管理。

| 子命令 | 说明 | 用途 | 注意 |
|---|---|---|---|
| `start` | 启动守护进程 | 加速 CLI 发现 | 通常自动启动 |
| `status` | 查看守护进程状态 | 排查 CLI 看不到节点或话题 | 异常时重启 |
| `stop` | 停止守护进程 | 清理或重置发现缓存 | 停止后 CLI 命令变慢 |

## 5. doctor

环境诊断。

| 子命令 | 说明 | 用途 | 注意 |
|---|---|---|---|
| `hello` | 检查多主机网络连通性 | 多机通信排查 | 需多机场景 |
| `ros2 doctor`（直接运行）、`--report` | 诊断 ROS 版本、网络、依赖等环境 | 环境排错第一步 | `--report` 输出完整报告 |

## 6. interface

接口类型查询。

| 子命令 | 说明 | 用途 | 注意 |
|---|---|---|---|
| `list` | 列出所有接口类型 | 查可用 msg/srv/action | 数量大，配合 grep |
| `package` | 列出某包的接口类型 | 按包查 | 需包名 |
| `packages` | 列出提供接口的包 | 找接口来源 | 无 |
| `proto` | 输出接口原型 | 生成模板 | 需接口类型 |
| `show` | 输出接口定义 | 看字段，写代码或调试 | 需接口类型 |

## 7. launch

启动 launch 文件。

| 子命令 | 说明 | 用途 | 注意 |
|---|---|---|---|
| `launch` | 运行 launch 文件 | 一键启动多节点，本项目启动整机主入口 | 用 `包名 文件名` 或路径；参数用 `参数名:=值` 传递 |

## 8. lifecycle

生命周期节点管理。

| 子命令 | 说明 | 用途 | 注意 |
|---|---|---|---|
| `get` | 查节点生命周期状态 | 查 lifecycle 节点，如 ros2_control 组件 | 需节点名 |
| `list` | 列出可用状态转换 | 了解 transition 名 | 打印转换列表 |
| `nodes` | 列出 lifecycle 节点 | 找受管节点 | 无 |
| `set` | 触发状态转换 | 手动 activate 或 cleanup，如 controller_manager 管理 | 需节点名与 transition 名 |

## 9. multicast

多播排查。

| 子命令 | 说明 | 用途 | 注意 |
|---|---|---|---|
| `receive` | 接收单个 UDP 组播包 | 排查 DDS 发现通信 | 需监听绑定 |
| `send` | 发送单个 UDP 组播包 | 测试多播连通 | 需地址与端口 |

## 10. node

节点查询。

| 子命令 | 说明 | 用途 | 注意 |
|---|---|---|---|
| `info` | 查节点信息，含发布、订阅、服务 | 调试节点接口 | 需节点名 |
| `list` | 列出节点 | 确认节点在跑 | 依赖 daemon |

## 11. param

参数管理。

| 子命令 | 说明 | 用途 | 注意 |
|---|---|---|---|
| `delete` | 删除参数 | 清理参数 | 需节点与参数名 |
| `describe` | 查参数描述，含类型、默认值和范围 | 确认参数含义 | 需节点 |
| `dump` | 导出节点参数为 YAML | 备份或记录配置 | 需节点 |
| `get` | 读参数 | 查当前值 | 需节点与参数名 |
| `list` | 列参数 | 查可用参数 | 需节点 |
| `load` | 从 YAML 加载参数 | 批量配置 | 需节点 |
| `set` | 设置参数 | 运行时调参，如控制器参数 | 需节点、参数名、值 |

## 12. pkg

包管理。

| 子命令 | 说明 | 用途 | 注意 |
|---|---|---|---|
| `create` | 创建新包 | 新建 ROS2 包 | 注意模板与构建类型 |
| `executables` | 列出包的可执行文件 | 查 `ros2 run` 的目标 | 需包名 |
| `list` | 列出已装包 | 查已装包，如 ros_gz | 数量大，配合 grep |
| `prefix` | 输出包安装路径 | 找安装目录 | 需包名 |
| `xml` | 输出包 manifest XML | 查依赖与元信息 | 需包名 |

## 13. plugin

插件查询。

| 子命令 | 说明 | 用途 | 注意 |
|---|---|---|---|
| `list` | 列出插件 | 查可用插件类型，如 RViz 显示、controller 插件 | 需插件类型参数 |

## 14. run

运行包内可执行文件。

| 子命令 | 说明 | 用途 | 注意 |
|---|---|---|---|
| `run` | 运行包内可执行文件 | 启动单个节点，如 `ros2 run ros_gz_bridge ...` | 参数用 `--ros-args` 传递 |

## 15. security

SROS2 安全。

| 子命令 | 说明 | 用途 | 注意 |
|---|---|---|---|
| `create_enclave` | 创建 enclave | SROS2 安全隔离 | 本项目暂不涉及 |
| `create_key` | 创建 enclave，已废弃 | 旧接口 | 用 create_enclave 替代 |
| `create_keystore` | 创建密钥库 | SROS2 密钥管理 | 安全启动用 |
| `create_permission` | 创建权限 | SROS2 权限控制 | 需 policy |
| `generate_artifacts` | 从身份列表生成密钥与权限 | 批量生成 | 需配置 |
| `generate_policy` | 从图数据生成 policy XML | 自动生成权限 | 需运行图 |
| `list_enclaves` | 列出 enclave | 查已建 | 需 keystore |
| `list_keys` | 列出 enclave，已废弃 | 旧接口 | 用 list_enclaves 替代 |

## 16. service

服务管理。

| 子命令 | 说明 | 用途 | 注意 |
|---|---|---|---|
| `call` | 调用服务 | 手动触发服务，如控制器切换 | 需服务名、类型、参数 |
| `echo` | 回显服务请求与响应 | 调试服务 | 需服务名 |
| `find` | 按类型找服务 | 查某类型服务 | 需类型 |
| `info` | 查服务信息，含类型与提供者 | 确认服务端 | 需服务名 |
| `list` | 列出服务 | 查看可用服务 | 依赖 daemon |
| `type` | 查服务类型 | 确认接口 | 需服务名 |

## 17. topic

话题管理。

| 子命令 | 说明 | 用途 | 注意 |
|---|---|---|---|
| `bw` | 显示话题带宽 | 评估数据量，如相机或点云 | 需时间窗口参数 |
| `delay` | 显示话题时延，按 header 时间戳 | 评估实时性 | 仅对有 header 的消息 |
| `echo` | 打印话题消息 | 调试，如看关节状态或相机信息 | 数据大用 `--once` |
| `find` | 按类型找话题 | 查某类型话题 | 需类型 |
| `hz` | 显示发布频率 | 确认频率，如传感器或控制 | 需话题在发布 |
| `info` | 查话题信息，含类型、发布者、订阅者 | 确认接口 | 需话题名 |
| `list` | 列出话题 | 查看当前话题 | 依赖 daemon |
| `pub` | 发布消息 | 手动发指令，如用 `cmd_vel` 测底盘 | 需类型与消息内容 |
| `type` | 查话题类型 | 确认接口 | 需话题名 |

## 18. wtf

doctor 的别名。

| 子命令 | 说明 | 用途 | 注意 |
|---|---|---|---|
| `wtf` | 与 `ros2 doctor` 等价 | 环境诊断 | 同 doctor |

## 19. 本项目高频场景速查

| 场景 | 命令 |
|---|---|
| 确认 Gazebo/ROS2 话题 | `ros2 topic list`、`ros2 topic info /clock` |
| 看关节状态 | `ros2 topic echo /joint_states --once` |
| 测底盘速度指令 | `ros2 topic pub /cmd_vel geometry_msgs/msg/Twist "{linear: {x: 0.2}}"` |
| 查机器人模型相关话题 | `ros2 topic list | grep -E "tf|joint|scan|camera"` |
| 查控制器参数 | `ros2 param list <controller_manager>`、`ros2 param get ...` |
| 生命周期节点启停 | `ros2 lifecycle nodes`、`ros2 lifecycle set <node> activate` |
| 查包与可执行 | `ros2 pkg list | grep ros_gz`、`ros2 pkg executables ros_gz_sim` |
| 录数据供分析 | `ros2 bag record -o /tmp/run1 /joint_states /tf` |
| 环境排错 | `ros2 doctor --report` |
