# demo/04 — DSH 插件(plugin)与工具(tool)

## 学什么

- **插件(plugin)** 是什么: 一个带 `apply(ctx)` 的对象/函数. `apply` 在挂载时执行, 用来注册能力或挂副作用.
- **工具(tool)** 是什么: 一种"模型可调用"的能力, 由插件注册进 tools 注册表.
- **两条落地路径**:
  - 动态插件(临时, 进程内): 用 `cordis_define` + `cordis_run` 现写现跑.
  - 树外包(持久, 可发布): 写成 npm 包, 用 `dsh plugin` 装进 profile.
- **host vs client**: 文件/命令/工具这类跑在 host; 页面 UI 跑在 client. 工具注册属于 host.

### 核心概念: 一个工具长什么样

看 [`hello-tool.js`](hello-tool.js). 一个工具 = 5 个字段:

| 字段 | 作用 |
|---|---|
| `name` | 工具名, agent 看到的 |
| `description` | 用途说明, 模型据此决定何时调用 |
| `parameters` | 输入参数的 JSON Schema |
| `output` | 输出契约(`schema` 描述类型, `render` 决定模型看到什么) |
| `execute` | 真正执行的函数: 输入 `args`, 返回 JSON 兼容值 |

## 怎么跑

### 路径 A: 动态插件(快速体验, 进程内临时)

动态插件 = 在**不写文件、不装包**的情况下, 让 agent 把一段插件代码登记进当前运行中的 DSH 进程, 当场生效.

**前置: 开一个 `cordis`(创造模式)会话**

`cordis_define` / `cordis_run` 这组"自引用"工具只在 `cordis` preset 里. 这个 preset = `standard` + 该工具集, 在 UI 里的名字叫"创造模式"(id 为 `cordis`). 在 `dsh web` 新建会话时选它即可.

**第 1 步: 把代码交给 agent**

在会话里对 agent 说, 并把 [`hello-tool.js`](hello-tool.js) 里 `return { ... }` 的内容粘进去:

> 创建一个动态插件, 注册一个 hello 工具. host 半代码用下面的内容:
> ```js
> return { apply(ctx) { harness.registerTool(ctx, harness.defineTool({ ... })) } }
> ```

**第 2 步: agent 执行 define → run**

agent 会自动加载 `cordis-plugin-development` skill, 然后:

1. `cordis_define` —— 登记这个包(名字 + 用途 + host 半代码), **此时不运行任何东西**, 返回一个 `dyn-<n>` 标识; 会话里会出现一张"定义卡片", 带启动控件.
2. `cordis_run` —— 真正求值 host 半, 把 `hello` 工具注册进 tools 注册表; 从下一个模型步起, agent 就能调用它.

> 说明: 你不用手敲 `cordis_define` 的参数, 这是 agent 的工具. 它的确切 schema 由 agent 经 `cordis_inspect_list` 现查, 并由 skill 保证用法正确. 另外 hello 只需要 host 半; client 半是给"要往浏览器里放 UI"的插件用的, 这里留空.

**第 3 步: 观察 Run 卡**

`cordis_run` 返回 `awaiting-approval` 或 `starting` 后, 这一步是异步的, 等系统报告最终结果(卡片会显示运行状态)即可, 不用催.

**第 4 步: 验证**

对 agent 说"跟我打个招呼". 若成功, 你会看到它调用 `hello({name: ...})` 并返回 `hello, ...!`.

**收尾: stop / undefine**

- `cordis_stop` —— 停用(dispose host 半, 撤回 client 半), 但保留定义, 可再次 run.
- `cordis_undefine` —— 永久删除.

> 两条重要边界:
> 1. **动态包只存在当前 DSH 进程内存里**: 不写文件、不改 `cordis.yml`、不跨重启存续, `stop`/`undefine`/重启后即消失. 想留下成果, 走路径 B 或正式开发流程.
> 2. **信任立场 = shell 访问**: cordis 工具集能改运行中的 runtime, 使用时要像授予 bash 一样慎重.

### 路径 B: 树外包(正式交付)

```bash
dsh plugin --profile web add <你的插件包名>
```

然后在组合文件里加一行插件行(见 demo/03 的"能力=插件行"). 这是"创建一个真正的 plugin"的简历级方式.

## 观察什么

1. 注册成功后, `hello` 工具出现在 agent 的工具目录里.
2. 你问"打个招呼", agent 会 `hello({name: ...})` 并返回 `hello, ...!`.
3. 对比 demo/01 的裸 Python 工具: 这里工具不再是脚本里的函数, 而是 DSH 组合里的一行能力.

## 与最终目标什么关系

- 项目的机器人能力就是这个模式的落地: `src/capabilities/repo` 里的每个能力(grasp/suction/camera_detect)都注册一个工具(`manipulate`/`detect_ball`), 由能力挂载服务在运行时挂到臂/感知作用域上.
- 而"热插拔" = 运行时**挂载/卸载**这些工具实例(见 demo/05 的时空组合性).
