// eval/hotplug/drivers/smoke.js - /tmp eval 环境冒烟驱动(组合挂载插件).
// 验证闭环: 面板路由 → 编程创建 robo 会话 → arm_status → 经面板挂载 → 再查状态.
// 结果落盘 eval/results/run-smoke/driver.json.

import { writeFileSync, mkdirSync } from 'node:fs'

export const inject = ['agents', 'agentPresets', 'capabilityMount']

export function apply(ctx) {
  const out = { time: new Date().toISOString() }
  const dump = () => {
    const dir = '/root/my-project/ros-hotplug-by-dsh/eval/results/run-smoke'
    mkdirSync(dir, { recursive: true })
    writeFileSync(dir + '/driver.json', JSON.stringify(out, null, 2))
  }
  const rpc = async (method, args) => {
    const r = await fetch('http://127.0.0.1:3199/cap-mount/' + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {}),
    })
    return await r.json()
  }
  ;(async () => {
    try {
      await new Promise((r) => setTimeout(r, 6000))
      out.capList = await rpc('cap_list', {})
      const handle = await ctx.agents.create({
        sessionId: 'eval-smoke-' + Date.now(),
        meta: { cwd: '/root/my-project/ros-hotplug-by-dsh', agentPreset: 'robo' },
        setup: async (agentCtx) => { await ctx.agentPresets.mount(agentCtx, 'robo') },
      })
      const at = handle.agent.ctx.get('tools')
      const sig = new AbortController().signal
      const call = async (name, args) => {
        const r = await at.execute({
          callId: 'smoke-' + name + '-' + Date.now(),
          name: name, arguments: args, agent: handle.agent, signal: sig,
        })
        return r && r.content ? r.content.map((c) => (c && c.text ? c.text : '')).join('') : String(r)
      }
      out.armStatusBefore = await call('arm_status', { arm: 'A' })
      out.mountResult = await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      out.armStatusAfter = await call('arm_status', { arm: 'A' })
      out.takeObject = await call('take_object', { arm: 'A' })
      await rpc('reset_all', {})
      await handle.dispose()
      out.done = true
    } catch (e) {
      out.error = String(e && e.stack ? e.stack : e)
    }
    dump()
  })()
}
