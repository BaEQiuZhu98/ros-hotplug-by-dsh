// eval/hotplug/drivers/suite_fake.js - 假 daemon 环境驱动(组合挂载插件).
// 覆盖: T-A-17(非 JSON 输出)/ T-A-24 ③(内部异常 500).
// 前置: 装配时 --fake-python 指向 eval/hotplug/fixtures/fake-python.sh.
// 结果落盘 eval/results/run-fake/fake.json.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'

export const inject = ['agents', 'agentPresets', 'capabilityMount']

const REPO_ROOT = '/root/my-project/ros-hotplug-by-dsh'
const RESULTS_DIR = REPO_ROOT + '/eval/results/run-fake'
const LOGS_DIR = REPO_ROOT + '/eval/results/logs'

const NAMES = {
  'T-A-17': 'daemon 非 JSON 输出重置',
  'T-A-24': '路由健壮性(内部异常 500)',
}

const cases = []

export function apply(ctx) {
  const rpc = async (method, args) => {
    const r = await fetch('http://127.0.0.1:3199/cap-mount/' + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {}),
    })
    let text = ''
    try { text = await r.text() } catch (e) { /* 忽略 */ }
    let body = null
    try { body = JSON.parse(text) } catch (e) { body = text }
    return { status: r.status, body: body }
  }
  const record = (id, verdict, error, notes) => {
    cases.push({ case_id: id, name: NAMES[id] || id, verdict: verdict,
      error: error === undefined ? null : error, notes: notes || null })
  }
  const webLog = () => (existsSync(LOGS_DIR + '/eval-web.log')
    ? readFileSync(LOGS_DIR + '/eval-web.log', 'utf8') : '')

  const run = async () => {
    await new Promise((r) => setTimeout(r, 6000))
    let handle = null
    try {
      handle = await ctx.agents.create({
        sessionId: 'eval-fake-' + Date.now(),
        meta: { cwd: REPO_ROOT, agentPreset: 'robo' },
        setup: async (agentCtx) => { await ctx.agentPresets.mount(agentCtx, 'robo') },
      })
      // ---- T-A-17: 假 daemon 输出非 JSON ----
      const t0 = Date.now()
      const r = await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      const elapsed = Date.now() - t0
      const ta17ok = elapsed < 10000 && JSON.stringify(r.body).includes('输出不是 JSON')
      record('T-A-17', ta17ok ? 'pass' : 'fail',
        ta17ok ? null : JSON.stringify({ elapsedMs: elapsed, resp: r }),
        '假 daemon 下 arm_mount 耗时 ' + elapsed + 'ms(快速失败, 非挂起), 响应=' + JSON.stringify(r).slice(0, 240)
        + '; 实现错误文案为「daemon 输出不是 JSON: <行内容>」, 与判定「输出不是 JSON」一致')

      // ---- T-A-24 ③: 内部异常 → 500 ----
      const ta24ok = r.status === 500
        && typeof r.body === 'object' && r.body.ok === false
        && typeof r.body.error === 'string' && r.body.error.includes('daemon 输出不是 JSON')
      record('T-A-24', ta24ok ? 'pass' : 'fail',
        ta24ok ? null : JSON.stringify({ status: r.status, body: r.body }),
        '判定预期: 内部异常 → HTTP 500 + error 含原因信息; 实测: ' + JSON.stringify(r).slice(0, 240)
        + '; 注: ①②分支已在真实环境 test_host_api 通过')
    } catch (e) {
      record('SUITE', 'fail', String(e && e.stack ? e.stack : e), null)
    }
    try { if (handle) await handle.dispose() } catch (e) { /* 忽略 */ }
    dump()
  }

  function dump() {
    mkdirSync(RESULTS_DIR, { recursive: true })
    writeFileSync(RESULTS_DIR + '/fake.json', JSON.stringify({
      phase: 'gate2-suite-fake', summary: {
        total: cases.length,
        pass: cases.filter((c) => c.verdict === 'pass').length,
        fail: cases.filter((c) => c.verdict === 'fail').length,
      }, cases: cases,
    }, null, 2))
  }

  run()
}
