// capability-mount-service - 能力挂载服务(设计 §7.1 层 0 / §10.3).
//
// host 常驻插件(组合挂载的真实插件, 非动态沙箱: 动态沙箱 ctx 隐藏 ctx.plugin/fiber 等框架内部).
// 职责: 准入检查(sha256 + 规则表) + 臂管理(按臂记录); 末端实例的运行时挂/卸在会话内
// 臂管理器注册的**臂上下文(作用域)**上执行. 提供 'capabilityMount' 服务, 供 web 面板
// (人的唯一写入口)经 RPC 调用; 不注册任何 agent 工具.
//
//   registerArms({A: ctx, B: ctx})  臂管理器(会话内)注册臂上下文(臂名须在 config.arms 内); 多会话注册各自追加
//   registerSlot(slot, ctx)         臂管理器注册感知槽上下文(sensor 类能力挂载点, 标签 = agent key)
//   mount(cap, version, {arm|slot}) 准入检查 -> 动态 import -> 按 kind 路由到臂/槽上下文 ctx.plugin
//                                   -> 同点防重(同 cap@version 拒绝), 同点换挂先卸载(替换)
//   unmount(arm) / unmountSlot(slot) 该点全部上下文上的实例 fiber.dispose(只回收本点)
//   scopedWaterfall(armCtx, name, args, next)  作用域化事件织入助手(能力实例零依赖下的跨层拦截通道)
//   list()                          {repo: [{cap, version, kind}], mounted, slots, arms}
//
// 臂间独立: 不同臂可挂同名能力(实例同名 manipulate, 靠臂作用域隔离, 互不串台).
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const name = 'capability-mount-service'
export const inject = ['tools']

