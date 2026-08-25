# eval 测试套件运行方法

本目录是 `.dsh/test-plan.md`(v3)的执行载体, 判定标准与用例 ID 一一对应,
结果自动聚合到 `eval/results/SUMMARY.md`。全部用例零手工: 环境起停、会话创建、
工具调用均由脚本/驱动插件完成。

## 总览: 四个执行批次

| 批次 | 载体 | 前置 |
|---|---|---|
| 门禁 1 冒烟(纯脚本) | pytest(`test_bridge_sdk.py` / `test_panel_bundle.py` / `test_tooling.py`) | 无外部进程 |
| SDK 全链路 + daemon + CLI | pytest(`test_bridge_live.py`, 标记 gate2) | RobEnv fixture 自动起独立 ROS 域 42/43 |
| 真实环境宿主 API 批次 | pytest(`test_host_api.py`) | 当前 GUI 的 /cap-mount 可用(真实环境) |
| 会话/挂载/故障注入套件 | 驱动插件 + `/tmp` 隔离环境(`assemble-env.sh`) | netns 能力(root), 网络命名空间内自带 rosbridge/sim_bridge |

## 1. 门禁 1 冒烟(每次改动后先跑)

```bash
/root/venvs/robo/bin/python3 -m pytest eval/tests/test_bridge_sdk.py \
  eval/tests/test_panel_bundle.py eval/tests/test_tooling.py -v
```

纯脚本, 不建连接、不起进程; 覆盖 SDK 输入校验(T-A-01/02/03/04/06)、
面板 bundle 契约(T-M-21)、pack.sh(T-M-19)、setup.sh 幂等(T-M-20)。

## 2. SDK 全链路(gate2, 需要机器人侧)

```bash
/root/venvs/robo/bin/python3 -m pytest eval/tests/test_bridge_live.py -v -m gate2
```

- RobEnv fixture 自动起停两套独立 ROS 域: 域 42(rosbridge 9091 + sim_bridge 无头)、
  域 43(rosbridge 9092, 无 sim_bridge, 供查询超时用例);
- 与用户 9090 域完全隔离; 需 `/dev/shm` 与 UDP 组播等完整系统访问(受限沙箱下会失败);
- T-A-13/14/28(daemon/CLI)固定连 9090, 依赖用户 rosbridge 在跑(daemon/CLI 无端口参数).

## 3. 真实环境宿主 API 批次

```bash
/root/venvs/robo/bin/python3 -m pytest eval/tests/test_host_api.py -v
```

前置: 当前 GUI(127.0.0.1:3080)已加载树外包面板与挂载服务, 且存在一个
「机器人任务」robo 会话(臂上下文来源)。覆盖 T-A-18/23/24、T-M-22/23、
T-A-25(xfail, 前置 P2-1 未修复)。

## 4. 会话/挂载/故障注入套件(/tmp 隔离环境)

```bash
# 装配(网络命名空间 evalns 内起域 43 的 rosbridge 9090 + sim_bridge + dsh web 3199,
# repo 指向副本目录 eval/hotplug/fixtures/repo-copy, 坏版本注入不触碰 src/):
bash eval/hotplug/assemble-env.sh start \
  --with-driver /root/my-project/ros-hotplug-by-dsh/eval/hotplug/drivers/suite_core.js
# 等待驱动写结果(约 2 分钟)后读取:
cat eval/results/run-driver/driver.json
# 清理:
bash eval/hotplug/assemble-env.sh stop
```

驱动插件可选(每个各需一次独立装配运行):
- `drivers/suite_core.js`: T-S 全系列 + T-M-02~09/16/24 + T-A-20/21/22;
- `drivers/suite_fault.js`: T-A-15/16/19/26(杀 daemon / STOP 僵死 / sim 停止 / rosbridge 断线);
- `drivers/suite_fake.js`: T-A-17 与 T-A-24③(需加 `--fake-python eval/hotplug/fixtures/fake-python.sh`);
- `drivers/smoke.js`: 最小冒烟(会话→挂载→arm_status→take_object).

## 5. 结果聚合

```bash
/root/venvs/robo/bin/python3 eval/lib/summary.py && cat eval/results/SUMMARY.md
```

聚合 `eval/results/run-*/` 下全部 JSON(同 case_id 取最新一轮判定);
判定集合: pass / fail / expected-fail / not-injectable / not-executed / deferred.

## 平台前提与已知约束

- roslibpy 的 twisted reactor 是进程级单例: 连接类用例一律在独立子进程中执行,
  不要在 pytest 进程内复用多个 Bridge 实例;
- pytest 6 的 xfail 状态只在 `pytest_runtest_logreport` 的 `wasxfail` 可见,
  汇总器据此记录 expected-fail;
- 挂载服务的 daemon 固定连 9090(无端口参数), 隔离环境靠网络命名空间提供
  独立的 9090, 与用户环境互不影响;
- 用例 ID 标识约定: 测试函数 docstring 第一行 `"T-A-01 | 用例名 [已实测]"`,
  驱动插件里 `record(case_id, ...)`.
