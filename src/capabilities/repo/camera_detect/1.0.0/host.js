// camera_detect 能力 v1.0.0 - 视觉检测(仿真视觉, sensor 类, 挂感知槽).
//
// 场景扩展(视觉感知热插拔)的感知能力: 单一版本, 挂上即让夹爪执行链变精准.
// 三件事(单一职责 = 感知数据 + 数据馈送):
//   1. 感知数据源: 闭包 locate 读 /joint_state 回传的 ball 字段(仿真视觉, 如实标注;
//      cordis 服务是 root 级唯一, 多会话并存同名服务会冲突, 故不提供跨层服务);
//   2. agent 显式感知入口: detect_ball 工具({ok, ball} 文本), 工具表增删展示点;
//   3. 数据注入拦截器: manipulate_execute 上原地注入 req.target 并 next(); fail-open
//      (感知数据不可用时放行盲抓 + 告警, 不否决、不抛错); 只用闭包 ctx(回调 this 是载体).
// 零依赖: 不 import 任何包, 只用注入的服务与手写 Tool 契约.
export const name = 'capability-camera-detect'
export const inject = ['tools', 'capabilityMount']

export function apply(ctx, config = {}) {
  // 经挂载服务常驻 bridge 调用 SDK.
  async function runCli(method, args) {
    const parsed = await ctx.capabilityMount.bridge(method, args)
    return { ok: parsed.ok === true, error: parsed.error || '', parsed }
  }

  // 感知数据源(仿真视觉 = 读回传 ball 字段; 升级路径 = MuJoCo 渲染相机 + 真实检测).
  async function locate() {
    const caps = await runCli('query_capabilities', [])
    if (!caps.ok) return null
    const ball = caps.parsed && caps.parsed.caps && caps.parsed.caps.ball
    return Array.isArray(ball) && ball.length === 2 ? ball : null
  }

  // agent 显式感知入口(与精准抓互不依赖: 精准抓由执行链达成, 本工具只回答位置).
  const unregisterDetect = ctx.tools.register({
    name: 'detect_ball',
    description: '显式感知: 返回小球当前 XY 位置(仿真视觉, 读状态回传的 ball 字段).',
    parameters: { type: 'object', properties: {}, required: [] },
    output: {
      schema: { type: 'string' },
      render(_args, value) { return [{ type: 'text', text: value }] },
    },
    async execute() {
      const pos = await locate()
      if (pos === null) return JSON.stringify({ ok: false, error: '感知不到状态(状态回传不可用)' })
      return JSON.stringify({ ok: true, ball: pos })
    },
  })

  // 数据注入拦截器(本场景核心): 只注入感知数据, 不含编排; fail-open.
  const offIntercept = ctx.on('manipulate_execute', async (req, next) => {
    try {
      const pos = await locate()
      if (pos) req.target = pos
    } catch (e) {
      console.warn('[camera-detect] 视觉数据不可用, 放行为盲抓: %s', e && e.message)
    }
    return next()
  })

  // 视觉传感器画面显示与挂载联动(热插拔可观察): 挂载时让 sim 显示相机盒, 卸载隐藏.
  // fire-and-forget: 失败只告警, 不阻塞能力激活.
  function setVisionVisible(on) {
    ctx.capabilityMount.bridge('set_vision_visual', [on ? 'on' : 'off']).then(
      (r) => {
        if (r && r.ok !== true) console.warn('[camera-detect] 视觉传感器显示失败: %s', (r.error || JSON.stringify(r)))
      },
      (e) => console.warn('[camera-detect] 视觉传感器显示失败: %s', e && e.message))
  }
  setVisionVisible(true)

  console.log('[capability-camera-detect] 感知能力已挂载(视觉数据注入执行链)')

  return () => {
    setVisionVisible(false)
    unregisterDetect()
    offIntercept()
  }
}
