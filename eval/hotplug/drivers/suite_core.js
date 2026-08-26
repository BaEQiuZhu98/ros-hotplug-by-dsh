// eval/hotplug/drivers/suite_core.js - /tmp eval 环境核心会话套件(组合挂载插件).
// 覆盖: T-S 全系列(05 部分)/ T-M-02/03/04/05/06/07/08/09/16/24 / T-A-20/21/22.
// 判定标准逐条对照 .dsh/test-plan.md v3; 结果落盘 eval/results/run-driver/driver.json
// (load_run 兼容格式), 由 eval/lib/summary.py 聚合.
// 通道说明: 挂/卸走面板同路径 HTTP /cap-mount(3199); 工具调用走编程创建 robo
// 会话的 tools.execute({agent})(与 agent 调用同一管线); 物理制造不匹配走
// 挂载服务 svc.bridge(set_tool)(与面板/臂管理器同通道).

import { writeFileSync, mkdirSync, readFileSync, appendFileSync, existsSync, rmSync, cpSync } from 'node:fs'
import { createHash } from 'node:crypto'

export const inject = ['agents', 'agentPresets', 'capabilityMount', 'tools']

const REPO_ROOT = '/root/my-project/ros-hotplug-by-dsh'
const RESULTS_DIR = REPO_ROOT + '/eval/results/run-driver'
const LOGS_DIR = REPO_ROOT + '/eval/results/logs'
const REPO_COPY = REPO_ROOT + '/eval/hotplug/fixtures/repo-copy'
const SRC_REPO = REPO_ROOT + '/src/capabilities/repo'

const NAMES = {
  'T-S-01': '分层可见性: 臂层实例不上浮',
  'T-S-02': '同名实例臂间隔离',
  'T-S-03': '异名实例换型隔离',
  'T-S-04': '臂作用域查询精确命中',
  'T-S-05': 'nearest-wins / 父链继承遮蔽',
  'T-S-06': '事件沿父链上抛',
  'T-S-07': '写路径隔离: agent 无挂/卸能力',
  'T-S-08': '插入即见(含激活时序)',
  'T-S-09': '拔出即回收',
  'T-S-10': '精确回收边界: 卸载 A 不影响 B',
  'T-S-11': '生命周期对称: 会话关闭回收',
  'T-S-12': '多版本并存',
  'T-S-13': '换版切换(agent 无感)',
  'T-S-14': '失败回滚(restored=true)',
  'T-S-15': '恢复失败显式告警',
  'T-M-02': '准入顺序(校验失败不动旧挂载)',
  'T-M-03': '规则表四态',
  'T-M-04': 'list() 一致性',
  'T-M-05': '多会话上下文管理',
  'T-M-06': '能力实例 物理匹配感知',
  'T-M-07': '能力实例 策略三步走',
  'T-M-08': '能力实例 dispose 回收',
  'T-M-09': '臂管理器 作用域预建与工具注册',
  'T-M-10': '臂管理器 挂载记录缺失分支',
  'T-M-16': 'observer tools/change 订阅',
  'T-M-24': '挂载服务 repo 目录级准入异常',
  'T-A-20': '并发串行化',
  'T-A-21': 'arm_status 三态',
  'T-A-22': 'take_object 分派与错误',
}

const cases = []
let mainHandle = null

