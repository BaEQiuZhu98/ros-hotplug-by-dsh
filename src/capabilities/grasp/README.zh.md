# capability-grasp — 夹爪能力包(树外包)

第一个树外包能力包, 按 `../capability-spec.md` v1 实现: 注册一个 `grasp` 工具,
把指定臂(A/B)末端切到夹爪并触碰小球, 经薄 SDK 驱动 sim_bridge.

## 打包(本地发布)

```bash
cd src/capabilities/grasp
npm pack          # 产出 ros-hotplug-dsh-plugin-grasp-1.0.0.tgz
```

## 挂载前校验(零信任, 必做)

```bash
python3 ../mount_guard.py manifest.json grasp src/host.js   # 退出码 0 = 放行
```

## 安装(本地 tarball, 不碰 registry)

```bash
dsh plugin --profile <name> add /path/to/ros-hotplug-dsh-plugin-grasp-1.0.0.tgz
dsh --profile <name> --dump-config     # 组合树里应出现 capability-grasp 行
```

重启该 profile 的进程后, 工具表出现 `grasp`; 调用它时 sim_bridge 收到
/tool_config "A:grasp" 与 /touch_command "A".

## 升级与回滚(灰度不做)

```bash
dsh plugin --profile <name> add /path/to/...-1.1.0.tgz   # 升级(重启生效)
dsh plugin --profile <name> add /path/to/...-1.0.0.tgz   # 回滚(重启生效)
```

树外包回滚粒度 = 进程重启; 秒级回滚见动态插件模型(HANDOFF §8).

## 环境约定

- 依赖薄 SDK: 仓库根 `src/bridge/bridge_client.py`(venv `/root/venvs/robo` 提供 roslibpy).
- workdir/python 在 `cordis.patch.yml` 的 config 里配置, 换机器时改这两行.
- host.js 裸导入 `@deepseek-ai/dsh-tools`, 由 DSH profiles 模块回退解析, 无需声明依赖.
