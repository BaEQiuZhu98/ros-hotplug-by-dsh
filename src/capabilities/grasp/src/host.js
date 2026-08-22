// capability-grasp host 入口 - 树外包能力包(阶段 1, 本地发布).
//
// 注册一个 grasp(夹爪)工具: 把指定臂末端执行器切到夹爪, 并让该臂去触碰小球.
// 执行链: 工具 execute -> shell 调 bridge_client.py CLI(薄 SDK) -> rosbridge -> sim_bridge.
//
// 本文件是 ESM Cordis Plugin, 由组合树的 cordis.patch.yml 行(name = 包名)加载.
// 规范见 src/capabilities/capability-spec.md; 挂载前必须先过 mount_guard 哈希校验.
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'capability-grasp'
export const inject = ['tools', 'shell']

export function apply(ctx, config = {}) {
  // 配置来自 cordis.patch.yml 行的 config(安装方指定仓库根与 venv python).
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
    name: 'grasp',
    description: '把机械臂末端执行器切换到"夹爪", 并让该臂去触碰小球. 参数 arm 选 A 或 B(默认 A); 若该臂够不到小球, sim_bridge 会拒绝并说明原因.',
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
      const tool = await runCli('set_tool', [arm, 'grasp'])
      if (!tool.ok) return 'grasp 失败: ' + tool.error
      const touch = await runCli('touch', [arm])
      if (!touch.ok) return 'grasp 失败: ' + touch.error
      return '臂 ' + arm + ' 已切换夹爪并去触碰小球 (set_tool ok, touch ok) [v2]'
    },
  }))

  // 启动日志: 供 headless/boot 日志验证"工具已注册"(不依赖模型).
  console.log('[capability-grasp] grasp 工具已注册 (workdir=%s, python=%s)', workdir, python)

  return () => {
    unregister()
  }
}