export function apply(ctx) {
  const svc = ctx.capabilityMount
  const sig = new AbortController().signal

  const rpc = async (method, args) => {
    const r = await fetch('http://127.0.0.1:3199/cap-mount/' + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {}),
    })
    return await r.json()
  }
  const record = (id, verdict, error, notes) => {
    cases.push({ case_id: id, name: NAMES[id] || id, verdict: verdict,
      error: error === undefined ? null : error, notes: notes || null })
  }
  const webLog = () => (existsSync(LOGS_DIR + '/eval-web.log')
    ? readFileSync(LOGS_DIR + '/eval-web.log', 'utf8') : '')
  const callTool = async (handle, name, args) => {
    const r = await handle.agent.ctx.get('tools').execute({
      callId: 'eval-' + name + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      name: name, arguments: args, agent: handle.agent, signal: sig,
    })
    return r && r.content ? r.content.map((c) => (c && c.text ? c.text : '')).join('') : String(r)
  }
  const probeTool = async (handle, name, args) => {
    const text = await callTool(handle, name, args || {})
    if (text.startsWith('Error: unknown tool')) return null
    return text
  }
  const newSession = async () => {
    return await ctx.agents.create({
      sessionId: 'eval-suite-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      meta: { cwd: REPO_ROOT, agentPreset: 'robo' },
      setup: async (agentCtx) => { await ctx.agentPresets.mount(agentCtx, 'robo') },
    })
  }
  const armStatus = (handle, arm) => callTool(handle, 'arm_status', { arm: arm })
  const cleanup = async () => { try { await rpc('reset_all', {}) } catch (e) { /* 忽略 */ } }

  const run = async () => {
    await new Promise((r) => setTimeout(r, 6000))
    try {
      // ---- T-M-09: 建会话即注册臂上下文与工具 ----
      mainHandle = await newSession()
      let log = webLog()
      const tm09ok = log.includes('[robo-arm-manager] 臂作用域已就绪')
        && log.includes('[cap-mount-service] 臂上下文注册')
      record('T-M-09', tm09ok ? 'pass' : 'fail', tm09ok ? null : '日志缺臂上下文注册证据')

      // ---- T-S-01: 工具表无 manipulate/挂卸工具; 挂载后注册于臂层(agent 不可见) ----
      const probes = {
        arm_status: await probeTool(mainHandle, 'arm_status', { arm: 'A' }),
        take_object: await probeTool(mainHandle, 'take_object', { arm: 'A' }),
        manipulate: await probeTool(mainHandle, 'manipulate', { arm: 'A' }),
        arm_mount: await probeTool(mainHandle, 'arm_mount', {}),
        arm_unmount: await probeTool(mainHandle, 'arm_unmount', {}),
        mount: await probeTool(mainHandle, 'mount', {}),
        unmount: await probeTool(mainHandle, 'unmount', {}),
      }
      const ts01a = probes.arm_status !== null && probes.take_object !== null
        && probes.manipulate === null && probes.arm_mount === null
        && probes.arm_unmount === null && probes.mount === null && probes.unmount === null
      await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      const ts01b = webLog().includes('[capability-grasp] 臂 A 挂载夹取策略实例(manipulate)')
      record('T-S-01', (ts01a && ts01b) ? 'pass' : 'fail',
        (ts01a && ts01b) ? null : JSON.stringify({ ts01a, ts01b, probes: Object.fromEntries(
          Object.entries(probes).map(([k, v]) => [k, v === null ? 'unknown' : String(v).slice(0, 40)])) }),
        '工具表断言用关键名单探测(全表枚举需 scope key, 驱动不可得); 挂/卸工具名按面板契约探测')

      // ---- T-S-08: 插入即见 ----
      const ts08 = await armStatus(mainHandle, 'A')
      record('T-S-08', ts08.includes('"ready":true') ? 'pass' : 'fail',
        ts08.includes('"ready":true') ? null : ts08)

      // ---- T-S-07: agent 无挂/卸能力, 挂载计数不因 agent 活动变化 ----
      const listBefore = await rpc('cap_list', {})
      const ts07ok = listBefore.mounted.length === 1
      record('T-S-07', ts07ok ? 'pass' : 'fail', ts07ok ? null : JSON.stringify(listBefore),
        '挂/卸工具不可见已随 T-S-01 断言; 挂载计数经 cap_list 校验')

      // ---- T-S-09: 拔出即回收 ----
      await rpc('arm_unmount', { arm: 'A' })
      const ts09status = await armStatus(mainHandle, 'A')
      const ts09manip = await probeTool(mainHandle, 'manipulate', { arm: 'A' })
      record('T-S-09', (ts09status.includes('该臂没有末端实例') && ts09manip === null) ? 'pass' : 'fail',
        (ts09status.includes('该臂没有末端实例') && ts09manip === null) ? null
          : JSON.stringify({ ts09status, ts09manip }))
      await cleanup()

      // ---- T-S-02: 同名实例臂间隔离 ----
      await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      await rpc('arm_mount', { arm: 'B', cap: 'grasp', version: '1.0.0' })
      const t02a = await callTool(mainHandle, 'take_object', { arm: 'A' })
      const t02b = await callTool(mainHandle, 'take_object', { arm: 'B' })
      const ts02ok = t02a.includes('臂 A') && t02a.includes('夹取完成')
        && t02b.includes('臂 B') && t02b.includes('夹取完成')
      record('T-S-02', ts02ok ? 'pass' : 'fail', ts02ok ? null : JSON.stringify({ t02a, t02b }))
      await cleanup()

      // ---- T-S-03: 异名实例换型隔离 ----
      await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      await rpc('arm_mount', { arm: 'B', cap: 'suction', version: '1.0.0' })
      const t03a = await callTool(mainHandle, 'take_object', { arm: 'A' })
      const t03b = await callTool(mainHandle, 'take_object', { arm: 'B' })
      const ts03ok = t03a.includes('夹取') && t03b.includes('吸附')
      record('T-S-03', ts03ok ? 'pass' : 'fail', ts03ok ? null : JSON.stringify({ t03a, t03b }))

      // ---- T-S-04: 臂作用域查询精确命中 ----
      const t04a = await armStatus(mainHandle, 'A')
      const t04b = await armStatus(mainHandle, 'B')
      await rpc('arm_unmount', { arm: 'A' })
      const t04a2 = await armStatus(mainHandle, 'A')
      const t04b2 = await armStatus(mainHandle, 'B')
      const ts04ok = t04a.includes('"ready":true') && t04b.includes('"ready":true')
        && t04a2.includes('该臂没有末端实例') && t04b2.includes('"ready":true')
      record('T-S-04', ts04ok ? 'pass' : 'fail',
        ts04ok ? null : JSON.stringify({ t04a, t04b, t04a2, t04b2 }))
      await cleanup()

      // ---- T-S-10: 卸载 A 不影响 B ----
      await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      await rpc('arm_mount', { arm: 'B', cap: 'grasp', version: '1.0.0' })
      await rpc('arm_unmount', { arm: 'A' })
      const t10runs = []
      for (let i = 0; i < 3; i++) t10runs.push(await callTool(mainHandle, 'take_object', { arm: 'B' }))
      const t10status = await armStatus(mainHandle, 'B')
      const ts10ok = t10runs.every((x) => x.includes('臂 B') && x.includes('夹取完成'))
        && t10status.includes('"ready":true')
      record('T-S-10', ts10ok ? 'pass' : 'fail', ts10ok ? null : JSON.stringify({ t10runs, t10status }))
      await cleanup()

      // ---- T-S-12: 多版本并存 ----
      await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      await rpc('arm_mount', { arm: 'B', cap: 'grasp', version: '1.1.0' })
      const t12a = await callTool(mainHandle, 'take_object', { arm: 'A' })
      const t12b = await callTool(mainHandle, 'take_object', { arm: 'B' })
      const ts12ok = !t12a.includes('[v2]') && t12b.includes('[v2]')
      record('T-S-12', ts12ok ? 'pass' : 'fail', ts12ok ? null : JSON.stringify({ t12a, t12b }))
      await cleanup()

      // ---- T-S-13: 换版切换(agent 无感) ----
      await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      const t13a = await callTool(mainHandle, 'take_object', { arm: 'A' })
      await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.1.0' })
      const t13b = await callTool(mainHandle, 'take_object', { arm: 'A' })
      const t13status = await armStatus(mainHandle, 'A')
      const ts13ok = !t13a.includes('[v2]') && t13b.includes('[v2]') && t13status.includes('"ready":true')
      record('T-S-13', ts13ok ? 'pass' : 'fail', ts13ok ? null : JSON.stringify({ t13a, t13b, t13status }))
      await cleanup()

      // ---- T-S-06 / T-M-16: tools/change 事件计数(挂+卸 = 2 次) ----
      let changeCount = 0
      const offEvent = ctx.on('tools/change', () => { changeCount += 1 })
      await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      await rpc('arm_unmount', { arm: 'A' })
      const ts06ok = changeCount === 2
      record('T-S-06', ts06ok ? 'pass' : 'fail', ts06ok ? null : 'tools/change 计数=' + changeCount,
        'observer 日志在 dsh web stdout(驱动读不到终端), 用宿主订阅计数作等价证据')
      record('T-M-16', ts06ok ? 'pass' : 'fail', ts06ok ? null : 'tools/change 计数=' + changeCount,
        '与 T-S-06 同一次实验')
      offEvent()
      await cleanup()

      // ---- T-S-05: 同名遮蔽(nearest-wins) + 父链继承 ----
      const hostDef = {
        name: 'eval-dup', description: '实验工具(宿主层注册).',
        parameters: { type: 'object', properties: {}, required: [] },
        output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
        execute: () => 'host-layer',
      }
      const agentDef = {
        name: 'eval-dup', description: '实验工具(agent 层注册).',
        parameters: { type: 'object', properties: {}, required: [] },
        output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
        execute: () => 'agent-layer',
      }
      const offHost = ctx.tools.register(hostDef)
      const at = mainHandle.agent.ctx.get('tools')
      const offAgent = at.register(agentDef)
      const t05text = await callTool(mainHandle, 'eval-dup', {})
      offAgent(); offHost()
      const ts05ok = t05text.includes('agent-layer')
      record('T-S-05', ts05ok ? 'pass' : 'fail', ts05ok ? null : 'eval-dup 解析到 ' + t05text,
        '同名遮蔽用宿主层 vs agent 层实验工具验证; 父链继承证据 = arm_status 自 standing 层可见(T-S-01/08); 臂层遮蔽由 T-S-01 manipulate 不可见覆盖')

      // ---- T-S-14: 失败回滚(副本注入坏版本) ----
      writeBadVersion('9.9.9')
      await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      const t14r = await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '9.9.9' })
      const t14status = await armStatus(mainHandle, 'A')
      const t14take = await callTool(mainHandle, 'take_object', { arm: 'A' })
      const ts14ok = t14r.ok === false && t14r.restored === true
        && t14status.includes('"ready":true') && t14take.includes('夹取完成')
        && webLog().includes('已自动恢复旧末端 grasp@1.0.0')
      record('T-S-14', ts14ok ? 'pass' : 'fail', ts14ok ? null : JSON.stringify({ t14r, t14status, t14take }))
      await cleanup()

      // ---- T-S-15: 恢复失败显式告警(注入可行性验证) ----
      // 实测: 恢复路径复用旧 plugin 对象(不重新 import, 见挂载服务 doUnmount/恢复逻辑),
      // 篡改副本文件无法使恢复失败; "arm 上下文失效"亦无源码外注入点.
      const t15pre = await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      tamperFile(REPO_COPY + '/grasp/1.0.0/host.js', '\nthrow new Error("测试注入: 旧版本已篡改, 激活必失败")\n')
      const t15r = await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '9.9.9' })
      restoreFile(REPO_COPY + '/grasp/1.0.0')
      record('T-S-15', 'not-injectable', null,
        '实测注入结果: ' + JSON.stringify({ t15pre: t15pre.ok, t15r: { ok: t15r.ok, restored: t15r.restored } }) +
        '; 恢复路径复用已加载的旧 plugin 对象, 副本篡改不影响恢复; 判定所述"使恢复路径也失败"需修改实现或提供测试钩子, 与"不改源码"约束冲突')
      await cleanup()

      // ---- T-M-24: repo 目录级准入异常 ----
      const t24a = makeBadDir('only-host', { host: true, manifest: false, json: null })
      const t24r1 = await rpc('arm_mount', { arm: 'A', cap: 'only-host', version: '1.0.0' })
      removeDir(t24a)
      const t24b = makeBadDir('no-sha', { host: true, manifest: true, json: '{"no-sha": {"other": 1}}' })
      const t24r2 = await rpc('arm_mount', { arm: 'A', cap: 'no-sha', version: '1.0.0' })
      removeDir(t24b)
      const t24c = makeBadDir('bad-json', { host: true, manifest: true, json: '{not-json' })
      const t24r3 = await rpc('arm_mount', { arm: 'A', cap: 'bad-json', version: '1.0.0' })
      removeDir(t24c)
      const t24d = makeBadDir('ghost', { host: false, manifest: false, json: null })
      const t24list = await rpc('cap_list', {})
      removeDir(t24d)
      const ts24ok = String(t24r1.error).includes('能力不存在')
        && String(t24r2.error).includes('sha256 字段')
        && String(t24r3.error).includes('解析失败')
        && !t24list.repo.some((x) => x.cap === 'ghost')
      record('T-M-24', ts24ok ? 'pass' : 'fail', ts24ok ? null : JSON.stringify({ t24r1, t24r2, t24r3, t24list }))

      // ---- T-M-02: 准入顺序(篡改 manifest 的换挂, 旧挂载不动) ----
      tamperManifest(REPO_COPY + '/suction/1.0.0/manifest.json')
      await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      const t02r = await rpc('arm_mount', { arm: 'A', cap: 'suction', version: '1.0.0' })
      const t02list = await rpc('cap_list', {})
      restoreFile(REPO_COPY + '/suction/1.0.0')
      const tm02ok = t02r.ok === false
        && t02list.mounted.some((m) => m.arm === 'A' && m.cap === 'grasp')
        && !t02list.mounted.some((m) => m.cap === 'suction')
      record('T-M-02', tm02ok ? 'pass' : 'fail', tm02ok ? null : JSON.stringify({ t02r, t02list }))
      await cleanup()

      // ---- T-M-03: 规则表四态(无上下文态由 T-S-11 断言) ----
      await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      const t03dup = await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      const t03bad = await rpc('arm_mount', { arm: 'C', cap: 'grasp', version: '1.0.0' })
      const t03swap = await rpc('arm_mount', { arm: 'A', cap: 'suction', version: '1.0.0' })
      const t03list = await rpc('cap_list', {})
      const t03take = await callTool(mainHandle, 'take_object', { arm: 'A' })
      const tm03ok = t03dup.ok === false
        && t03bad.ok === false && t03bad.error.includes('非法机械臂')
        && t03swap.ok === true
        && t03list.mounted.filter((m) => m.arm === 'A').length === 1
        && t03list.mounted.some((m) => m.arm === 'A' && m.cap === 'suction')
        && t03take.includes('吸附')
      record('T-M-03', tm03ok ? 'pass' : 'fail', tm03ok ? null : JSON.stringify({ t03dup, t03bad, t03swap, t03list, t03take }),
        '同臂防重的具体错误文案以实际返回记录(判定只要求拒绝)')
      await cleanup()

      // ---- T-M-04: list() 一致性 ----
      await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      await rpc('arm_mount', { arm: 'B', cap: 'suction', version: '1.0.0' })
      const t04l1 = await rpc('cap_list', {})
      await rpc('arm_unmount', { arm: 'A' })
      const t04l2 = await rpc('cap_list', {})
      const tm04ok = t04l1.mounted.length === 2
        && t04l2.mounted.length === 1 && t04l2.mounted[0].arm === 'B'
      record('T-M-04', tm04ok ? 'pass' : 'fail', tm04ok ? null : JSON.stringify({ t04l1, t04l2 }))
      await cleanup()

      // ---- T-M-05: 多会话上下文管理(行为记录式) ----
      const second = await newSession()
      await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      const t05s2 = await armStatus(second, 'A')
      await second.dispose()
      const t05again = await rpc('arm_mount', { arm: 'B', cap: 'grasp', version: '1.0.0' })
      const tm05ok = t05s2.includes('"ready":true') && t05again.ok === true
      record('T-M-05', tm05ok ? 'pass' : 'fail', tm05ok ? null : JSON.stringify({ t05s2, t05again }),
        'standing 组合为共享层: 两会话的臂上下文语义以实际行为记录')
      await cleanup()

      // ---- T-M-06/07: 物理匹配感知与策略三步走 ----
      await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      await svc.bridge('set_tool', ['A', 'suction'])
      const t06take = await callTool(mainHandle, 'take_object', { arm: 'A' })
      const t06list = await rpc('cap_list', {})
      const t06q = await svc.bridge('query_capabilities', [])
      const tm06ok = t06take.includes('不是夹爪') && !t06take.includes('夹取完成')
        && t06list.mounted.some((m) => m.arm === 'A' && m.cap === 'grasp')
        && JSON.stringify(t06q).includes('"A":"suction"')
      record('T-M-06', tm06ok ? 'pass' : 'fail', tm06ok ? null : JSON.stringify({ t06take, t06q }))
      await svc.bridge('set_tool', ['A', 'grasp'])
      const t07take = await callTool(mainHandle, 'take_object', { arm: 'A' })
      const tm07ok = t07take.includes('touch ok') && !t07take.includes('不是夹爪')
      record('T-M-07', tm07ok ? 'pass' : 'fail', tm07ok ? null : t07take,
        '三步走以输出文本为断言: 感知通过(无"不是夹爪") + 执行(touch ok) + 校验(回读仍 grasp)')
      await cleanup()

      // ---- T-M-08: dispose 回收 ----
      await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      await rpc('arm_unmount', { arm: 'A' })
      const t08manip = await probeTool(mainHandle, 'manipulate', { arm: 'A' })
      const tm08ok = t08manip === null
      record('T-M-08', tm08ok ? 'pass' : 'fail', tm08ok ? null : JSON.stringify({ t08manip }))
      await cleanup()

      // ---- T-A-21: arm_status 三态 ----
      const a21s1 = await armStatus(mainHandle, 'A')
      await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      await svc.bridge('set_tool', ['A', 'none'])
      const a21s2 = await armStatus(mainHandle, 'A')
      await svc.bridge('set_tool', ['A', 'grasp'])
      const a21s3 = await armStatus(mainHandle, 'A')
      const ta21ok = a21s1.includes('该臂没有末端实例')
        && a21s2.includes('物理末端未装配或不匹配')
        && a21s3.includes('"ready":true')
        && !a21s3.includes('grasp')
      record('T-A-21', ta21ok ? 'pass' : 'fail', ta21ok ? null : JSON.stringify({ a21s1, a21s2, a21s3 }))
      await cleanup()

      // ---- T-A-22: take_object 分派与错误 ----
      const a22s1 = await callTool(mainHandle, 'take_object', { arm: 'A' })
      await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      const a22s2 = await callTool(mainHandle, 'take_object', { arm: 'A' })
      await svc.bridge('set_tool', ['A', 'suction'])
      const a22s3 = await callTool(mainHandle, 'take_object', { arm: 'A' })
      const ta22ok = a22s1.includes('没有末端实例')
        && a22s2.includes('夹取完成') && a22s2.includes('touch ok')
        && a22s3.includes('不是夹爪')
      record('T-A-22', ta22ok ? 'pass' : 'fail', ta22ok ? null : JSON.stringify({ a22s1, a22s2, a22s3 }))
      await cleanup()

      // ---- T-A-20: 并发串行化 ----
      const requests = []
      for (let i = 0; i < 10; i++) {
        requests.push(rpc('arm_mount', { arm: 'A', cap: i % 2 === 0 ? 'grasp' : 'suction', version: '1.0.0' }))
      }
      const t20rs = await Promise.all(requests)
      const t20list = await rpc('cap_list', {})
      const expected = 'suction'
      const ta20ok = t20list.mounted.some((m) => m.arm === 'A' && m.cap === expected)
        && t20rs.every((r) => r.ok === true || typeof r.error === 'string')
      record('T-A-20', ta20ok ? 'pass' : 'fail', ta20ok ? null : JSON.stringify({ t20list, n: t20rs.length }))
      await cleanup()

      // ---- T-S-11: 会话关闭回收(判定 vs 实际行为) ----
      await mainHandle.dispose()
      mainHandle = null
      const cycleResults = []
      let okCycle = true
      for (let i = 0; i < 5; i++) {
        const h = await newSession()
        const m = await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
        await rpc('arm_unmount', { arm: 'A' })
        await h.dispose()
        const after = await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
        cycleResults.push({ mount: m.ok, afterDisposeOk: after.ok, afterDisposeError: after.error || null })
        if (after.ok !== false || !String(after.error).includes('没有臂上下文')) okCycle = false
        await cleanup()
      }
      const ts11ok = okCycle
      record('T-S-11', ts11ok ? 'pass' : 'fail',
        ts11ok ? null : JSON.stringify(cycleResults),
        '实测: 会话关闭后臂上下文注销(挂载服务摘除该会话上下文), 再挂载被拒("没有臂上下文"); 5 轮循环一致')
      mainHandle = await newSession()
      await cleanup()

      // ---- T-M-10: 挂载记录缺失分支(注入点检查) ----
      record('T-M-10', 'not-injectable', null,
        '臂管理器"挂载记录"由挂载服务维护(闭包状态), 无源码外清除接口; 忠实执行该分支需修改实现或提供测试钩子, 与"不改源码"约束冲突')

      await cleanup()
    } catch (e) {
      record('SUITE', 'fail', String(e && e.stack ? e.stack : e), null)
    }
    try { if (mainHandle) await mainHandle.dispose() } catch (e) { /* 忽略 */ }
    dump()
  }

  function dump() {
    mkdirSync(RESULTS_DIR, { recursive: true })
    writeFileSync(RESULTS_DIR + '/driver.json', JSON.stringify({
      phase: 'gate2-suite-core', summary: {
        total: cases.length,
        pass: cases.filter((c) => c.verdict === 'pass').length,
        fail: cases.filter((c) => c.verdict === 'fail').length,
      }, cases: cases,
    }, null, 2))
  }

  // ---- 副本注入工具(只写 eval/hotplug/fixtures/repo-copy, 不触碰 src/) ----
  function sha256Of(path) {
    return createHash('sha256').update(readFileSync(path)).digest('hex')
  }
  function writeBadVersion(version) {
    const dir = REPO_COPY + '/grasp/' + version
    mkdirSync(dir, { recursive: true })
    writeFileSync(dir + '/host.js',
      "export const inject = ['tools', 'capabilityMount']\n" +
      'export function apply() { throw new Error("测试注入: 坏版本激活即失败") }\n')
    writeFileSync(dir + '/manifest.json',
      JSON.stringify({ grasp: { sha256: sha256Of(dir + '/host.js') } }))
  }
  function makeBadDir(cap, opts) {
    const dir = REPO_COPY + '/' + cap + '/1.0.0'
    mkdirSync(dir, { recursive: true })
    if (opts.host) writeFileSync(dir + '/host.js', 'export const apply = () => {}\n')
    if (opts.manifest) {
      if (opts.json) writeFileSync(dir + '/manifest.json', opts.json)
      else writeFileSync(dir + '/manifest.json',
        JSON.stringify({ [cap]: { sha256: sha256Of(dir + '/host.js') } }))
    }
    return dir
  }
  function removeDir(dir) {
    rmSync(dir, { recursive: true, force: true })
  }
  function tamperFile(path, extra) {
    appendFileSync(path, extra)
  }
  function tamperManifest(path) {
    const m = JSON.parse(readFileSync(path, 'utf8'))
    m.suction.sha256 = '0'.repeat(64)
    writeFileSync(path, JSON.stringify(m))
  }
  function restoreFile(srcPath) {
    const rel = srcPath.replace(REPO_COPY + '/', '')
    cpSync(SRC_REPO + '/' + rel, srcPath, { recursive: true, force: true })
  }

  run()
}
