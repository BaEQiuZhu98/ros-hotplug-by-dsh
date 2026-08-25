// grasp 能力 v1.2.0 - 夹爪末端: 夹取策略实例 + waterfall 执行链扩展点(场景扩展).
//
// 与 1.0.0 的差异(1.0.0/1.1.0 保持原样不动, 哈希不可变锚点):
//   1. execute 经 capabilityMount.scopedWaterfall 发出 manipulate_execute 事件,
//      req = {arm, target} 可在链上被增强器(如视觉能力)原地注入目标位置;
//   2. 执行步改为 move_to(收敛完成式): target 有值 = 精准移向目标, 无值 = 盲抓预设点
//      PRESET_POINT(与球初始位置可区分, 盲抓大概率未命中);
//   3. 状态校验升级为命中判定: move_to 返回末端位置 ee 与球位置 ball(workspace 系),
//      距离 < 0.05m 判「命中」, 否则「未命中」(sim 算、实例只判).
// 挂载到某条臂作用域后, 注册同名 manipulate 工具(与吸盘实例同名, 靠臂作用域隔离).
// 零依赖: 不 import 任何包, 作用域化事件发射经挂载服务助手完成.
export const name = 'capability-grasp'
export const inject = ['tools', 'capabilityMount']

// 盲抓预设点(workspace 系): 与球初始位置 (0.5, 0) 可区分; 视觉拦截器注入 target 后走精准分支.
const PRESET_POINT = [0.3, -0.3]
const HIT_RADIUS = 0.05

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

  // 链终端(盲抓处理器): 编排决策在本实例内部——优先用 req.target, 否则盲抓预设位置;
  // 实例只知道"目标位置"这个通用参数, 不知道它来自视觉还是人工指定.
  async function executeWith(req) {
    // 策略第 1 步: 感知物理末端匹配(必须已是夹爪, 实例绝不改变装配).
    const seen = await perceive()
    if (!seen.ok) return '臂 ' + arm + ' 夹取失败: 感知不到状态(' + seen.error + ')'
    if (seen.tools[arm] !== 'grasp') {
      return '臂 ' + arm + ' 当前末端是 "' + (seen.tools[arm] || 'none') + '", 不是夹爪, 无法夹取(请先在面板给该臂挂夹爪)'
    }
    // 策略第 2 步: 执行(收敛完成式移动: 精准目标 或 盲抓预设点).
    const target = Array.isArray(req.target) && req.target.length === 2 ? req.target : PRESET_POINT
    const mv = await runCli('move_to', [arm, target[0], target[1]])
    if (!mv.ok) return '臂 ' + arm + ' 夹取失败: ' + mv.error
    // 策略第 3 步: 命中判定(末端位置 vs 球位置, workspace 系; 距离阈值 0.05m).
    const ee = mv.parsed && mv.parsed.ee
    const ball = mv.parsed && mv.parsed.ball
    if (!Array.isArray(ee) || !Array.isArray(ball)) {
      return '臂 ' + arm + ' 夹取完成, 但命中校验数据不可用(' + JSON.stringify(mv.parsed) + ')'
    }
    const dist = Math.hypot(ee[0] - ball[0], ee[1] - ball[1])
    if (dist < HIT_RADIUS) {
      return '命中: 末端 [' + ee.map((v) => +v.toFixed(3)) + '], 球 [' + ball.map((v) => +v.toFixed(3)) + ']'
    }
    return '未命中: 末端在 [' + ee.map((v) => +v.toFixed(3)) + '], 球在 [' + ball.map((v) => +v.toFixed(3)) + '], 距离 ' + dist.toFixed(3)
  }

  // 同名实例: 每条臂一个 manipulate, 臂作用域隔离(设计 §7.2).
  const unregister = ctx.tools.register({
    name: 'manipulate',
    description: '该臂当前末端的操控实例(策略在内部: 感知匹配 -> 执行 -> 命中校验).',
    parameters: { type: 'object', properties: {}, required: [] },
    output: {
      schema: { type: 'string' },
      render(_args, value) { return [{ type: 'text', text: value }] },
    },
    async execute() {
      // waterfall 扩展点(场景扩展): 请求对象在链上可被增强器原地修改 target;
      // 作用域化发射经挂载服务助手(只沿本臂作用域祖先链路由, 多会话隔离).
      const req = { arm: arm, target: null }
      return ctx.capabilityMount.scopedWaterfall(ctx, 'manipulate_execute', [req], () => executeWith(req))
    },
  })

  console.log('[capability-grasp] 臂 %s 挂载夹取策略实例(manipulate)', arm)

  return () => {
    unregister()
  }
}
