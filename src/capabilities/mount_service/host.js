// capability-mount-service - 能力挂载服务(架构 v2 热插拔本体).
//
// host 常驻插件(组合挂载的真实插件, 非动态沙箱: 动态沙箱 ctx 隐藏 ctx.plugin/fiber 等框架内部).
// 提供 'capabilityMount' 服务, 供 web 面板(人的唯一写入口)经 RPC 调用; 不注册任何 agent 工具.
//
//   mount(cap, version, {arm})  1) manifest sha256 校验(零信任) 2) 动态 import 能力 host.js
//                                3) ctx.plugin 挂到机器作用域(工具立即可见, 不重启) 4) 记录臂句柄
//   unmount(arm)                该臂卸载; 该能力已无任何臂引用时 dispose 工具注册(精确回收)
//   list()                      仓库能力清单 + 各臂已挂载清单
//
// 臂间独立 / 同名隔离(与用户确认的语义):
//   - 不同臂可以挂同名能力(如 A/B 各挂 grasp), 互不冲突: 工具全局只注册一次(机器作用域),
//     挂载服务按臂记录引用; 物理末端由 sim_bridge 按臂独立维护(tools: {A, B}).
//   - 同一条臂重复挂同一 cap@version -> 拒绝; 同臂挂别的工具 -> 先卸载再挂(替换).
//   - 同名工具全局注册唯一: 同 cap 多版本并存时, 工具实现取先挂载的版本(DSH 工具名唯一性的自然结果).
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const name = 'capability-mount-service'
export const inject = ['tools']

export function apply(ctx, config = {}) {
  const repo = resolve(config.repo ?? 'src/capabilities/repo')
  const workdir = config.workdir ?? '.'
  const python = config.python ?? 'python3'

  // cap -> {dispose, refs: Set<arm>}   工具注册全局唯一, 多臂共享.
  const registry = new Map()
  // arm -> {cap, version}              该臂当前挂载.
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

  // 校验 manifest + 动态加载能力插件(不注册), 失败返回 {ok:false, error}.
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

  // 把该臂的旧挂载卸下(若该能力已无任何臂引用, 同步回收工具注册).
  async function unmount(arm) {
    const cur = armsByArm.get(arm)
    if (!cur) return { ok: false, error: '臂 ' + arm + ' 没有挂载工具' }
    const entry = registry.get(cur.cap)
    if (entry !== undefined) {
      entry.refs.delete(arm)
      if (entry.refs.size === 0) {
        await entry.dispose()
        registry.delete(cur.cap)
      }
    }
    armsByArm.delete(arm)
    return { ok: true, arm, cap: cur.cap, version: cur.version }
  }

  async function mount(cap, version, options = {}) {
    const arm = options.arm
    if (arm !== undefined) {
      const cur = armsByArm.get(arm)
      if (cur !== undefined && cur.cap === cap && cur.version === version) {
        return { ok: false, error: '臂 ' + arm + ' 已挂载 ' + cap + '@' + version + '(同臂重复挂载拒绝)' }
      }
      // 同臂挂别的工具: 先卸载旧挂载(替换).
      if (cur !== undefined) await unmount(arm)
    }
    const loaded = await loadPlugin(cap, version)
    if (!loaded.ok) return loaded
    // 工具注册全局唯一(机器作用域): 该能力首次挂载时 ctx.plugin, 后续臂共享注册.
    let entry = registry.get(cap)
    if (entry === undefined) {
      let handle
      try {
        handle = ctx.plugin(loaded.plugin, { workdir, python })
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
      entry = { dispose, refs: new Set() }
      registry.set(cap, entry)
    }
    if (arm !== undefined) {
      entry.refs.add(arm)
      armsByArm.set(arm, { cap, version })
    }
    return { ok: true, arm, cap, version }
  }

  function list() {
    return {
      repo: listRepo(),
      mounted: [...armsByArm.entries()].map(([arm, cur]) => ({ arm, cap: cur.cap, version: cur.version })),
    }
  }

  ctx.provide('capabilityMount', { mount, unmount, list })
  console.log('[cap-mount-service] 已就绪, repo=%s', repo)

  // 插件 dispose: 回收全部挂载(工具注册全部注销).
  return () => {
    for (const [, entry] of registry) {
      try {
        entry.dispose()
      } catch (e) {
        // 尽力回收.
      }
    }
    registry.clear()
    armsByArm.clear()
  }
}
