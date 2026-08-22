// capability-suction host 入口 - 树外包能力包(阶段 2, 本地发布).
//
// 注册一个 suction(吸盘)工具: 把指定臂末端执行器切到吸盘, 并让该臂去触碰小球.
// 执行链: 工具 execute -> shell 调 bridge_client.py CLI(薄 SDK) -> rosbridge -> sim_bridge.
// 与 grasp 包同构, 见 src/capabilities/capability-spec.md; 挂载前先过 mount_guard 哈希校验.
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'capability-suction'
export const inject = ['tools', 'shell']

export function apply(ctx, config = {}) {
  // 配置来自组合行(config 由安装方按环境填写).
  const workdir = config.workdir ?? '.'
  const python = config.python ?? 'python3'
  const BRIDGE = 'src/bridge/bridge_client.py'

  // 跑一条 SDK CLI 命令, 解析 JSON 输出. 返回 {ok, error, text}.
  async function runCli(method, args) {
    const cmd = [python, BRIDGE, method, ...args].join(' ')
    const spec = ctx.shell.resolve({ command: cmd, workdir, timeoutMs: 15000 })
    try {
      const res = await ctx.shell.run(spec)
      const text = ((res.stdout && res.stdout.text) || '').trim()
      try {
        const parsed = JSON.parse(text)
        return { ok: parsed.ok === true, error: parsed.error || '', text }
      } catch (e) {
        return { ok: false, error: 'SDK 输出不是 JSON: ' + text, text }
      }
    } catch (e) {
      return { ok: false, error: 'shell 调用失败: ' + e, text: '' }
    }
  }

  // 注册能力工具. disposer 随插件 dispose 精确回收(卸载 = 工具消失).
  const unregister = ctx.tools.register(defineTool({
    name: 'suction',
    description: '把机械臂末端执行器切换到"吸盘", 并让该臂去触碰小球. 参数 arm 选 A 或 B(默认 A); 若该臂够不到小球, sim_bridge 会拒绝并说明原因.',
    parameters: {
      arm: {
        type: 'string',
        enum: ['A', 'B'],
        description: '要操作的机械臂, A 或 B.',
        default: 'A',
      },
    },
    output: {
      schema: { type: 'string' },
      render(_args, value) { return [{ type: 'text', text: value }] },
    },
    async execute(args) {
      const arm = (args && args.arm) || 'A'
      const tool = await runCli('set_tool', [arm, 'suction'])
      if (!tool.ok) return 'suction 失败: ' + tool.error
      const touch = await runCli('touch', [arm])
      if (!touch.ok) return 'suction 失败: ' + touch.error
      return '臂 ' + arm + ' 已切换吸盘并去触碰小球 (set_tool ok, touch ok)'
    },
  }))

  // 启动日志: 供 headless/boot 日志验证"工具已注册"(不依赖模型).
  console.log('[capability-suction] suction 工具已注册 (workdir=%s, python=%s)', workdir, python)

  return () => {
    unregister()
  }
}
