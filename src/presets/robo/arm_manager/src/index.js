// robo-arm-manager - 会话内臂管理器(设计 §7.1 的层 1/层 2).
//
// 职责:
//   1. 按挂载服务的全局臂清单(默认 A/B)为**每个会话**预建臂作用域(createScope,
//      parent 绑到该会话 agent 作用域 —— 臂实例不上浮(父不视子), 臂事件沿链冒泡经 agent 层);
//   1.5 预建感知槽(标签复用 agent key 本身): sensor 类能力挂载点, detect_ball 对 agent 可见;
//   2. 把臂上下文与感知槽注册到能力挂载服务(registerArms/registerSlot), 挂载服务按 kind
//      路由在对应上下文上 ctx.plugin / fiber.dispose 能力实例(同名 manipulate 靠臂作用域隔离);
//   3. 提供 agent 的两个工具:
//      arm_status(arm)  感知: 该臂是否具备可用末端(只回答 ready, 不泄露末端型号);
//      take_object(arm) 执行: 让该臂去拿东西(夹取/吸附策略在实例内部).
//
// 臂上下文随会话生灭(事件驱动, T-S-11): 本插件实例在 preset 的 standing 组合层
// (各会话共享), 但每条臂的作用域与感知槽按 agent/created + agent/disposed 事件
// 逐会话建立与注销; 工具执行经 exec.agent 解析调用者会话的臂作用域.
// 本包以 npm 包形态装入 profile 的 node_modules(依赖回退解析), preset 行用绝对路径引用;
// 它 import @deepseek-ai/dsh-scope 获取 createScope(经 profiles/node_modules 回退).
import { createScope, scopeOf, scopeTarget } from '@deepseek-ai/dsh-scope'

export const name = 'robo-arm-manager'
export const inject = ['capabilityMount', 'tools']

