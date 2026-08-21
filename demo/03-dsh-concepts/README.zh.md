# demo/03 — DSH 核心概念: 一切皆插件

## 学什么

建立 DSH 的心智模型. 一句话: **DSH 里任何能力(工具, 技能, 人设, 提示词片段)都不是写死的, 而是由"插件行"组合出来的.**

### 概念图

```
能力(capability) = 插件行(plugin row)
      |
      |  一行 = id + 包名(name) + 配置(config)
      |
      v
组合文件(cordis.yml)
      |
      +-- host 组合:  进程级, 只一份. 注册表本身/权限/沙箱/模型路由/存储
      |
      +-- agent preset 组合:  每会话一份. 工具/人设/技能/压缩策略
      |
      v
profile = 若干 bundle(组合包) 按顺序叠加 + 用户 patch
      |
      v
一个会话(agent) 从 preset 挂载出来的能力子集
```

### 关键术语

| 术语 | 一句话解释 |
|---|---|
| 插件(plugin) | 一个 `apply(ctx)` 函数, 在 `ctx` 上注册能力或挂副作用 |
| 插件行(plugin row) | `cordis.yml` 里的一行: `id` + 包名 `name` + `config` |
| 组合(composition) | 一个 `cordis.yml` 文件, 声明一组插件行 |
| 平面(plane) | host(进程级, 跨会话共享) vs agent preset(每会话) |
| profile | 启动配置 = 若干 bundle 按顺序叠加 + 用户自己的 patch |
| 工具(tool) | 模型可调用的能力, 由插件注册进 tools 注册表 |
| 技能(skill) | 按需加载的指令/知识, 由文件或运行时注册(见 demo/02) |

### 看一个真实例子

`standard` preset 的组合文件里, 每一行就是一个能力. 例如:

```yaml
- id: tool-bash          # 这一行 = "给 agent 一个 bash 工具"
  name: '@deepseek-ai/dsh-tool-bash'

- id: tool-skill         # 这一行 = "给 agent 一个 skill 加载工具"
  name: '@deepseek-ai/dsh-tool-skill'
```

`id` 是这个能力的名字, `name` 是实现它的 npm 包, `config` 是配置. 你「加一个能力」=「加一行」.

## 怎么跑

```bash
bash explore.sh
```

它会依次:
1. 打印 npm 全局根;
2. 列出内置 presets(standard / code / minimal / cordis);
3. 显示 `standard` 的组合文件前 40 行(真实看到"一行 = 一个能力");
4. dump 默认配置树前 30 行(看到组合后的整体).

也可以手动单独看:
```bash
dsh web --dump-default-config    # web profile 的默认配置树(bundle 层, 不含用户 patch)
dsh web --dump-config            # 叠加你本地 patch 后的配置树
```

> 注意: `--dump-config` 和 `--dump-default-config` 不是独立开关, 必须配合 profile 一起用(它 dump 的是"某个 profile"的配置树). 上面的 `dsh web` 是 `dsh --profile web` 的别名; 换成其它 profile 同理, 如 `dsh --profile headless --dump-default-config`.

## 观察什么

1. `standard/agent.cordis.yml` 里, 每一行 `- id: ...` 就是一个能力: `tool-bash`(命令), `tool-fs`(文件), `tool-skill`(技能加载), `tool-web`(网页检索)...
2. **为什么有的行被包在 `group` 里**: 服务必须隔离时用 `isolate` realm 包起来(这是后面 `demo/05` 时空组合性要深讲的内容).
3. host 组合与 preset 组合的分工: host 管「跨会话共享」, preset 管「每会话不同」.

## 与最终目标什么关系

- 你最终要做的「机器人能力热插拔」, 本质就是: **运行时往组合里"插"一行(挂载一个能力)或"拔"一行(卸载一个能力)**.
- 所以这个 demo 建立的「能力 = 插件行」心智, 是 `demo/13` 热插拔的直接地基.
- `demo/04` 会让你真正动手"插一行": 写一个 plugin 注册自己的工具.
