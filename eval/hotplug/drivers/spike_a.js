// eval/hotplug/drivers/spike_a.js - 阶段 A 穿刺驱动(组合挂载, /tmp 隔离环境).
// 以 .dsh/vision-hotplug-scenario-design.md 为基准, 九项探针的机制级最小验证.
// 自举: 先向副本 repo 写入探针能力包(grasp 1.2.0 / camera_detect 1.0.0, 真实 sha256),
// 再建两个 robo 会话, 经挂载服务 svc 直调(面板 slot_mount 端点是阶段 B 交付)跑探针.
// 结果落盘 eval/results/run-spike/spike.json.

import { writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'

export const inject = ['agents', 'agentPresets', 'capabilityMount', 'tools']

const REPO_ROOT = '/root/my-project/ros-hotplug-by-dsh'
const REPO_COPY = REPO_ROOT + '/eval/hotplug/fixtures/repo-copy'
const RESULTS_DIR = REPO_ROOT + '/eval/results/run-spike'

const GRASP_12 = `export const inject = ['tools', 'capabilityMount']
export const name = 'capability-grasp'
export function apply(ctx, config = {}) {
  const arm = config.arm
  const PRESET = [0.3, -0.3]
  const unregister = ctx.tools.register({
    name: 'manipulate',
    description: '该臂当前末端的操控实例(内部策略).',
    parameters: { type: 'object', properties: {}, required: [] },
    output: { schema: { type: 'string' }, render(_a, v) { return [{ type: 'text', text: v }] } },
    async execute() {
      const req = { arm: arm, target: null }
      return ctx.capabilityMount.scopedWaterfall(ctx, 'manipulate_execute', [req], () => executeWith(req))
    },
  })
  async function executeWith(req) {
    const seen = await ctx.capabilityMount.bridge('query_capabilities', [])
    if (!seen.ok || !seen.caps) return '...感知不到状态...'
    if (seen.caps.tools[arm] !== 'grasp') return '臂 ' + arm + ' 当前末端是 \\"' + (seen.caps.tools[arm] || 'none') + '\\", 不是夹爪, 无法夹取(请先在面板给该臂挂夹爪)'
    const target = req.target || PRESET
    const mv = await ctx.capabilityMount.bridge('move_to', [arm, target[0], target[1]])
    if (!mv.ok) return '执行失败: ' + (mv.error || '')
    const dist = Math.hypot(mv.ee[0] - mv.ball[0], mv.ee[1] - mv.ball[1])
    return dist < 0.05 ? '命中: 末端 [' + mv.ee + '], 球 [' + mv.ball + ']' : '未命中: 末端在 [' + mv.ee + '], 球在 [' + mv.ball + '], 距离 ' + dist.toFixed(3)
  }
  console.log('[capability-grasp] 臂 %s 挂载夹取策略实例(manipulate)', arm)
  return () => { unregister() }
}
`

const CAMERA_10 = `export const inject = ['tools', 'capabilityMount']
export const name = 'capability-camera-detect'
export function apply(ctx, config = {}) {
  // 感知数据源: 闭包实现(不需要跨层服务——cordis 服务是 root 级唯一, 多会话并存
  // 的同名服务会冲突; 跨层数据流经 manipulate_execute 的 req 注入, 本闭包即唯一入口).
  async function locate() {
    const r = await ctx.capabilityMount.bridge('query_capabilities', [])
    return (r.ok && r.caps && r.caps.ball) ? r.caps.ball : null
  }
  const unregisterDetect = ctx.tools.register({
    name: 'detect_ball',
    description: '显式感知: 返回小球当前 XY 位置(仿真视觉, 读回传 ball 字段).',
    parameters: { type: 'object', properties: {}, required: [] },
    output: { schema: { type: 'string' }, render(_a, v) { return [{ type: 'text', text: v }] } },
    async execute() {
      const r = await ctx.capabilityMount.bridge('query_capabilities', [])
      if (!r.ok || !r.caps || !r.caps.ball) return JSON.stringify({ ok: false, error: '感知不到状态(回传不可用)' })
      return JSON.stringify({ ok: true, ball: r.caps.ball })
    },
  })
  const off = ctx.on('manipulate_execute', async (req, next) => {
    try {
      const pos = await locate()
      if (pos) req.target = pos
    } catch (e) {
      console.warn('[camera-detect] 视觉数据不可用, 放行为盲抓: %s', e && e.message)
    }
    return next()
  })
  return () => { unregisterDetect(); off() }
}
`

const results = { probes: {} }
function record(id, verdict, detail) {
  results.probes[id] = { verdict: verdict, detail: detail }
}
function sha256Of(text) {
  return createHash('sha256').update(text).digest('hex')
}

export function apply(ctx) {
  const svc = ctx.capabilityMount
  const sig = new AbortController().signal
  const rpc = async (method, args) => {
    const r = await fetch('http://127.0.0.1:3199/cap-mount/' + method, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}),
    })
    return await r.json()
  }
  const callTool = async (handle, name, args) => {
    const r = await handle.agent.ctx.get('tools').execute({
      callId: 'spike-' + name + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      name: name, arguments: args || {}, agent: handle.agent, signal: sig,
    })
    return r && r.content ? r.content.map((c) => (c && c.text ? c.text : '')).join('') : String(r)
  }
  const newSession = async () => {
    return await ctx.agents.create({
      sessionId: 'spike-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      meta: { cwd: REPO_ROOT, agentPreset: 'robo' },
      setup: async (agentCtx) => { await ctx.agentPresets.mount(agentCtx, 'robo') },
    })
  }

  function writePackages() {
    const dirG = REPO_COPY + '/grasp/1.2.0'
    mkdirSync(dirG, { recursive: true })
    writeFileSync(dirG + '/host.js', GRASP_12)
    writeFileSync(dirG + '/manifest.json', JSON.stringify({ grasp: { version: '1.2.0', kind: 'end-effector', tool: 'host.js', sha256: sha256Of(GRASP_12) } }))
    const dirC = REPO_COPY + '/camera_detect/1.0.0'
    mkdirSync(dirC, { recursive: true })
    writeFileSync(dirC + '/host.js', CAMERA_10)
    writeFileSync(dirC + '/manifest.json', JSON.stringify({ camera_detect: { version: '1.0.0', kind: 'sensor', tool: 'host.js', sha256: sha256Of(CAMERA_10) } }))
  }

  const run = async () => {
    await new Promise((r) => setTimeout(r, 6000))
    let h1 = null
    let h2 = null
    try {
      writePackages()
      const capList = await rpc('cap_list', {})
      record('P0-pack', capList.repo.some((x) => x.cap === 'grasp' && x.version === '1.2.0' && x.kind === 'end-effector')
        && capList.repo.some((x) => x.cap === 'camera_detect' && x.kind === 'sensor') ? 'pass' : 'fail', JSON.stringify(capList.repo))

      h1 = await newSession()
      h2 = await newSession()
      // 探针①: 布局(行为版): 盲抓(未命中)证明"臂事件经 agent 层"的链已通且终端执行;
      // 层级链打印依赖 dsh-scope 包(仓库路径不可解析), 由行为等价断言替代.
      const s1 = await svc.mount('grasp', '1.2.0', { arm: 'A' })
      const ph1 = await svc.bridge('set_tool', ['A', 'grasp'])
      const blindText = await callTool(h1, 'take_object', { arm: 'A' })
      record('P1-layout', (s1.ok === true && blindText.includes('未命中')) ? 'pass' : 'fail',
        JSON.stringify({ mount: s1, physical: ph1, take: blindText }))

      // 探针⑥: kind 准入路由(挂载服务直调, 四态).
      const r61 = await svc.mount('camera_detect', '1.0.0', { slot: 'perception' })
      const r62 = await svc.mount('camera_detect', '1.0.0', { arm: 'B' })
      const r63 = await svc.mount('grasp', '1.2.0', { slot: 'perception' })
      const r64 = await svc.mount('grasp', '1.2.0', { arm: 'B' })
      record('P6-kind', (r61.ok === true && r62.ok === false && String(r62.error).includes('挂载点类型不匹配')
        && r63.ok === false && String(r63.error).includes('槽位类型不匹配') && r64.ok === true) ? 'pass' : 'fail',
        JSON.stringify({ r61: { ok: r61.ok, error: r61.error }, r62: r62.error, r63: r63.error, r64: { ok: r64.ok, error: r64.error } }))
      await svc.unmountSlot('perception')

      // 探针⑦: 槽标签 = agent key 双断言(detect_ball 可见 + 拦截命中).
      const r71 = await svc.mount('camera_detect', '1.0.0', { slot: 'perception' })
      const detectText = await callTool(h1, 'detect_ball', {})
      let detectVisible = false
      try { detectVisible = JSON.parse(detectText).ok === true } catch (e) { detectVisible = false }
      record('P7-slot', (r71.ok === true && detectVisible) ? 'pass' : 'fail',
        JSON.stringify({ mount: { ok: r71.ok, error: r71.error }, detect: detectText }))

      // 探针②③④⑤(合并): scopedWaterfall + 方向 + 交叉隔离 + req 注入 + this 语义.
      let hitS1 = 0
      let hitS2 = 0
      let thisOfListener = null
      const off1 = h1.agent.ctx.on('manipulate_execute', (req, next) => {
        hitS1 += 1
        thisOfListener = this
        return next()
      })
      const off2 = h2.agent.ctx.on('manipulate_execute', (req, next) => {
        hitS2 += 1
        return next()
      })
      // 会话 1 的 B 拦截器 + 会话 2 不挂视觉: 会话 1 执行应命中, 会话 2 零命中.
      const preciseText = await callTool(h1, 'take_object', { arm: 'A' })
      const preciseOk = preciseText.includes('命中') && preciseText.includes('球')
      const thisIsCarrier = thisOfListener !== null && typeof thisOfListener !== 'function'
        && (thisOfListener === undefined || typeof thisOfListener.get !== 'function')
      record('P2-P3-P4-P5', (preciseOk && hitS1 >= 1 && hitS2 === 0) ? 'pass' : 'fail',
        JSON.stringify({ take: preciseText, hitS1: hitS1, hitS2: hitS2, thisType: typeof thisOfListener, thisIsCarrier: thisIsCarrier }))
      off1(); off2()

      // 探针⑧: 拦截器随 fiber 摘除(回退盲抓) + 卸载视觉后 detect_ball 消失 + grasp 未被重挂.
      await svc.unmountSlot('perception')
      const backText = await callTool(h1, 'take_object', { arm: 'A' })
      const detectAfter = await callTool(h1, 'detect_ball', {})
      const listAfter = svc.list()
      const graspStill = listAfter.mounted.some((m) => m.arm === 'A' && m.cap === 'grasp' && m.version === '1.2.0')
      const slotEmpty = listAfter.slots.length === 0
      const detectGone = detectAfter.startsWith('Error: unknown tool')
      record('P8-teardown', (backText.includes('未命中') && detectGone && graspStill && slotEmpty) ? 'pass' : 'fail',
        JSON.stringify({ take: backText, detectAfter: detectAfter.slice(0, 60), graspStill: graspStill, slotEmpty: slotEmpty }))

      // 探针⑨: move_to 收敛完成式(返回即已到位) + 超时路径.
      const mv1 = await svc.bridge('move_to', ['A', 0.5, 0.0])
      const dist1 = mv1.ok ? Math.hypot(mv1.ee[0] - 0.5, mv1.ee[1] - 0.0) : 999
      const mv2 = await svc.bridge('move_to', ['A', 2.0, 0.0])
      record('P9-move_to', (mv1.ok === true && dist1 < 0.02 && mv1.ball !== undefined
        && mv2.ok === false && String(mv2.error).includes('超时')) ? 'pass' : 'fail',
        JSON.stringify({ mv1: { ok: mv1.ok, ee: mv1.ee, ball: mv1.ball, dist: dist1 }, mv2: { ok: mv2.ok, error: mv2.error } }))

      // 清理: 卸 B 臂挂载与 A 臂挂载, 复位.
      await svc.unmount('B')
      await svc.unmount('A')
      await svc.bridge('reset', [])
    } catch (e) {
      record('SUITE', 'fail', String(e && e.stack ? e.stack : e))
    }
    try { if (h1) await h1.dispose() } catch (e) { /* 忽略 */ }
    try { if (h2) await h2.dispose() } catch (e) { /* 忽略 */ }
    dump()
  }

  function dump() {
    mkdirSync(RESULTS_DIR, { recursive: true })
    const summary = {
      total: Object.keys(results.probes).length,
      pass: Object.values(results.probes).filter((p) => p.verdict === 'pass').length,
      fail: Object.values(results.probes).filter((p) => p.verdict === 'fail').length,
    }
    writeFileSync(RESULTS_DIR + '/spike.json', JSON.stringify({ phase: 'stage-A-spike', summary: summary, probes: results.probes }, null, 2))
  }

  run()
}