export function apply(ctx) {

  // 臂清单唯一来源 = 挂载服务的全局臂清单 config.arms(审查 v3: 去 A/B 硬编码).
  // 臂管理器只做消费: 按清单预建作用域、注册工具 enum、上报臂上下文.
  // 作用域化事件织入助手(P1): 本包可解析 dsh-scope, 把实现注入挂载服务——能力实例
  // 经 capabilityMount.scopedWaterfall 零依赖发射, 事件只沿臂作用域祖先链路由.
  if (typeof ctx.capabilityMount.attachScopedWaterfall === 'function') {
    ctx.capabilityMount.attachScopedWaterfall((armCtx, name, args, next) =>
      ctx.waterfall(scopeTarget(ctx, scopeOf(armCtx)), name, ...args, next),
    )
  } else {
    console.warn('[robo-arm-manager] 挂载服务缺少 attachScopedWaterfall, 执行链织入不可用')
  }
  const armList = Array.isArray(ctx.capabilityMount.list().arms) ? ctx.capabilityMount.list().arms : []
  if (armList.length === 0) {
    console.error('[robo-arm-manager] 挂载服务臂清单为空, 跳过臂作用域与工具注册')
    return () => {}
  }

  // agent -> { keys, scopes, unregister, slotScope, slotUnregister }  每个会话一套臂作用域 + 感知槽.
  const sessionArms = new Map()

  function setupSession(agent) {
    if (agent === undefined || agent === null || sessionArms.has(agent)) return
    // 感知槽(场景扩展): 标签复用 agent key 本身(createScope 不带 parent, agent key 已由工厂绑定)——
    // sensor 实例落在 agent 层: detect_ball 对 agent 可见, 拦截器沿父链命中臂事件.
    const slotScope = createScope(ctx, agent)
    const slotUnregister = ctx.capabilityMount.registerSlot('perception', slotScope.ctx)
    // 每条臂一个作用域: 键对象即 scope 身份; parent 绑到会话 agent 作用域
    // (臂事件沿链冒泡经 agent 层, 感知槽拦截器可命中; 臂内实例仍不上浮 —— 父不视子).
    const keys = Object.fromEntries(armList.map((arm) => [arm, {}]))
    const scopes = armList.map((arm) =>
      createScope(ctx, keys[arm], { parent: agent }),
    )
    const armsBySession = Object.fromEntries(armList.map((arm, i) => [arm, scopes[i].ctx]))
    const unregister = ctx.capabilityMount.registerArms(armsBySession)
    // 懒补建路径: 挂载服务会为新上下文异步补挂当前能力, 工具执行前须等补挂落位.
    const pending = Promise.all([
      unregister && unregister.pending ? unregister.pending : Promise.resolve(),
      slotUnregister && slotUnregister.pending ? slotUnregister.pending : Promise.resolve(),
    ])
    sessionArms.set(agent, { keys, scopes, unregister, slotScope, slotUnregister, pending })
    console.log('[robo-arm-manager] 臂作用域已就绪: %s', armList.join(', '))
  }

  function teardownSession(agent) {
    const entry = sessionArms.get(agent)
    if (entry === undefined) return
    sessionArms.delete(agent)
    try { entry.unregister() } catch (e) { console.warn('[robo-arm-manager] 注销臂上下文失败: %s', e && e.message) }
    try { entry.slotUnregister() } catch (e) { console.warn('[robo-arm-manager] 注销感知槽失败: %s', e && e.message) }
    for (const scope of entry.scopes) {
      try { scope.dispose() } catch (e) { console.warn('[robo-arm-manager] 销毁臂作用域失败: %s', e && e.message) }
    }
    try { entry.slotScope.dispose() } catch (e) { console.warn('[robo-arm-manager] 销毁感知槽失败: %s', e && e.message) }
  }

  // 会话生灭事件: standing 层监听器沿作用域链收到其下所有 agent 的事件.
  const offCreated = ctx.on('agent/created', (payload) => {
    setupSession(payload && payload.agent)
  })
  const offDisposed = ctx.on('agent/disposed', (payload) => {
    teardownSession(payload && payload.agent)
  })
  // standing 激活晚于某些会话创建时的兜底: 为已存在的活 agent 补建臂上下文.
  const agentsSvc = ctx.get('agents')
  if (agentsSvc !== undefined && typeof agentsSvc.list === 'function') {
    for (const agent of agentsSvc.list()) setupSession(agent)
  }

  // 工具执行时按调用者 agent 解析该会话的臂作用域(工具本体经 exec.agent 拿身份).
  // 懒补建兜底: 新建/恢复的会话可能错过 agent/created 与启动时的 list() 兜底
  // (如 web 新建会话的 announce 早于 preset standing 挂链), 首次工具执行时按
  // exec.agent 就地补建臂上下文与感知槽, 保证本会话臂能力始终可解析.
  function sessionEntryOf(exec) {
    const agent = exec && exec.agent
    if (agent !== undefined && agent !== null && !sessionArms.has(agent)) {
      try {
        setupSession(agent)
      } catch (e) {
        console.warn('[robo-arm-manager] 懒补建臂上下文失败: %s', e && e.message)
      }
    }
    return sessionArms.get(agent)
  }

  // 经挂载服务常驻 bridge 调用 SDK(与能力实例同通道, 不再 spawn python; 审查 v1 N3).
  async function runCli(method, args) {
    const parsed = await ctx.capabilityMount.bridge(method, args)
    return { ok: parsed.ok === true, error: parsed.error || '', parsed }
  }

  // 感知入口: 只回答该臂是否可用(ready), 不泄露末端型号.
  const unregisterStatus = ctx.tools.register({
    name: 'arm_status',
    description: '查询某条机械臂是否具备可用末端. 决策只依据返回的 ready; 末端型号(夹爪/吸盘)是实例内部细节, 不需要感知.',
    parameters: {
      type: 'object',
      properties: { arm: { type: 'string', enum: armList, description: '机械臂 ' + armList.join(' 或 ') + '.' } },
      required: ['arm'],
    },
    output: {
      schema: { type: 'string' },
      render(_args, value) { return [{ type: 'text', text: value }] },
    },
    async execute(args, exec) {
      const entry = sessionEntryOf(exec)
      if (entry === undefined) return JSON.stringify({ ready: false, reason: '没有本会话的臂上下文' })
      if (entry.pending !== undefined) await entry.pending
      const arm = String(args && args.arm)
      // 1) 实例存在性: 该会话该臂作用域上是否有 manipulate 实例.
      const inst = ctx.tools.get('manipulate', entry.keys[arm])
      if (inst === undefined) return JSON.stringify({ ready: false, reason: '该臂没有末端实例' })
      // 2) 物理末端与该臂挂载记录匹配.
      const list = ctx.capabilityMount.list()
      const rec = (list.mounted || []).find((m) => m.arm === arm)
      if (rec === undefined) return JSON.stringify({ ready: false, reason: '挂载记录缺失' })
      const seen = await runCli('query_capabilities', [])
      if (!seen.ok) return JSON.stringify({ ready: false, reason: '状态回传不可用(' + seen.error + '), 请检查机器人侧' })
      const tools = seen.parsed && seen.parsed.caps ? seen.parsed.caps.tools : undefined
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
      properties: { arm: { type: 'string', enum: armList, description: '机械臂 ' + armList.join(' 或 ') + '.' } },
      required: ['arm'],
    },
    output: {
      schema: { type: 'string' },
      render(_args, value) { return [{ type: 'text', text: value }] },
    },
    async execute(args, exec) {
      const entry = sessionEntryOf(exec)
      if (entry === undefined) return '没有本会话的臂上下文, 无法拿东西'
      if (entry.pending !== undefined) await entry.pending
      const arm = String(args && args.arm)
      const inst = ctx.tools.get('manipulate', entry.keys[arm])
      if (inst === undefined) return '臂 ' + arm + ' 没有末端实例, 无法拿东西(请先在面板给该臂挂末端)'
      return inst.execute({})
    },
  })

  return () => {
    offCreated()
    offDisposed()
    unregisterStatus()
    unregisterTake()
    for (const agent of [...sessionArms.keys()]) teardownSession(agent)
  }
}
