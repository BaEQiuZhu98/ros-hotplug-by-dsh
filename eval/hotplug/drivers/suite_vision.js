// eval/hotplug/drivers/suite_vision.js - 视觉感知热插拔场景正式用例驱动(组合挂载, /tmp 隔离环境).
// 以 .dsh/vision-hotplug-scenario-design.md 与 .dsh/test-plan.md v4 为基准.
// 覆盖: T-S-16(拦截器四态+零重载)/T-S-17(冒泡方向)/T-A-29(req 契约与否决)/
//       T-A-30(detect_ball 契约)/T-A-31(move_to 契约全链路)/T-A-32(槽位路由)/
//       T-M-27(槽位规则四态+串行+恢复).
// 通道: 挂/卸走面板同路径 HTTP /cap-mount(3199); 工具调用走编程 robo 会话 tools.execute;
//       故障注入(停 sim/rosbridge)在 netns 内, 不触碰用户 9090 域.
// 结果落盘 eval/results/run-vision/vision.json.

import { writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'

export const inject = ['agents', 'agentPresets', 'capabilityMount', 'tools']

const REPO_ROOT = '/root/my-project/ros-hotplug-by-dsh'
const REPO_COPY = REPO_ROOT + '/eval/hotplug/fixtures/repo-copy'
const LOGS_DIR = REPO_ROOT + '/eval/results/logs'
const RESULTS_DIR = REPO_ROOT + '/eval/results/run-vision'
const SIM = REPO_ROOT + '/src/ros2/sim_bridge/sim_bridge/two_arm_server.py'
const VENV_PY = '/root/venvs/robo/bin/python3'

const NAMES = {
  'T-S-16': '拦截器四态: 盲/精准/回退/视觉异常 + 零重载',
  'T-S-17': '事件冒泡方向验证',
  'T-A-29': 'req 契约与注入/否决语义',
  'T-A-30': 'detect_ball 契约',
  'T-A-31': 'move_to 契约全链路与收敛时序',
  'T-A-32': '槽位路由参数与错误语义',
  'T-M-27': '槽位规则四态 + 串行 + 恢复',
}

const cases = []
function record(id, verdict, error, notes) {
  cases.push({ case_id: id, name: NAMES[id] || id, verdict: verdict, error: error === undefined ? null : error, notes: notes || null })
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
      callId: 'vision-' + name + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      name: name, arguments: args || {}, agent: handle.agent, signal: sig,
    })
    return r && r.content ? r.content.map((c) => (c && c.text ? c.text : '')).join('') : String(r)
  }
  const newSession = async () => {
    return await ctx.agents.create({
      sessionId: 'vision-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      meta: { cwd: REPO_ROOT, agentPreset: 'robo' },
      setup: async (agentCtx) => { await ctx.agentPresets.mount(agentCtx, 'robo') },
    })
  }
  const sh = (cmd) => execSync(cmd, {
    env: { ...process.env, HOME: process.env.HOME || '/root', ROS_DOMAIN_ID: '43', ROS_LOG_DIR: LOGS_DIR },
  }).toString()

  const run = async () => {
    await new Promise((r) => setTimeout(r, 6000))
    let h1 = null
    let h2 = null
    try {
      h1 = await newSession()
      h2 = await newSession()

      // ---- T-S-16: 拦截器四态 + 零重载 ----
      const m16 = await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.2.0' })
      const blind = await callTool(h1, 'take_object', { arm: 'A' })
      const s16 = await rpc('slot_mount', { slot: 'perception', cap: 'camera_detect', version: '1.0.0' })
      const precise = await callTool(h1, 'take_object', { arm: 'A' })
      const detectText = await callTool(h1, 'detect_ball', {})
      await rpc('slot_unmount', { slot: 'perception' })
      const back = await callTool(h1, 'take_object', { arm: 'A' })
      const detectGone = (await callTool(h1, 'detect_ball', {})).startsWith('Error: unknown tool')
      const listMid = svc.list()
      const graspStable = listMid.mounted.some((m) => m.arm === 'A' && m.cap === 'grasp' && m.version === '1.2.0')
      // 视觉异常态: 停 rosbridge -> 桥断 -> 拦截器 fail-open(告警) + 执行链仍到终端(明确错误而非挂起).
      await rpc('slot_mount', { slot: 'perception', cap: 'camera_detect', version: '1.0.0' })
      sh("ps -eo pid,args | grep 'rosbridge_websocket' | grep -v grep | awk '{print $1}' | xargs -r kill")
      await new Promise((r) => setTimeout(r, 1500))
      const veText = await callTool(h1, 'take_object', { arm: 'A' })
      const veClear = typeof veText === 'string' && veText.length > 0 && !veText.includes('Error: unknown')
      // 恢复 rosbridge.
      sh("setsid bash -c 'source /opt/ros/humble/setup.bash && source /root/venvs/robo/bin/activate && HOME=/root ROS_DOMAIN_ID=43 ROS_LOG_DIR=" + LOGS_DIR + " ros2 launch rosbridge_server rosbridge_websocket_launch.xml port:=9090' > " + LOGS_DIR + "/eval-rosbridge.log 2>&1 &")
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 1000))
        if (sh('(echo > /dev/tcp/127.0.0.1/9090) 2>/dev/null && echo up || echo down').trim() === 'up') break
      }
      await new Promise((r) => setTimeout(r, 3000))
      await rpc('reset_all', {})
      const ts16ok = blind.includes('未命中') && precise.includes('命中') && back.includes('未命中')
        && detectGone && graspStable && veClear
      record('T-S-16', ts16ok ? 'pass' : 'fail',
        ts16ok ? null : JSON.stringify({ blind: blind, precise: precise, back: back, detectGone: detectGone, graspStable: graspStable, ve: veText }),
        '盲=' + blind.slice(0, 60) + '; 精准=' + precise.slice(0, 60) + '; 回退=' + back.slice(0, 60)
        + '; VE(桥断)=' + veText.slice(0, 80) + '; grasp 记录稳定=' + graspStable)

      // ---- T-S-17: 冒泡方向(祖先命中 + 非祖先不命中) ----
      let hitS1 = 0
      let hitS2 = 0
      const off1 = h1.agent.ctx.on('manipulate_execute', (req, next) => { hitS1 += 1; return next() })
      const off2 = h2.agent.ctx.on('manipulate_execute', (req, next) => { hitS2 += 1; return next() })
      await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.2.0' })
      await rpc('slot_mount', { slot: 'perception', cap: 'camera_detect', version: '1.0.0' })
      const t17take = await callTool(h1, 'take_object', { arm: 'A' })
      off1(); off2()
      const ts17ok = hitS1 >= 1 && hitS2 === 0 && t17take.includes('命中')
      record('T-S-17', ts17ok ? 'pass' : 'fail', ts17ok ? null : JSON.stringify({ hitS1: hitS1, hitS2: hitS2, take: t17take }),
        '会话 1(祖先链)监听命中 ' + hitS1 + ' 次; 会话 2(非祖先)命中 ' + hitS2 + ' 次(反向不成立)')

      // ---- T-A-29: req 契约与注入/否决语义 ----
      // 注入: 驱动自挂拦截器原地改 req.target.
      const offInject = h1.agent.ctx.on('manipulate_execute', (req, next) => {
        req.target = [0.5, 0.0]
        return next()
      })
      const t29inject = await callTool(h1, 'take_object', { arm: 'A' })
      offInject()
      // 否决: 不 next 且返回非 undefined -> 返回值上抛为执行结果.
      const offVeto = h1.agent.ctx.on('manipulate_execute', (req, next) => {
        return '否决: 测试原因(球超出视野)'
      })
      const t29veto = await callTool(h1, 'take_object', { arm: 'A' })
      offVeto()
      const ta29ok = t29inject.includes('命中') && t29veto.includes('否决: 测试原因')
      record('T-A-29', ta29ok ? 'pass' : 'fail', ta29ok ? null : JSON.stringify({ inject: t29inject, veto: t29veto }),
        '注入修改对终端可见(' + t29inject.slice(0, 50) + '); 否决返回值上抛(' + t29veto.slice(0, 50) + ')')

      // ---- T-A-30: detect_ball 契约 ----
      const d30ok = await callTool(h1, 'detect_ball', {})
      let d30parsed = null
      try { d30parsed = JSON.parse(d30ok) } catch (e) { d30parsed = null }
      // sim 停止时调用: 桥仍通但无回传 -> 感知失败.
      sh("ps -eo pid,args | grep 'two_arm_server.py' | grep -v grep | awk '{print $1}' | xargs -r kill")
      await new Promise((r) => setTimeout(r, 1500))
      const d30fail = await callTool(h1, 'detect_ball', {})
      sh("setsid bash -c 'source /opt/ros/humble/setup.bash && source /root/venvs/robo/bin/activate && HOME=/root ROS_DOMAIN_ID=43 ROS_LOG_DIR=" + LOGS_DIR + " " + VENV_PY + " " + SIM + "' > " + LOGS_DIR + "/eval-sim.log 2>&1 &")
      await new Promise((r) => setTimeout(r, 5000))
      let d30parsedFail = null
      try { d30parsedFail = JSON.parse(d30fail) } catch (e) { d30parsedFail = null }
      const ta30ok = d30parsed !== null && d30parsed.ok === true && Array.isArray(d30parsed.ball)
        && d30parsedFail !== null && d30parsedFail.ok === false && String(d30parsedFail.error).includes('感知不到状态')
      record('T-A-30', ta30ok ? 'pass' : 'fail', ta30ok ? null : JSON.stringify({ ok: d30ok, fail: d30fail }),
        '成功=' + d30ok.slice(0, 60) + '; sim 停止=' + d30fail.slice(0, 60))

      // ---- T-A-31: move_to 契约全链路与收敛时序 ----
      // 前置: T-A-30 重启了 sim(世界复位, 物理末端回 none)——重挂 A 恢复物理装配.
      await rpc('arm_unmount', { arm: 'A' })
      await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.2.0' })
      const mv1 = await svc.bridge('move_to', ['A', 0.5, 0.0])
      const dist1 = mv1.ok && Array.isArray(mv1.ee) ? Math.hypot(mv1.ee[0] - 0.5, mv1.ee[1] - 0.0) : 999
      const mv2 = await svc.bridge('move_to', ['A', 'nan', 0.0])
      const mv3 = await svc.bridge('move_to', ['A', 2.0, 0.0])
      const ta31ok = mv1.ok === true && dist1 < 0.02 && Array.isArray(mv1.ball)
        && mv2.ok === false && String(mv2.error).includes('有限数字')
        && mv3.ok === false && String(mv3.error).includes('超时')
      record('T-A-31', ta31ok ? 'pass' : 'fail', ta31ok ? null : JSON.stringify({ mv1: { ok: mv1.ok, dist: dist1 }, mv2: mv2, mv3: mv3 }),
        '可达收敛(返回即已到位, dist=' + dist1 + '); 非有限数=' + JSON.stringify(mv2) + '; 不可达超时=' + JSON.stringify(mv3))

      // ---- T-A-32: 槽位路由参数与错误语义(HTTP 面板同路径) ----
      const r321 = await rpc('slot_unmount', { slot: 'perception' })
      const r322 = await rpc('slot_mount', { slot: 'perception', cap: 'camera_detect', version: '1.0.0' })
      const r323 = await rpc('slot_mount', { slot: 'perception', cap: 'grasp', version: '1.2.0' })
      const r324 = await rpc('slot_mount', { slot: 'no_such_slot', cap: 'camera_detect', version: '1.0.0' })
      const r325 = await rpc('slot_mount', { cap: 'camera_detect', version: '1.0.0' })
      const ta32ok = r321.ok === true && r322.ok === true
        && r323.ok === false && String(r323.error).includes('槽位类型不匹配')
        && r324.ok === false && String(r324.error).includes('未知槽位')
        && r325.ok === false && String(r325.error).includes('缺少槽位参数')
      record('T-A-32', ta32ok ? 'pass' : 'fail', ta32ok ? null : JSON.stringify({ r321: r321, r322: r322, r323: r323, r324: r324, r325: r325 }))

      // ---- T-M-27: 槽位规则四态 + 串行 + 恢复 ----
      // ① 同槽重复挂同版本.
      const r271 = await rpc('slot_mount', { slot: 'perception', cap: 'camera_detect', version: '1.0.0' })
      // ② 非法槽(已由 T-A-32 覆盖, 此处记同源).
      // ③ 无槽上下文: 全部会话 dispose 后挂槽拒绝(在末尾会话销毁段验证).
      // ⑤ 并发挂 10 次(同槽同版本交替重试): per-slot 串行, 终态一致.
      const reqs = []
      for (let i = 0; i < 10; i++) {
        reqs.push(rpc('slot_mount', { slot: 'perception', cap: 'camera_detect', version: '1.0.0' }))
      }
      const r27conc = await Promise.all(reqs)
      const list27 = svc.list()
      // ⑥ 换挂坏版本恢复: 副本注入 camera_detect/9.9.9(apply 抛错) -> 换挂失败 -> restored 旧能力.
      const badDir = REPO_COPY + '/camera_detect/9.9.9'
      mkdirSync(badDir, { recursive: true })
      const badCode = "export const inject = ['tools', 'capabilityMount']\nexport function apply() { throw new Error('测试注入: 坏传感器版本') }\n"
      writeFileSync(badDir + '/host.js', badCode)
      writeFileSync(badDir + '/manifest.json', JSON.stringify({ camera_detect: { version: '9.9.9', kind: 'sensor', tool: 'host.js', sha256: sha256Of(badCode) } }))
      const r27bad = await rpc('slot_mount', { slot: 'perception', cap: 'camera_detect', version: '9.9.9' })
      const list27b = svc.list()
      const restored27 = list27b.slots.some((s) => s.slot === 'perception' && s.cap === 'camera_detect' && s.version === '1.0.0')
      const tm27ok = r271.ok === false && String(r271.error).includes('同槽重复挂载拒绝')
        && r27conc.every((r) => r.ok === true || (r.ok === false && String(r.error).includes('同槽重复')))
        && list27.slots.filter((s) => s.slot === 'perception').length === 1
        && r27bad.ok === false && r27bad.restored === true && restored27
      record('T-M-27', tm27ok ? 'pass' : 'fail', tm27ok ? null : JSON.stringify({ r271: r271, list27: list27.slots, r27bad: r27bad, restored: restored27 }),
        '① 同槽防重=' + JSON.stringify(r271) + '; ⑤ 并发终态单实例=' + (list27.slots.length === 1)
        + '; ⑥ 换挂坏版本=' + JSON.stringify({ ok: r27bad.ok, restored: r27bad.restored }) + ', 旧能力恢复=' + restored27)

      // ③ 无槽上下文(全部会话销毁后).
      await h1.dispose()
      await h2.dispose()
      h1 = null
      h2 = null
      const r273 = await rpc('slot_mount', { slot: 'perception', cap: 'camera_detect', version: '1.0.0' })
      const tm27c = r273.ok === false && String(r273.error).includes('无上下文')
      if (!tm27ok) record('T-M-27', 'fail', JSON.stringify({ r273: r273 }), '③ 无槽上下文=' + JSON.stringify(r273) + '(主判定见上)')
      else if (!tm27c) record('T-M-27', 'fail', JSON.stringify({ r273: r273 }), '③ 无槽上下文未按预期拒绝')
      await rpc('reset_all', {})
    } catch (e) {
      record('SUITE', 'fail', String(e && e.stack ? e.stack : e), null)
    }
    try { if (h1) await h1.dispose() } catch (e) { /* 忽略 */ }
    try { if (h2) await h2.dispose() } catch (e) { /* 忽略 */ }
    dump()
  }

  function dump() {
    mkdirSync(RESULTS_DIR, { recursive: true })
    writeFileSync(RESULTS_DIR + '/vision.json', JSON.stringify({
      phase: 'stage-B-vision', summary: {
        total: cases.length,
        pass: cases.filter((c) => c.verdict === 'pass').length,
        fail: cases.filter((c) => c.verdict === 'fail').length,
      }, cases: cases,
    }, null, 2))
  }

  run()
}
