// demo/13 - 能力工具: suction(吸盘). 一个动态插件, 注册一个 suction 工具.
//
// 与 grasp_tool.js 结构完全相同, 只是能力名不同. 经 rosbridge 把 "suction"
// 发到 /capability_command, robot_server 把末端执行器切到吸盘.
//
// 用法: 把本文件作为 code.host, cordis_define + cordis_run(挂载前先用 mount_guard 校验).

return {
  apply(ctx) {
    const shell = ctx.get('shell')
    if (shell === undefined) return
    const WORKDIR = '/root/my-project/ros-hotplug-by-dsh/demo/13-hotplug'
    const PYTHON = '/root/venvs/robo/bin/python3'

    harness.registerTool(ctx, harness.defineTool({
      name: 'suction',
      description: '把机械臂末端执行器切到"吸盘", 并执行吸附动作.',
      parameters: {},
      output: {
        schema: { type: 'string' },
        render(_args, value) { return [{ type: 'text', text: value }] },
      },
      execute(args) {
        const cmd = PYTHON + ' send_capability.py suction'
        const spec = shell.resolve({ command: cmd, workdir: WORKDIR, timeoutMs: 10000 })
        return shell.run(spec).then(function (res) {
          const out = ((res.stdout && res.stdout.text) || '') + ((res.stderr && res.stderr.text) || '')
          return out.trim() || 'suction 已触发'
        })
      },
    }))
  },
}
