// robo-arm-manager - 会话内臂管理器(设计 §7.1 的层 1/层 2).
//
// 职责:
//   1. 预建 armA/armB 两条臂作用域(createScope, 挂在 agent/preset 作用域之下);
//   2. 把臂上下文注册到能力挂载服务(registerArms), 挂载服务按臂名在对应上下文上
//      ctx.plugin / fiber.dispose 末端实例(同名 manipulate 靠臂作用域隔离);
//   3. 提供 agent 的两个工具:
//      arm_status(arm)  感知: 该臂是否具备可用末端(只回答 ready, 不泄露末端型号);
//      take_object(arm) 执行: 让该臂去拿东西(夹取/吸附策略在实例内部).
//
// 本包以 npm 包形态装入 profile 的 node_modules(依赖回退解析), preset 行用绝对路径引用;
// 它 import @deepseek-ai/dsh-scope 获取 createScope/scopeOf(经 profiles/node_modules 回退).
import { createScope, scopeOf } from '@deepseek-ai/dsh-scope'

export const name = 'robo-arm-manager'
export const inject = ['capabilityMount', 'tools', 'shell']

export function apply(ctx, config = {}) {
  const workdir = config.workdir ?? '.'
  const python = config.python ?? 'python3'

  // 两条臂作用域: 键对象即 scope 身份; parent 绑到本作用域(事件沿链上抛).
  const armKeys = { A: {}, B: {} }
  const armA = createScope(ctx, armKeys.A, { parent: scopeOf(ctx) })
  const armB = createScope(ctx, armKeys.B, { parent: scopeOf(ctx) })
  // 向挂载服务注册臂上下文: 实例的挂/卸由挂载服务在对应上下文上执行.
  ctx.capabilityMount.registerArms({ A: armA.ctx, B: armB.ctx })
  console.log('[robo-arm-manager] armA/armB 作用域已就绪')

  // 读 sim_bridge 状态回传.
  async function runCli(method, args) {
    const cmd = [python, 'src/bridge/bridge_client.py', method, ...args].join(' ')
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

  // 感知入口: 只回答该臂是否可用(ready), 不泄露末端型号.
  const unregisterStatus = ctx.tools.register({
    name: 'arm_status',
    description: '查询某条机械臂是否具备可用末端. 决策只依据返回的 ready; 末端型号(夹爪/吸盘)是实例内部细节, 不需要感知.',
    parameters: {
      type: 'object',
      properties: { arm: { type: 'string', enum: ['A', 'B'], description: '机械臂 A 或 B.' } },
      required: ['arm'],
    },
    output: {
      schema: { type: 'string' },
      render(_args, value) { return [{ type: 'text', text: value }] },
    },
    async execute(args) {
      const arm = String(args && args.arm)
      // 1) 实例存在性: 该臂作用域上是否有 manipulate 实例.
      const inst = ctx.tools.get('manipulate', armKeys[arm])
      if (inst === undefined) return JSON.stringify({ ready: false, reason: '该臂没有末端实例' })
      // 2) 物理末端与该臂挂载记录匹配.
      const list = ctx.capabilityMount.list()
      const rec = (list.mounted || []).find((m) => m.arm === arm)
      if (rec === undefined) return JSON.stringify({ ready: false, reason: '挂载记录缺失' })
      const seen = await runCli('query_capabilities', [])
      const tools = seen.ok && seen.parsed && seen.parsed.caps ? seen.parsed.caps.tools : undefined
      const physical = tools ? tools[arm] : undefined
      if (physical !== rec.cap) {
        return JSON.stringify({ ready: false, reason: '物理末端未装配或不匹配(' + (physical || 'none') + ' vs ' + rec.cap + ')' })
      }
      return JSON.stringify({ ready: true })
    },
  })

  // 执行入口: 分派到该臂当前末端实例(策略在实例内部).
  const unregisterTake = ctx.tools.register({
    name: 'take_object',
    description: '让某条机械臂去拿东西. 夹取/吸附策略由该臂当前末端实例内部决定; 无末端实例或物理不匹配会返回明确错误.',
    parameters: {
      type: 'object',
      properties: { arm: { type: 'string', enum: ['A', 'B'], description: '机械臂 A 或 B.' } },
      required: ['arm'],
    },
    output: {
      schema: { type: 'string' },
      render(_args, value) { return [{ type: 'text', text: value }] },
    },
    async execute(args) {
      const arm = String(args && args.arm)
      const inst = ctx.tools.get('manipulate', armKeys[arm])
      if (inst === undefined) return '臂 ' + arm + ' 没有末端实例, 无法拿东西(请先在面板给该臂挂末端)'
      return inst.execute({})
    },
  })

  return () => {
    unregisterStatus()
    unregisterTake()
    armA.dispose()
    armB.dispose()
  }
}
