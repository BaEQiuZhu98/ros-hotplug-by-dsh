// capability-mount-service - 能力挂载服务(设计 §7.1 层 0 / §10.3).
//
// host 常驻插件(组合挂载的真实插件, 非动态沙箱: 动态沙箱 ctx 隐藏 ctx.plugin/fiber 等框架内部).
// 职责: 准入检查(sha256 + 规则表) + 臂管理(按臂记录); 末端实例的运行时挂/卸在会话内
// 臂管理器注册的**臂上下文(作用域)**上执行. 提供 'capabilityMount' 服务, 供 web 面板
// (人的唯一写入口)经 RPC 调用; 不注册任何 agent 工具.
//
//   registerArms({A: ctx, B: ctx})  臂管理器(会话内)注册臂上下文; 多会话注册各自追加
//   mount(cap, version, {arm})      准入检查 -> 动态 import -> 在 arm 对应上下文中 ctx.plugin
//                                   -> 同臂防重(同 cap@version 拒绝), 同臂换挂先卸载(替换)
//   unmount(arm)                    该臂全部上下文上的实例 fiber.dispose(只回收本臂)
//   list()                          {repo, mounted: [{arm, cap, version}]}
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
    for (const w of readyWaiters.splice(0)) w.reject(err)
    for (const w of respWaiters.splice(0)) w.reject(err)
  }

  function killDaemon(reason) {
    if (daemonProc === null) return
    const proc = daemonProc
    daemonProc = null
    daemonGeneration += 1
    // 解绑旧代流与事件监听(N2-c): 'exit' 早于流 'close', 旧缓冲行不得再进状态机.
    try { proc.stdout.removeAllListeners('data') } catch (e) {}
    try { proc.stderr.removeAllListeners('data') } catch (e) {}
    try { proc.removeAllListeners('exit') } catch (e) {}
    try { proc.removeAllListeners('error') } catch (e) {}
    daemonStatus = 'down'
    if (reason !== undefined && reason !== null) {
      const text = reason instanceof Error ? reason.message : String(reason)
      console.warn('[cap-mount-service] daemon 已重置: %s', text)
    }
    try { proc.kill() } catch (e) {}
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
          reject(new Error('daemon 响应超时(5s)'))
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


  // arm -> [{ctx, ...}]  臂管理器注册的臂上下文(每会话一套, 追加).
  const armContexts = { A: [], B: [] }
  // arm -> {cap, version, fibers: [{dispose}]}  该臂当前挂载.
  const armsByArm = new Map()

  function sha256(file) {
    return createHash('sha256').update(readFileSync(file)).digest('hex')
  }

  // 仓库清单: repo/<cap>/<version>/manifest.json.
  function listRepo() {
    const out = []
    if (!existsSync(repo)) return out
    for (const cap of readdirSync(repo)) {
      const capDir = join(repo, cap)
      if (!existsSync(join(capDir))) continue
      for (const ver of readdirSync(capDir)) {
        if (existsSync(join(capDir, ver, 'manifest.json'))) out.push({ cap, version: ver })
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
    const actual = sha256(hostFile)
    if (actual !== entry.sha256) {
      return { ok: false, error: '拒绝挂载: 哈希不匹配! 期望 ' + entry.sha256.slice(0, 16) + '... 实际 ' + actual.slice(0, 16) + '... (代码被篡改?)' }
    }
    try {
      const plugin = await import(pathToFileURL(hostFile).href + '?v=' + Date.now())
      return { ok: true, plugin }
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
        // 回收失败不掩盖原始错误.
      }
      return { ok: false, error: '挂载激活失败: ' + (e && e.message) }
    }
    return { ok: true, dispose }
  }

  function registerArms(arms) {
    const registered = []
    for (const arm of ['A', 'B']) {
      if (arms[arm] !== undefined && arms[arm] !== null) {
        armContexts[arm].push(arms[arm])
        registered.push({ arm, ctx: arms[arm] })
      }
    }
    console.log('[cap-mount-service] 臂上下文注册: A=%d 套, B=%d 套', armContexts.A.length, armContexts.B.length)
    // 返回对称注销函数(按对象引用删除): 会话关闭时臂管理器调用, 防悬垂上下文与数组膨胀.
    return function unregisterArms() {
      for (const { arm, ctx: target } of registered) {
        const index = armContexts[arm].indexOf(target)
        if (index !== -1) armContexts[arm].splice(index, 1)
      }
      console.log('[cap-mount-service] 臂上下文注销: A=%d 套, B=%d 套', armContexts.A.length, armContexts.B.length)
    }
  }

  async function doUnmount(arm) {
    const cur = armsByArm.get(arm)
    if (!cur) return { ok: false, error: '臂 ' + arm + ' 没有挂载末端' }
    for (const f of cur.fibers) {
      try {
        await f.dispose()
      } catch (e) {
        // 尽力回收.
      }
    }
    armsByArm.delete(arm)
    return { ok: true, arm, cap: cur.cap, version: cur.version }
  }

  // per-arm 串行队列(P1-6): 同一臂的挂/卸串行化, 防并发交错导致终态不符.
  const armQueues = { A: Promise.resolve(), B: Promise.resolve() }
  function enqueueArm(arm, work) {
    const next = armQueues[arm].then(work, work)
    armQueues[arm] = next.catch(() => {})
    return next
  }

  // 导出面: 校验后入队.
  async function mount(cap, version, options = {}) {
    const arm = options.arm
    if (arm !== 'A' && arm !== 'B') return { ok: false, error: '非法机械臂: ' + (arm || '(未指定)') }
    return enqueueArm(arm, () => doMount(cap, version, options))
  }

  async function unmount(arm) {
    if (arm !== 'A' && arm !== 'B') return { ok: false, error: '非法机械臂: ' + (arm || '(未指定)') }
    return enqueueArm(arm, () => doUnmount(arm))
  }

  async function doMount(cap, version, options = {}) {
    const arm = options.arm
    if (arm !== 'A' && arm !== 'B') return { ok: false, error: '非法机械臂: ' + (arm || '(未指定)') }
    const cur = armsByArm.get(arm)
    if (cur !== undefined && cur.cap === cap && cur.version === version) {
      return { ok: false, error: '臂 ' + arm + ' 已挂载 ' + cap + '@' + version + '(同臂重复挂载拒绝)' }
    }
    // 准入先于任何卸载: 校验失败时旧挂载原封不动(失败回滚语义).
    const loaded = await loadPlugin(cap, version)
    if (!loaded.ok) return loaded
    const contexts = armContexts[arm]
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
            // 尽力回收.
          }
        }
        // 恢复旧实例(尽力而为): 换挂存在短暂窗口期(先摘旧再挂新), 失败后自动恢复旧末端;
        // 恢复成功/失败都显式告警并在返回值中标明(与文档「失败回滚」语义一致).
        if (cur !== undefined) {
          const restored = []
          for (const targetCtx of contexts) {
            const rr = await mountOnContext(targetCtx, cur.plugin, arm)
            if (rr.ok) restored.push({ dispose: rr.dispose })
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
      fibers.push({ dispose: r.dispose })
    }
    armsByArm.set(arm, { cap, version, fibers, plugin: loaded.plugin })
    return { ok: true, arm, cap, version }
  }

  function list() {
    return {
      repo: listRepo(),
      mounted: [...armsByArm.entries()].map(([arm, cur]) => ({ arm, cap: cur.cap, version: cur.version })),
    }
  }

  ctx.provide('capabilityMount', { registerArms, mount, unmount, list, env: () => ({ workdir, python }), bridge })
  console.log('[cap-mount-service] 已就绪, repo=%s', repo)

  // 插件 dispose: 回收全部挂载.
  return () => {
    for (const [, cur] of armsByArm) {
      for (const f of cur.fibers) {
        try {
          f.dispose()
        } catch (e) {
          // 尽力回收.
        }
      }
    }
    armsByArm.clear()
    armContexts.A.length = 0
    armContexts.B.length = 0
    if (daemonProc !== null) {
      try {
        daemonProc.kill()
      } catch (e) {
        // 尽力回收.
      }
      daemonProc = null
    }
  }
}
