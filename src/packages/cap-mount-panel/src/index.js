// cap-mount-panel host 半部 - 末端能力面板(架构 v2, 臂隔离 API, 树外包持久化形态).
//
// 通道: webServer 注册同源 JSON 路由 /cap-mount/*(client 半部 fetch 调用, 见 src/client/index.js).
// 臂名合法性由挂载服务校验(config.arms 唯一权威), 本半部只转发, 不重复硬编码 A/B(审查 v3).
//
// 安装: setup.sh 把本包复制进 profile node_modules, 并把本行写入 profile 的
// cordis.patch.yml(id: cap-mount-panel, name: @ros-hotplug/dsh-plugin-cap-mount-panel).
// 面板职责(与用户确认): 只装/卸末端 + 发指令; 拿小球交给 agent 判断执行.
//   - 点工具按钮 = 该臂挂载能力 + set_tool 物理生效; 再点 = 卸载 + 末端复位.
//   - 臂间独立: 各臂可挂同名能力(挂载服务按臂管理); 同臂重复挂同版本被挂载服务拒绝.
//   - 「去拿小球」= 把消息发给 agent(client 用 inputActions), 不在 host 执行.
//   - 物理装配与挂载同走挂载服务常驻 bridge(P2-10): rosbridge 连接全程常驻.
//   - 物理装配回执校验(T-A-19): set_tool 后 query_capabilities 回读比对,
//     sim_bridge 停/超时/值不符 → physical.ok=false(挂载逻辑仍成功, 分离展示).

export const inject = ['capabilityMount', 'webServer']