export function apply(ctx, config = {}) {
  const repo = resolve(config.repo ?? 'src/capabilities/repo')
  const workdir = config.workdir ?? '.'
  const python = config.python ?? 'python3'

  // --- SDK 常驻 daemon(P2-10 / 审查 v1 N1+N2 加固) ---
  // 常驻 bridge_client daemon: 一条 rosbridge 连接复用, 能力执行不再 spawn python 子进程.
  // 状态机带 generation 号: 旧代输出丢弃(防响应串台); 僵死进程 kill 后重建; 响应等待 5s 超时兜底.
  let daemonProc = null
  let daemonChain = Promise.resolve()
  let daemonGeneration = 0
  let readyWaiters = []
  let respWaiters = []
  let lineBuffer = ''
  let daemonStatus = 'down'

  function failDaemon(reason) {
    daemonStatus = 'down'
    const err = reason instanceof Error ? reason : new Error(String(reason))
    // ready 阶段失败(daemon 起不来)保持 reject: 面板按"内部异常"返回 500(含原因).
    for (const w of readyWaiters.splice(0)) w.reject(err)
    // 请求进行中 daemon 死亡: 以错误响应形态返回, 让面板 physical 分离语义成立(T-A-16),
    // 而不是把异常抛给 HTTP 层.
    const errLine = JSON.stringify({ ok: false, error: err.message })
    for (const w of respWaiters.splice(0)) w.resolve(errLine)
  }

  function killDaemon(reason) {
    if (daemonProc === null) return
    const proc = daemonProc
    daemonProc = null
    daemonGeneration += 1
    // 解绑旧代流与事件监听(N2-c): 'exit' 早于流 'close', 旧缓冲行不得再进状态机.
    // 清理失败不再静默: 打印告警, 便于排障(审查 v3: 静默吞错).
    try { proc.stdout.removeAllListeners('data') } catch (e) { console.warn('[cap-mount-service] 解绑 stdout 监听失败: %s', e && e.message) }
    try { proc.stderr.removeAllListeners('data') } catch (e) { console.warn('[cap-mount-service] 解绑 stderr 监听失败: %s', e && e.message) }
    try { proc.removeAllListeners('exit') } catch (e) { console.warn('[cap-mount-service] 解绑 exit 监听失败: %s', e && e.message) }
    try { proc.removeAllListeners('error') } catch (e) { console.warn('[cap-mount-service] 解绑 error 监听失败: %s', e && e.message) }
    daemonStatus = 'down'
    if (reason !== undefined && reason !== null) {
      const text = reason instanceof Error ? reason.message : String(reason)
      console.warn('[cap-mount-service] daemon 已重置: %s', text)
    }
    try { proc.kill() } catch (e) { console.warn('[cap-mount-service] kill daemon 失败: %s', e && e.message) }
  }

  function handleDaemonLine(generation, line) {
    if (generation !== daemonGeneration) return  // 旧代输出丢弃.
    if (daemonStatus === 'starting') {
      try {
        const parsed = JSON.parse(line)
        if (parsed.ok === true) {
          daemonStatus = 'ready'
          for (const w of readyWaiters.splice(0)) w.resolve()
        } else {
          const err = new Error(parsed.error || 'daemon 启动失败')
          killDaemon(err)
          failDaemon(err)
        }
      } catch (e) {
        // 非 JSON 首行(N2-b): 视为不可用进程, 杀掉并失败; 下次调用重新 spawn, 不挂起.
        const err = new Error('daemon 输出不是 JSON: ' + line.slice(0, 80))
        killDaemon(err)
        failDaemon(err)
      }
      return
    }
    if (respWaiters.length > 0) respWaiters.shift().resolve(line)
    else console.warn('[cap-mount-service] daemon 非预期输出: %s', line)
  }

  function ensureDaemon() {
    if (daemonProc !== null && daemonStatus === 'ready') return Promise.resolve()
    if (daemonProc !== null) return new Promise((resolve, reject) => readyWaiters.push({ resolve, reject }))
    daemonStatus = 'starting'
    const generation = daemonGeneration
    const proc = spawn(python, [join(workdir, 'src/bridge/bridge_client.py'), 'daemon'], { cwd: workdir })
    daemonProc = proc
    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', (chunk) => {
      if (generation !== daemonGeneration) return
      lineBuffer += chunk
      let index
      while ((index = lineBuffer.indexOf('\n')) !== -1) {
        const line = lineBuffer.slice(0, index).trim()
        lineBuffer = lineBuffer.slice(index + 1)
        if (line) handleDaemonLine(generation, line)
      }
    })
    // N1-b: stderr 不再静默, 保留错误信息供排障.
    proc.stderr.setEncoding('utf8')
    proc.stderr.on('data', (chunk) => {
      if (generation !== daemonGeneration) return
      const tail = String(chunk).trim()
      if (tail) console.warn('[cap-mount-service] daemon stderr: %s', tail)
    })
    // N2-a: spawn 错误(如 python 路径 ENOENT)必须监听, 否则 Node 抛未捕获异常.
    proc.on('error', (err) => {
      if (generation !== daemonGeneration) return
      killDaemon()
      failDaemon(err)
    })
    proc.on('exit', () => {
      if (generation !== daemonGeneration) return
      killDaemon(new Error('daemon 已退出'))
      failDaemon(new Error('daemon 已退出'))
    })
    return new Promise((resolve, reject) => readyWaiters.push({ resolve, reject }))
  }

  // 串行转发(行协议 FIFO): 每次调用等待 daemon 一行响应; 5s 超时兜底并重置 daemon(N2-d).
  function bridge(method, args) {
    const run = async () => {
      await ensureDaemon()
      const request = JSON.stringify({ method: method, args: args || [] }) + '\n'
      const response = await new Promise((resolve, reject) => {
        let timer = null
        const waiter = {
          resolve: (line) => { if (timer) clearTimeout(timer); resolve(line) },
          reject: (err) => { if (timer) clearTimeout(timer); reject(err) },
        }
        timer = setTimeout(() => {
          const index = respWaiters.indexOf(waiter)
          if (index !== -1) respWaiters.splice(index, 1)
          killDaemon(new Error('daemon 响应超时(5s)'))
          // 超时以错误响应形态返回(而非 throw): 面板 physical 分离语义在超时路径成立(T-A-16).
          resolve(JSON.stringify({ ok: false, error: 'daemon 响应超时(5s)' }))
        }, 5000)
        respWaiters.push(waiter)
        daemonProc.stdin.write(request)
      })
      try {
        return JSON.parse(response)
      } catch (e) {
        return { ok: false, error: 'daemon 响应不是 JSON: ' + response }
      }
    }
    const next = daemonChain.then(run, run)
    daemonChain = next.catch(() => {})
    return next
  }


  // 全局臂清单: 本服务是机械臂数量的唯一权威来源(审查 v3: 消除 A/B 硬编码).
  // 默认 A/B 与物理双臂契约一致; 需要更多臂时只改组合行 config.arms, 各层经 list()/校验动态跟随.
  const arms = [...new Set(config.arms ?? ['A', 'B'])]
  // arm -> [{ctx, ...}]  臂管理器注册的臂上下文(每会话一套, 追加).
  const armContexts = new Map(arms.map((arm) => [arm, []]))
  // arm -> {cap, version, fibers: [{dispose}]}  该臂当前挂载.
  const armsByArm = new Map()

  function sha256(file) {
    return createHash('sha256').update(readFileSync(file)).digest('hex')
  }

  // 仓库清单: repo/<cap>/<version>/manifest.json(条目带 kind, 缺省 end-effector).
  function listRepo() {
    const out = []
    if (!existsSync(repo)) return out
    for (const cap of readdirSync(repo)) {
      const capDir = join(repo, cap)
      if (!existsSync(join(capDir))) continue
      for (const ver of readdirSync(capDir)) {
        const manifestFile = join(capDir, ver, 'manifest.json')
        if (existsSync(manifestFile)) {
          let kind = 'end-effector'
          try {
            const m = JSON.parse(readFileSync(manifestFile, 'utf8'))
            kind = (m[cap] && m[cap].kind) || 'end-effector'
          } catch (e) {
            // manifest 不可解析时不阻断清单(准入在挂载时拒绝).
          }
          out.push({ cap, version: ver, kind })
        }
      }
    }
    return out.sort()
  }

  // 准入: sha256 与 manifest 比对 + 动态加载能力插件(不注册).
  async function loadPlugin(cap, version) {
    const dir = join(repo, cap, version)
    const hostFile = join(dir, 'host.js')
    const manifestFile = join(dir, 'manifest.json')
    if (!existsSync(hostFile) || !existsSync(manifestFile)) {
      return { ok: false, error: '能力不存在: ' + cap + '@' + version }
    }
    let manifest
    try {
      manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
    } catch (e) {
      return { ok: false, error: 'manifest 解析失败: ' + e.message }
    }
    const entry = manifest[cap]
    if (!entry || !entry.sha256) {
      return { ok: false, error: 'manifest 缺少 ' + cap + ' 的 sha256 字段' }
    }
    const kind = entry.kind || 'end-effector'
    if (!['end-effector', 'sensor', 'skill'].includes(kind)) {
      return { ok: false, error: 'manifest 的 kind 非法: ' + kind }
    }
    const actual = sha256(hostFile)
    if (actual !== entry.sha256) {
      return { ok: false, error: '拒绝挂载: 哈希不匹配! 期望 ' + entry.sha256.slice(0, 16) + '... 实际 ' + actual.slice(0, 16) + '... (代码被篡改?)' }
    }
    try {
      const plugin = await import(pathToFileURL(hostFile).href + '?v=' + Date.now())
      return { ok: true, plugin, kind }
    } catch (e) {
      return { ok: false, error: '加载 host.js 失败: ' + e.message }
    }
  }

  // 在单个臂上下文上挂载实例, 等待激活确认. 返回 {ok, dispose} 或 {ok:false, error}.
  async function mountOnContext(targetCtx, plugin, arm) {
    let handle
    try {
      handle = targetCtx.plugin(plugin, { workdir, python, arm })
    } catch (e) {
      return { ok: false, error: 'ctx.plugin 挂载失败: ' + e.message }
    }
    const dispose = typeof handle === 'function' ? handle : () => handle.dispose()
    try {
      if (typeof handle.await === 'function') await handle.await()
      else await new Promise((resolveWait) => setTimeout(resolveWait, 50))
    } catch (e) {
      try {
        dispose()
      } catch (err) {
        // 回收失败不掩盖原始错误, 但仍打印告警便于排障(审查 v3: 静默吞错).
        console.warn('[cap-mount-service] 臂 %s 激活失败后的回收也失败: %s', arm, err && err.message)
      }
      return { ok: false, error: '挂载激活失败: ' + (e && e.message) }
    }
    return { ok: true, dispose }
  }

  function registerArms(armsBySession) {
    const registered = []
    const pendingMounts = []
    for (const arm of Object.keys(armsBySession || {})) {
      const target = armsBySession[arm]
      if (target === undefined || target === null) continue
      if (!armContexts.has(arm)) {
        console.warn('[cap-mount-service] 忽略未在 config.arms 中的臂上下文: %s', arm)
        continue
      }
      armContexts.get(arm).push(target)
      registered.push({ arm, ctx: target })
      // 新上下文补挂当前末端(懒补建的会话臂作用域须立即获得已挂实例): 挂载记录
      // 是"人给该臂装末端"的全局事实, 任何会话的该臂上下文都应带上当前实例.
      const cur = armsByArm.get(arm)
      if (cur !== undefined) pendingMounts.push({ arm, ctx: target, cap: cur.cap, version: cur.version, plugin: cur.plugin })
    }
    console.log('[cap-mount-service] 臂上下文注册: %s', arms.map((a) => a + '=' + armContexts.get(a).length + ' 套').join(', '))
    const pendingTasks = []
    for (const p of pendingMounts) {
      pendingTasks.push(enqueueArm(p.arm, async () => {
        const curNow = armsByArm.get(p.arm)
        if (curNow === undefined || curNow.cap !== p.cap || curNow.version !== p.version) return
        const r = await mountOnContext(p.ctx, p.plugin, p.arm)
        if (r.ok) {
          const curAfter = armsByArm.get(p.arm)
          if (curAfter !== undefined && curAfter.cap === p.cap && curAfter.version === p.version) {
            curAfter.fibers.push({ dispose: r.dispose, ctx: p.ctx })
            console.log('[cap-mount-service] 臂 %s 新上下文补挂 %s@%s 成功', p.arm, p.cap, p.version)
          } else {
            try { r.dispose() } catch (e) { console.warn('[cap-mount-service] 臂 %s 补挂过期回收失败: %s', p.arm, e && e.message) }
          }
        } else {
          console.warn('[cap-mount-service] 臂 %s 新上下文补挂失败: %s', p.arm, r.error)
        }
      }))
    }
    // 返回对称注销函数(按对象引用删除): 会话关闭时臂管理器调用, 防悬垂上下文与数组膨胀.
    // 同时摘除该上下文上的实例 fiber(随会话作用域销毁, 挂载服务不再持有).
    // fn.pending 供调用方(臂管理器懒补建路径)等待补挂全部完成后再解析实例.
    const unregisterArms = function unregisterArms() {
      for (const { arm, ctx: target } of registered) {
        const list = armContexts.get(arm)
        if (list === undefined) continue
        const index = list.indexOf(target)
        if (index !== -1) list.splice(index, 1)
        const cur = armsByArm.get(arm)
        if (cur !== undefined) {
          cur.fibers = cur.fibers.filter((f) => f.ctx !== target)
        }
      }
      console.log('[cap-mount-service] 臂上下文注销: %s', arms.map((a) => a + '=' + armContexts.get(a).length + ' 套').join(', '))
    }
    unregisterArms.pending = Promise.all(pendingTasks)
    return unregisterArms
  }

  // 感知槽(场景扩展): slot -> [ctx...]  smer 类能力挂载点(标签 = agent key, 每会话一套).
  const slotContexts = new Map()
  // slot -> {cap, version, fibers, plugin}  槽位当前挂载.
  const slotsBySlot = new Map()

  function registerSlot(slot, ctx) {
    if (typeof slot !== 'string' || slot === '') return { ok: false, error: '非法槽位名' }
    const list = slotContexts.get(slot) ?? []
    list.push(ctx)
    slotContexts.set(slot, list)
    console.log('[cap-mount-service] 感知槽上下文注册: %s=%d 套', slot, list.length)
    // 新槽上下文补挂当前感知能力(懒补建的会话须立即获得已挂 sensor 实例).
    const cur = slotsBySlot.get(slot)
    const pendingTasks = []
    if (cur !== undefined) {
      pendingTasks.push(enqueueSlot(slot, async () => {
        const curNow = slotsBySlot.get(slot)
        if (curNow === undefined || curNow.cap !== cur.cap || curNow.version !== cur.version) return
        const r = await mountOnContext(ctx, cur.plugin, slot)
        if (r.ok) {
          const curAfter = slotsBySlot.get(slot)
          if (curAfter !== undefined && curAfter.cap === cur.cap && curAfter.version === cur.version) {
            curAfter.fibers.push({ dispose: r.dispose, ctx })
            console.log('[cap-mount-service] 槽 %s 新上下文补挂 %s@%s 成功', slot, cur.cap, cur.version)
          } else {
            try { r.dispose() } catch (e) { console.warn('[cap-mount-service] 槽 %s 补挂过期回收失败: %s', slot, e && e.message) }
          }
        } else {
          console.warn('[cap-mount-service] 槽 %s 新上下文补挂失败: %s', slot, r.error)
        }
      })
      )
    }
    // 返回对称注销函数; fn.pending 供臂管理器懒补建路径等待补挂完成.
    const unregisterSlot = function unregisterSlot() {
      const curList = slotContexts.get(slot)
      if (curList === undefined) return
      const index = curList.indexOf(ctx)
      if (index !== -1) curList.splice(index, 1)
      const mounted = slotsBySlot.get(slot)
      if (mounted !== undefined) {
        mounted.fibers = mounted.fibers.filter((f) => f.ctx !== ctx)
      }
      console.log('[cap-mount-service] 感知槽上下文注销: %s=%d 套', slot, curList.length)
    }
    unregisterSlot.pending = Promise.all(pendingTasks)
    return unregisterSlot
  }

  // 作用域化事件织入助手(P1): 实现由臂管理器注入(臂管理器是 profile 包, 可解析
  // dsh-scope; 本服务零 import, 能力实例经本助手零依赖发射). 事件只沿臂作用域的
  // 祖先链路由(多会话天然隔离, 反向不成立). 未注入时(理论上仅臂管理器未加载)直接报错.
  let scopedWaterfallImpl = null
  function attachScopedWaterfall(fn) {
    if (typeof fn === 'function') scopedWaterfallImpl = fn
  }
  function scopedWaterfall(armCtx, name, args, next) {
    if (scopedWaterfallImpl === null) {
      throw new Error('scopedWaterfall 助手未注入(臂管理器尚未加载)')
    }
    return scopedWaterfallImpl(armCtx, name, args, next)
  }

  async function doUnmount(arm) {
    const cur = armsByArm.get(arm)
    if (!cur) return { ok: false, error: '臂 ' + arm + ' 没有挂载末端' }
    for (const f of cur.fibers) {
      try {
        await f.dispose()
      } catch (e) {
        // 尽力回收, 但回收失败必须可见(审查 v3: 静默吞错; 与「拔出即回收」验收直接相关).
        console.warn('[cap-mount-service] 卸载回收失败(臂 %s, %s@%s): %s', arm, cur.cap, cur.version, e && e.message)
      }
    }
    armsByArm.delete(arm)
    return { ok: true, arm, cap: cur.cap, version: cur.version }
  }

  // per-arm 串行队列(P1-6): 同一臂的挂/卸串行化, 防并发交错导致终态不符.
  const armQueues = new Map()
  function enqueueArm(arm, work) {
    const prev = armQueues.get(arm) ?? Promise.resolve()
    const next = prev.then(work, work)
    armQueues.set(arm, next.catch(() => {}))
    return next
  }

  // 导出面: 校验后入队. 臂名合法性只看全局臂清单 config.arms(审查 v3: 去 A/B 硬编码).
  async function mount(cap, version, options = {}) {
    if (options.slot !== undefined) return mountSlot(cap, version, options)
    const arm = options.arm
    if (typeof arm !== 'string' || !armContexts.has(arm)) return { ok: false, error: '非法机械臂: ' + (arm || '(未指定)') }
    return enqueueArm(arm, () => doMount(cap, version, options))
  }

  async function unmount(arm) {
    if (typeof arm !== 'string' || !armContexts.has(arm)) return { ok: false, error: '非法机械臂: ' + (arm || '(未指定)') }
    return enqueueArm(arm, () => doUnmount(arm))
  }

  // 感知槽挂载路径(sensor 类): 准入链与臂路径同构, kind 不匹配直接拒绝.
  const slotQueues = new Map()
  function enqueueSlot(slot, work) {
    const prev = slotQueues.get(slot) ?? Promise.resolve()
    const next = prev.then(work, work)
    slotQueues.set(slot, next.catch(() => {}))
    return next
  }

  async function mountSlot(cap, version, options = {}) {
    const slot = String(options.slot)
    if (!slotContexts.has(slot)) return { ok: false, error: '未知槽位: ' + slot }
    return enqueueSlot(slot, () => doMountSlot(cap, version, options))
  }

  async function doMountSlot(cap, version, options = {}) {
    const slot = String(options.slot)
    const loaded = await loadPlugin(cap, version)
    if (!loaded.ok) return loaded
    if (loaded.kind !== 'sensor') {
      return { ok: false, error: '槽位类型不匹配: ' + cap + '@' + version + ' 是 ' + loaded.kind + ', 感知槽只接受 sensor' }
    }
    const contexts = slotContexts.get(slot) ?? []
    if (contexts.length === 0) {
      return { ok: false, error: '槽位 ' + slot + ' 无上下文(请先创建「机器人任务」会话)' }
    }
    const cur = slotsBySlot.get(slot)
    if (cur !== undefined && cur.cap === cap && cur.version === version) {
      return { ok: false, error: '槽位 ' + slot + ' 已挂载 ' + cap + '@' + version + '(同槽重复挂载拒绝)' }
    }
    if (cur !== undefined) {
      await doUnmountSlot(slot)
    }
    const fibers = []
    for (const targetCtx of contexts) {
      const r = await mountOnContext(targetCtx, loaded.plugin, slot)
      if (!r.ok) {
        for (const f of fibers) {
          try { await f.dispose() } catch (e) { console.warn('[cap-mount-service] 槽部分挂载回收失败(%s, %s@%s): %s', slot, cap, version, e && e.message) }
        }
        if (cur !== undefined) {
          const restored = []
          for (const targetCtx of contexts) {
            const rr = await mountOnContext(targetCtx, cur.plugin, slot)
            if (rr.ok) restored.push({ dispose: rr.dispose, ctx: targetCtx })
          }
          if (restored.length > 0) {
            slotsBySlot.set(slot, { cap: cur.cap, version: cur.version, fibers: restored, plugin: cur.plugin })
            console.warn('[cap-mount-service] 槽 %s 换挂 %s@%s 失败, 已自动恢复旧能力 %s@%s', slot, cap, version, cur.cap, cur.version)
            return { ok: false, error: r.error, restored: true }
          }
          console.error('[cap-mount-service] 槽 %s 换挂失败且旧能力 %s@%s 恢复失败', slot, cur.cap, cur.version)
          return { ok: false, error: r.error + '(且旧能力恢复失败)', restored: false }
        }
        return { ok: false, error: r.error, restored: false }
      }
      fibers.push({ dispose: r.dispose, ctx: targetCtx })
    }
    slotsBySlot.set(slot, { cap, version, fibers, plugin: loaded.plugin })
    return { ok: true, slot, cap, version }
  }

  async function unmountSlot(slot) {
    if (!slotContexts.has(slot)) return { ok: false, error: '未知槽位: ' + slot }
    return enqueueSlot(slot, () => doUnmountSlot(slot))
  }

  async function doUnmountSlot(slot) {
    const cur = slotsBySlot.get(slot)
    if (!cur) return { ok: false, error: '槽位 ' + slot + ' 没有挂载能力' }
    for (const f of cur.fibers) {
      try { await f.dispose() } catch (e) { console.warn('[cap-mount-service] 槽卸载回收失败(%s, %s@%s): %s', slot, cur.cap, cur.version, e && e.message) }
    }
    slotsBySlot.delete(slot)
    return { ok: true, slot, cap: cur.cap, version: cur.version }
  }

  async function doMount(cap, version, options = {}) {
    const arm = options.arm
    if (typeof arm !== 'string' || !armContexts.has(arm)) return { ok: false, error: '非法机械臂: ' + (arm || '(未指定)') }
    const cur = armsByArm.get(arm)
    if (cur !== undefined && cur.cap === cap && cur.version === version) {
      return { ok: false, error: '臂 ' + arm + ' 已挂载 ' + cap + '@' + version + '(同臂重复挂载拒绝)' }
    }
    // 准入先于任何卸载: 校验失败时旧挂载原封不动(失败回滚语义).
    const loaded = await loadPlugin(cap, version)
    if (!loaded.ok) return loaded
    if (loaded.kind !== 'end-effector') {
      return { ok: false, error: '挂载点类型不匹配: ' + cap + '@' + version + ' 是 ' + loaded.kind + ', 臂挂载点只接受 end-effector' }
    }
    const contexts = armContexts.get(arm) ?? []
    if (contexts.length === 0) {
      return { ok: false, error: '臂 ' + arm + ' 没有臂上下文(请先创建「机器人任务」会话)' }
    }
    // 同臂换挂: 先卸载旧实例, 新实例挂载失败则尽力恢复旧实例(旧末端仍在).
    if (cur !== undefined) await doUnmount(arm)
    // 在全部臂上下文(各会话的该臂作用域)上挂载同名实例; 不同臂上下文同名实例互不冲突.
    const fibers = []
    for (const targetCtx of contexts) {
      const r = await mountOnContext(targetCtx, loaded.plugin, arm)
      if (!r.ok) {
        for (const f of fibers) {
          try {
            await f.dispose()
          } catch (e) {
            // 尽力回收, 但失败必须可见(审查 v3: 静默吞错).
            console.warn('[cap-mount-service] 部分挂载回收失败(臂 %s, %s@%s): %s', arm, cap, version, e && e.message)
          }
        }
        // 恢复旧实例(尽力而为): 换挂存在短暂窗口期(先摘旧再挂新), 失败后自动恢复旧末端;
        // 恢复成功/失败都显式告警并在返回值中标明(与文档「失败回滚」语义一致).
        if (cur !== undefined) {
          const restored = []
          for (const targetCtx of contexts) {
            const rr = await mountOnContext(targetCtx, cur.plugin, arm)
            if (rr.ok) restored.push({ dispose: rr.dispose, ctx: targetCtx })
          }
          if (restored.length > 0) {
            armsByArm.set(arm, { cap: cur.cap, version: cur.version, fibers: restored, plugin: cur.plugin })
            console.warn('[cap-mount-service] 臂 %s 换挂 %s@%s 失败, 已自动恢复旧末端 %s@%s', arm, cap, version, cur.cap, cur.version)
            return { ok: false, error: r.error, restored: true }
          }
          console.error('[cap-mount-service] 臂 %s 换挂失败且旧末端 %s@%s 恢复失败, 旧末端已丢失', arm, cur.cap, cur.version)
          return { ok: false, error: r.error + '(且旧末端恢复失败)', restored: false }
        }
        return { ok: false, error: r.error, restored: false }
      }
      fibers.push({ dispose: r.dispose, ctx: targetCtx })
    }
    armsByArm.set(arm, { cap, version, fibers, plugin: loaded.plugin })
    return { ok: true, arm, cap, version }
  }

  function list() {
    return {
      repo: listRepo(),
      mounted: [...armsByArm.entries()].map(([arm, cur]) => ({ arm, cap: cur.cap, version: cur.version })),
      slots: [...slotsBySlot.entries()].map(([slot, cur]) => ({ slot, cap: cur.cap, version: cur.version })),
      // 全局臂清单(审查 v3): 面板渲染与臂管理器建作用域都从这里取, 不再各自硬编码 A/B.
      arms: [...arms],
    }
  }

  ctx.provide('capabilityMount', {
    registerArms, registerSlot, scopedWaterfall, attachScopedWaterfall,
    mount, unmount, unmountSlot,
    list, env: () => ({ workdir, python }), bridge,
  })
  console.log('[cap-mount-service] 已就绪, repo=%s, arms=%s', repo, arms.join(','))

  // 插件 dispose: 回收全部挂载.
  return () => {
    for (const [, cur] of armsByArm) {
      for (const f of cur.fibers) {
        try {
          f.dispose()
        } catch (e) {
          // 尽力回收, 但失败必须可见(审查 v3: 静默吞错).
          console.warn('[cap-mount-service] dispose 回收失败(%s@%s): %s', cur.cap, cur.version, e && e.message)
        }
      }
    }
    armsByArm.clear()
    armContexts.clear()
    if (daemonProc !== null) {
      try {
        daemonProc.kill()
      } catch (e) {
        // 尽力回收, 但失败必须可见(审查 v3: 静默吞错).
        console.warn('[cap-mount-service] dispose kill daemon 失败: %s', e && e.message)
      }
      daemonProc = null
    }
  }
}
