// cap-mount-panel host 半部 - 末端能力面板(架构 v2, 臂隔离 API).
//
// 落盘形态: 本文件内容直接作为动态插件的 code.host(cordis_define), 重启 dsh web 后
// 由 agent 读本文件重新激活(动态插件不继承). 将来持久化走组合挂载 + tsdown client.
//
// 面板职责(与用户确认): 只装/卸末端 + 发指令; 拿小球交给 agent 判断执行.
//   - 点工具按钮 = 该臂挂载能力 + set_tool 物理生效; 再点 = 卸载 + 末端复位.
//   - 臂间独立: A/B 可挂同名能力(挂载服务按臂管理); 同臂重复挂同版本被挂载服务拒绝.
//   - 「去拿小球」= 把消息发给 agent(client 用 inputActions), 不在 host 执行.
return {
  name: 'cap-mount-panel',
  inject: ['capabilityMount', 'shell'],
  apply(ctx) {
    const svc = ctx.capabilityMount
    // 工作路径与 venv python 统一从挂载服务取(唯一路径来源, setup.sh 写入组合 config).
    const env = svc.env()
    const WORKDIR = env.workdir
    const PYTHON = env.python

    function runCli(method, argv) {
      const cmd = [PYTHON, WORKDIR + '/src/bridge/bridge_client.py', method, ...argv].join(' ')
      const spec = ctx.shell.resolve({ command: cmd, workdir: WORKDIR, timeoutMs: 15000 })
      return ctx.shell.run(spec).then((res) => ((res.stdout && res.stdout.text) || '').trim())
    }

    harness.handle('cap_list', async () => svc.list())

    harness.handle('arm_mount', async (args) => {
      const arm = String(args && args.arm)
      const cap = String(args && args.cap)
      const version = String(args && args.version)
      if (arm !== 'A' && arm !== 'B') return { ok: false, error: '非法机械臂: ' + arm }
      const r = await svc.mount(cap, version, { arm })
      if (!r.ok) return r
      const st = await runCli('set_tool', [arm, cap])
      return { ok: true, arm: arm, cap: r.cap, version: r.version, output: st }
    })

    harness.handle('arm_unmount', async (args) => {
      const arm = String(args && args.arm)
      const r = await svc.unmount(arm)
      if (!r.ok) return r
      await runCli('set_tool', [arm, 'none'])
      return { ok: true, arm: arm, output: '已卸载 ' + r.cap + '@' + r.version + ', 末端复位' }
    })

    harness.handle('reset_all', async () => {
      for (const arm of ['A', 'B']) {
        const r = await svc.unmount(arm)
        if (r.ok) await runCli('set_tool', [arm, 'none'])
      }
      const st = await runCli('reset', [])
      return { ok: true, output: st || '已全部复位' }
    })
  },
}
