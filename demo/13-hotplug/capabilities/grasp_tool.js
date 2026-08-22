// demo/13 - 能力工具: grasp(夹爪). 一个动态插件, 注册一个 grasp 工具.
//
// 这是"能力 = DSH 插件工具"的最小实现: execute 用 shell 跑 send_capability.py,
// 经 rosbridge 把 "grasp" 发到 /capability_command, robot_server 把末端执行器切到夹爪.
//
// 用法: 把本文件作为 code.host, cordis_define + cordis_run(挂载前先用 mount_guard 校验).

return {
  apply(ctx) {
    const shell = ctx.get('shell')
    if (shell === undefined) return
    const WORKDIR = '/root/my-project/ros-hotplug-by-dsh/demo/13-hotplug'
    const PYTHON = '/root/venvs/robo/bin/python3'

    harness.registerTool(ctx, harness.defineTool({
      name: 'grasp',
      description: '把机械臂末端执行器切到"夹爪", 并执行抓取动作.',
      parameters: {},
      output: {
        schema: { type: 'string' },
        render(_args, value) { return [{ type: 'text', text: value }] },
      },
      execute(args) {
        const cmd = PYTHON + ' send_capability.py grasp'
        const spec = shell.resolve({ command: cmd, workdir: WORKDIR, timeoutMs: 10000 })
        return shell.run(spec).then(function (res) {
          const out = ((res.stdout && res.stdout.text) || '') + ((res.stderr && res.stderr.text) || '')
          return out.trim() || 'grasp 已触发'
        })
      },
    }))
  },
}
