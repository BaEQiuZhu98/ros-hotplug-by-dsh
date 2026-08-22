// robo-observer - preset 自带观测插件(阶段 2.2, 设计 §7.4 的观测/运维能力).
//
// 两件事:
//   1. 订阅 tools/change 事件: 能力挂载/卸载(工具注册/注销)时打印当前末端能力集,
//      这是可靠性点 5(事件通知)的可观测实现. 事件本身无载荷, 所以要查工具表.
//   2. 注册 capability_status 工具: agent 用它主动感知当前末端状态
//      (经桥接 SDK 读 sim_bridge 的 /joint_state 回传).
//
// 为什么用 preset 内文件而不是独立能力包: 观测是 preset 的组成部分(preset 自带
// 文件随目录走, 相对路径由组合树从 preset 目录解析), 不属于可独立热插拔的能力.
// 本文件零依赖: 不 import 任何包, 只用注入的服务(tools/shell)与手写 ToolDefinition.
export const name = 'robo-observer'
export const inject = ['tools', 'shell']

// 能力工具名列表: 与能力包注册的工具名保持一致(grasp/suction/detect ...).
const CAPABILITIES = ['grasp', 'suction']

export function apply(ctx, config = {}) {
  const workdir = config.workdir ?? '.'
  const python = config.python ?? 'python3'

  // 打印当前"末端能力"视图: 工具表里出现了哪些能力工具.
  function logCapabilities(reason) {
    const names = ctx.tools.schemas().map((t) => t.name)
    const visible = names.filter((n) => CAPABILITIES.includes(n))
    console.log('[robo-observer] %s: 当前末端能力 = %s', reason, visible.length ? visible.join(', ') : '(无)')
  }

  // 可靠性点 5: 能力增删事件广播 -> 监听器收到 -> 更新感知.
  const offChange = ctx.on('tools/change', () => logCapabilities('tools/change'))
  logCapabilities('启动')

  // capability_status 工具: agent 的"感知"入口(设计 §7.2 的感知手段之一).
  // 返回两部分: mounted(工具表里的能力工具, 末端能力的权威来源) + physical(SDK 回传的
  // 机器人物理末端状态, 是执行切换后的结果; 挂载初期可能还是 none, 调能力工具后才变).
  const unregisterStatus = ctx.tools.register({
    name: 'capability_status',
    description: '查询机器人当前能力集: mounted = 已挂载的末端能力工具(权威来源, 有 grasp = 夹爪已挂载, 有 suction = 吸盘已挂载); physical = 经桥接 SDK 读 sim_bridge 状态回传(两臂物理末端 tools/关节角 joints/小球 ball, 是执行切换后的结果). 判断是否有末端能力以 mounted 为准.',
    parameters: { type: 'object', properties: {}, required: [] },
    output: {
      schema: { type: 'string' },
      render(_args, value) { return [{ type: 'text', text: value }] },
    },
    async execute() {
      const mounted = ctx.tools.schemas().map((t) => t.name).filter((n) => CAPABILITIES.includes(n))
      const cmd = [python, 'src/bridge/bridge_client.py', 'query_capabilities'].join(' ')
      const spec = ctx.shell.resolve({ command: cmd, workdir, timeoutMs: 15000 })
      try {
        const res = await ctx.shell.run(spec)
        const text = ((res.stdout && res.stdout.text) || '').trim()
        return 'mounted: ' + JSON.stringify(mounted) + '; physical: ' + text
      } catch (e) {
        return 'mounted: ' + JSON.stringify(mounted) + '; 物理状态查询失败: ' + e
      }
    },
  })

  return () => {
    offChange()
    unregisterStatus()
  }
}
