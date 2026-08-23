// grasp 能力 v1.0.0 - 能力仓库目录形态(架构 v2), 由挂载服务动态加载.
//
// 零依赖: 不 import 任何包(仓库目录不在 node_modules 解析链上, 且自包含利于分发),
// 只用注入的服务(tools/shell)与手写 Tool 契约.
// 规范见 src/capabilities/capability-spec.md; 挂载前挂载服务会对本文件做 sha256 校验.
export const name = 'capability-grasp'
export const inject = ['tools', 'shell']

export function apply(ctx, config = {}) {
  // config 由挂载服务注入: 仓库根(找 bridge_client.py)与 venv python(有 roslibpy).
  const workdir = config.workdir ?? '.'
  const python = config.python ?? 'python3'
  const BRIDGE = 'src/bridge/bridge_client.py'

  // 跑一条 SDK CLI 命令, 解析 JSON 输出. 返回 {ok, error, parsed}.
  async function runCli(method, args) {
    const cmd = [python, BRIDGE, method, ...args].join(' ')
    const spec = ctx.shell.resolve({ command: cmd, workdir, timeoutMs: 15000 })
    try {
      const res = await ctx.shell.run(spec)
      const text = ((res.stdout && res.stdout.text) || '').trim()
      try {
        const parsed = JSON.parse(text)
        return { ok: parsed.ok === true, error: parsed.error || '', parsed }
      } catch (e) {
        return { ok: false, error: 'SDK 输出不是 JSON: ' + text }
      }
    } catch (e) {
      return { ok: false, error: 'shell 调用失败: ' + e }
    }
  }

  // 注册能力工具. 返回的 disposer 随插件 dispose 精确回收(卸载 = 工具消失).
  const unregister = ctx.tools.register({
    name: 'grasp',
    description: '让已挂夹爪的臂去触碰小球. 执行前先感知该臂物理末端(经 SDK 读 sim_bridge 状态回传), 不是夹爪则报错、不做任何装配(装配末端是面板/人的职责). 参数 arm 选 A 或 B(默认 A).',
    parameters: {
      type: 'object',
      properties: {
        arm: { type: 'string', enum: ['A', 'B'], description: '要操作的机械臂, A 或 B.' },
      },
      required: [],
    },
    output: {
      schema: { type: 'string' },
      render(_args, value) { return [{ type: 'text', text: value }] },
    },
    async execute(args) {
      const arm = (args && args.arm) || 'A'
      // 先感知物理末端: 经 SDK 读 sim_bridge 的 /joint_state 回传(含 tools: {A, B}).
      // 装配末端是面板(人)的职责, 工具绝不改变装配, 只做"匹配 -> 执行".
      const caps = await runCli('query_capabilities', [])
      if (!caps.ok) return '感知失败: ' + caps.error
      const tools = caps.parsed && caps.parsed.caps && caps.parsed.caps.tools
      const cur = tools ? tools[arm] : undefined
      if (cur !== 'grasp') {
        return '臂 ' + arm + ' 当前末端是 "' + (cur || 'none') + '", 不是夹爪, 无法抓取(请先在面板给该臂挂夹爪)'
      }
      const touch = await runCli('touch', [arm])
      if (!touch.ok) return 'grasp 失败: ' + touch.error
      return '臂 ' + arm + ' 夹爪已去触碰小球 (touch ok)'
    },
  })

  console.log('[capability-grasp] grasp 工具已注册')

  return () => {
    unregister()
  }
}
