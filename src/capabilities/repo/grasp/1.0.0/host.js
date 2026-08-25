// grasp 能力 v1.0.0 - 夹爪末端: 夹取策略实例(架构 §7/§10.3).
//
// 挂载到某条臂作用域后, 注册同名 manipulate 工具(与吸盘实例同名, 靠臂作用域隔离).
// execute 实现夹取策略: 感知物理末端匹配 -> 执行策略步 -> 状态校验; **绝不改变装配**
// (装配末端是面板/人的职责).
// 零依赖: 不 import 任何包, 只用注入的服务与手写 Tool 契约.
export const name = 'capability-grasp'
export const inject = ['tools', 'capabilityMount']

export function apply(ctx, config = {}) {
  // config 由挂载体系注入: arm = 本实例所属机械臂(workdir/python 由挂载服务 daemon 持有, 本实例不直接使用).
  const arm = config.arm ?? 'A'

  // 经挂载服务常驻 bridge(P2-10)调用 SDK: 复用一条 rosbridge 连接, 不再 spawn python 子进程.
  async function runCli(method, args) {
    const parsed = await ctx.capabilityMount.bridge(method, args)
    return { ok: parsed.ok === true, error: parsed.error || '', parsed }
  }

  // 读 sim_bridge 状态回传, 返回 {ok, tools, ball} 或错误.
  async function perceive() {
    const caps = await runCli('query_capabilities', [])
    if (!caps.ok) return { ok: false, error: caps.error }
    const c = caps.parsed && caps.parsed.caps
    return { ok: true, tools: (c && c.tools) || {}, ball: (c && c.ball) || null }
  }

  // 同名实例: 每条臂一个 manipulate, 臂作用域隔离(设计 §7.2).
  const unregister = ctx.tools.register({
    name: 'manipulate',
    description: '该臂当前末端的操控实例(策略在内部: 感知匹配 -> 执行 -> 校验).',
    parameters: { type: 'object', properties: {}, required: [] },
    output: {
      schema: { type: 'string' },
      render(_args, value) { return [{ type: 'text', text: value }] },
    },
    async execute() {
      // 夹取策略第 1 步: 感知物理末端, 必须已是夹爪(装配是面板/人的职责, 实例不改变装配).
      const seen = await perceive()
      if (!seen.ok) return '臂 ' + arm + ' 夹取失败: 感知不到状态(' + seen.error + ')'
      if (seen.tools[arm] !== 'grasp') {
        return '臂 ' + arm + ' 当前末端是 "' + (seen.tools[arm] || 'none') + '", 不是夹爪, 无法夹取(请先在面板给该臂挂夹爪)'
      }
      // 夹取策略第 2 步: 执行(接近 + 夹取, 由 sim_bridge 完成 IK 与触球).
      const touch = await runCli('touch', [arm])
      if (!touch.ok) return '臂 ' + arm + ' 夹取失败: ' + touch.error
      // 夹取策略第 3 步: 状态校验(回传确认末端仍为夹爪).
      const after = await perceive()
      if (!after.ok) return '臂 ' + arm + ' 夹取完成, 但状态校验不可用(' + after.error + ')'
      return '臂 ' + arm + ' 夹取完成: 末端 ' + after.tools[arm] + ', 小球位置 ' + JSON.stringify(after.ball) + ' (touch ok)'
    },
  })

  console.log('[capability-grasp] 臂 %s 挂载夹取策略实例(manipulate)', arm)

  return () => {
    unregister()
  }
}
