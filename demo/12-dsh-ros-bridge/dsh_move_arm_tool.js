// demo/12 - DSH 侧: 一个 move_arm 工具, 经 rosbridge 调 ROS2.
//
// 这是架构里 "DSH 插件(工具, 经 rosbridge)" 这一层. DSH 的 host 半部跑在
// Node.js 里, 不能直接 import rclpy, 所以它用 shell 服务跑 bridge_client.py,
// 让 bridge_client 去连 rosbridge(WebSocket), 再由 rosbridge 转发给 ROS2.
//
// 用法: 在 cordis 会话里把本文件内容作为 code.host, cordis_define + cordis_run,
//       然后 agent 就能调用 move_arm(q1, q2) 了.

return {
  apply(ctx) {
    const shell = ctx.get('shell')
    if (shell === undefined) return

    const WORKDIR = '/root/my-project/ros-hotplug-by-dsh/demo/12-dsh-ros-bridge'

    harness.registerTool(ctx, harness.defineTool({
      name: 'move_arm',
      description: '让仿真机械臂的两个关节转到指定角度(弧度). 内部经 rosbridge 把指令发到 ROS2 的 arm_server, 由它驱动 MuJoCo 手臂.',
      parameters: {
        q1: { type: 'number', required: true, description: '肩关节角度(弧度)' },
        q2: { type: 'number', required: true, description: '肘关节角度(弧度)' },
      },
      output: {
        schema: { type: 'string' },
        render(_args, value) {
          return [{ type: 'text', text: value }]
        },
      },
      execute(args) {
        // 经 rosbridge 发指令: 运行 bridge_client.py(它连 rosbridge, 发 /joint_command).
        // 用 demo 06 那个 venv 的 python, 因为系统 python3 没装 roslibpy.
        const cmd = '/root/venvs/robo/bin/python3 bridge_client.py ' + args.q1 + ' ' + args.q2
        const spec = shell.resolve({ command: cmd, workdir: WORKDIR, timeoutMs: 10000 })
        return shell.run(spec).then(function (res) {
          const out = ((res.stdout && res.stdout.text) || '') + ((res.stderr && res.stderr.text) || '')
          return out.trim() || ('move_arm 已发送 q1=' + args.q1 + ', q2=' + args.q2)
        })
      },
    }))
  },
}