export function apply(ctx) {
  const svc = ctx.capabilityMount

  // 回读校验: 物理末端确实切到期望值才算装配成功(最多查两次, 中间等一个回传周期).
  async function verifyPhysical(arm, expect) {
    const q1 = await svc.bridge('query_capabilities', [])
    if (q1.ok === true && q1.caps && q1.caps.tools && q1.caps.tools[arm] === expect) {
      return { ok: true, detail: '' }
    }
    await new Promise((r) => setTimeout(r, 300))
    const q2 = await svc.bridge('query_capabilities', [])
    if (q2.ok === true && q2.caps && q2.caps.tools && q2.caps.tools[arm] === expect) {
      return { ok: true, detail: '' }
    }
    const detail = q2.ok === true
      ? ('物理末端未生效: ' + String(q2.caps.tools[arm]) + ' != ' + expect)
      : JSON.stringify(q2)
    return { ok: false, detail: detail }
  }

  function fail(res, code, error) {
    const text = JSON.stringify({ ok: false, error: error })
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(text)
  }

  // 方法分发: 臂名合法性由挂载服务 mount/unmount 统一校验(臂清单唯一权威).
  async function dispatch(method, args) {
    switch (method) {
      case 'cap_list': {
        return svc.list()
      }
      case 'query_state': {
        // 刷新统一入口: 挂载清单 + 物理状态(小球位置/末端/关节)一次拿全.
        const list = svc.list()
        const caps = await svc.bridge('query_capabilities', [])
        return {
          ok: true, list: list,
          caps: caps.ok === true ? caps.caps : null,
          capsError: caps.ok === true ? '' : String(caps.error || JSON.stringify(caps)),
        }
      }
      case 'set_ball': {
        // 设定小球 XY 位置(x/y 必须是数字; 有限性由 bridge/sim 侧校验).
        const x = args && args.x
        const y = args && args.y
        if (x === undefined || x === null || x === '' || y === undefined || y === null || y === '') {
          return { ok: false, error: '缺少小球位置(x 和 y 都要填)' }
        }
        const r = await svc.bridge('set_ball', [Number(x), Number(y)])
        if (r.ok !== true) return r
        // 回读确认小球位置已更新(用户设定后立即看到实际位置).
        const q = await svc.bridge('query_capabilities', [])
        const ball = q.ok === true && q.caps && Array.isArray(q.caps.ball) ? q.caps.ball : null
        return { ok: true, output: '小球已设定到 (' + x + ', ' + y + ')', ball: ball }
      }
      case 'arm_reset': {
        // 单臂复位: 卸载该臂挂载(无挂载也继续) + 物理末端复位 none + 关节回原位(伸直).
        const arm = String(args && args.arm)
        const listed = svc.list()
        if (!(listed.arms || []).includes(arm)) return { ok: false, error: '非法机械臂: ' + arm }
        const hadMount = (listed.mounted || []).some((m) => m.arm === arm)
        let unloaded = null
        if (hadMount) {
          const r = await svc.unmount(arm)
          if (!r.ok) return r
          unloaded = r
        }
        const ph = await svc.bridge('set_tool', [arm, 'none'])
        const home = await svc.bridge('home', [arm])
        return {
          ok: true, arm: arm,
          output: unloaded !== null ? ('已卸载 ' + unloaded.cap + '@' + unloaded.version + ', 末端复位, 回原位') : '该臂无挂载, 末端复位, 回原位',
          physical: { ok: ph.ok === true, output: JSON.stringify(ph) },
          home: { ok: home.ok === true, output: JSON.stringify(home) },
        }
      }
      case 'arm_mount': {
        const arm = String(args && args.arm)
        const cap = String(args && args.cap)
        const version = String(args && args.version)
        const r = await svc.mount(cap, version, { arm })
        if (!r.ok) return r
        // 挂载结果与物理装配结果分离: 挂载成功即 ok, 装配失败单独在 physical 字段标明.
        const ph = await svc.bridge('set_tool', [arm, cap])
        if (ph.ok !== true) {
          return { ok: true, arm: arm, cap: r.cap, version: r.version, physical: { ok: false, output: JSON.stringify(ph) } }
        }
        const verify = await verifyPhysical(arm, cap)
        return {
          ok: true, arm: arm, cap: r.cap, version: r.version,
          physical: verify.ok
            ? { ok: true, output: JSON.stringify(ph) }
            : { ok: false, output: JSON.stringify(ph) + ' | 回读校验: ' + verify.detail },
        }
      }
      case 'arm_unmount': {
        const arm = String(args && args.arm)
        const r = await svc.unmount(arm)
        if (!r.ok) return r
        const ph = await svc.bridge('set_tool', [arm, 'none'])
        if (ph.ok !== true) {
          return { ok: true, arm: arm, output: '已卸载 ' + r.cap + '@' + r.version + ', 末端复位', physical: { ok: false, output: JSON.stringify(ph) } }
        }
        const verify = await verifyPhysical(arm, 'none')
        return {
          ok: true, arm: arm, output: '已卸载 ' + r.cap + '@' + r.version + ', 末端复位',
          physical: verify.ok
            ? { ok: true, output: JSON.stringify(ph) }
            : { ok: false, output: JSON.stringify(ph) + ' | 回读校验: ' + verify.detail },
        }
      }
      case 'slot_mount': {
        // 感知槽挂载(sensor 类): 无物理装配(sensor 不改变物理末端), 直接返回挂载结果.
        const slot = (args && args.slot) ? String(args.slot) : ''
        const cap = String(args && args.cap)
        const version = String(args && args.version)
        if (!slot) return { ok: false, error: '缺少槽位参数' }
        return svc.mount(cap, version, { slot })
      }
      case 'slot_unmount': {
        const slot = (args && args.slot) ? String(args.slot) : ''
        if (!slot) return { ok: false, error: '缺少槽位参数' }
        return svc.unmountSlot(slot)
      }
      case 'reset_all': {
        const arms = Array.isArray(svc.list().arms) ? svc.list().arms : []
        for (const arm of arms) {
          const r = await svc.unmount(arm)
          if (r.ok) await svc.bridge('set_tool', [arm, 'none'])
        }
        for (const slot of (svc.list().slots || []).map((s) => s.slot)) {
          await svc.unmountSlot(slot)
        }
        const ph = await svc.bridge('reset', [])
        return { ok: true, output: '已全部复位', physical: { ok: ph.ok === true, output: JSON.stringify(ph) } }
      }
      default:
        return { ok: false, error: '未知方法: ' + method }
    }
  }

  // 同源 JSON 路由: POST /cap-mount/<method>, body 为 JSON 参数对象.
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/cap-mount',
    handler: async (req, res) => {
      try {
        const pathname = new URL(req.url, 'http://localhost').pathname
        const method = pathname.slice('/cap-mount'.length + 1)
        let body = ''
        for await (const chunk of req) body += chunk
        let args = {}
        if (body !== '') {
          try { args = JSON.parse(body) } catch { return fail(res, 400, '请求体不是合法 JSON') }
        }
        const out = await dispatch(method, args)
        const text = JSON.stringify(out)
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(text)
      } catch (e) {
        fail(res, 500, '面板服务异常: ' + String(e && e.message ? e.message : e))
      }
    },
  }), 'cap-mount-panel: /cap-mount route')
}
