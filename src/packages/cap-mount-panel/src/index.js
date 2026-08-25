// cap-mount-panel host 半部 - 末端能力面板(架构 v2, 臂隔离 API, 树外包持久化形态).
//
// 与 src/capabilities/mount_service/panel.host.js 语义完全一致(动态插件演示形态),
// 差异只在通道: 动态插件用包私有 harness.handle, 树外包用 webServer 注册
// 同源 JSON 路由 /cap-mount/*(client 半部 fetch 调用, 见 src/client/index.js).
//
// 安装: setup.sh 把本包复制进 profile node_modules, 并把本行写入 profile 的
// cordis.patch.yml(id: cap-mount-panel, name: @ros-hotplug/dsh-plugin-cap-mount-panel).
// 面板职责(与用户确认): 只装/卸末端 + 发指令; 拿小球交给 agent 判断执行.
//   - 点工具按钮 = 该臂挂载能力 + set_tool 物理生效; 再点 = 卸载 + 末端复位.
//   - 臂间独立: A/B 可挂同名能力(挂载服务按臂管理); 同臂重复挂同版本被挂载服务拒绝.
//   - 「去拿小球」= 把消息发给 agent(client 用 inputActions), 不在 host 执行.
//   - 物理装配与挂载同走挂载服务常驻 bridge(P2-10): rosbridge 连接全程常驻.

export const inject = ['capabilityMount', 'webServer']

export function apply(ctx) {
  const svc = ctx.capabilityMount

  function fail(res, code, error) {
    const text = JSON.stringify({ ok: false, error: error })
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(text)
  }

  // 方法分发: 与 panel.host.js 的 harness 方法同名同义.
  async function dispatch(method, args) {
    switch (method) {
      case 'cap_list': {
        return svc.list()
      }
      case 'arm_mount': {
        const arm = String(args && args.arm)
        const cap = String(args && args.cap)
        const version = String(args && args.version)
        if (arm !== 'A' && arm !== 'B') return { ok: false, error: '非法机械臂: ' + arm }
        const r = await svc.mount(cap, version, { arm })
        if (!r.ok) return r
        // 挂载结果与物理装配结果分离: 挂载成功即 ok, 装配失败单独在 physical 字段标明.
        const ph = await svc.bridge('set_tool', [arm, cap])
        return { ok: true, arm: arm, cap: r.cap, version: r.version, physical: { ok: ph.ok === true, output: JSON.stringify(ph) } }
      }
      case 'arm_unmount': {
        const arm = String(args && args.arm)
        const r = await svc.unmount(arm)
        if (!r.ok) return r
        const ph = await svc.bridge('set_tool', [arm, 'none'])
        return { ok: true, arm: arm, output: '已卸载 ' + r.cap + '@' + r.version + ', 末端复位', physical: { ok: ph.ok === true, output: JSON.stringify(ph) } }
      }
      case 'reset_all': {
        for (const arm of ['A', 'B']) {
          const r = await svc.unmount(arm)
          if (r.ok) await svc.bridge('set_tool', [arm, 'none'])
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
