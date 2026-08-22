// demo/12 - DSH web 前端插件: 输入机械臂末端位置, 经 rosbridge 驱动 MuJoCo 手臂.
//
// 这是"可视化闭环"的前端入口. 分两个半部(各自是一个 return { apply(ctx){...} } 函数体):
//   host 半部  : 提供 move_ee RPC, 用 shell 跑 move_ee.py(末端位置 -> IK -> rosbridge).
//   client 半部: 在输入区上方渲染面板, 输入 x/y, 点"发送"调 host 的 move_ee.
//
// 用法: 把下面的 host 半部作为 code.host、client 半部作为 code.client,
//       cordis_define + cordis_run.

// ===================== host 半部(作为 code.host) =====================
return {
  apply(ctx) {
    const shell = ctx.get('shell')
    if (shell === undefined) return
    const WORKDIR = '/root/my-project/ros-hotplug-by-dsh/demo/12-dsh-ros-bridge'
    const PYTHON = '/root/venvs/robo/bin/python3'

    harness.handle('move_ee', async (args) => {
      const x = Number(args && args.x)
      const y = Number(args && args.y)
      if (isNaN(x) || isNaN(y)) return { ok: false, error: 'x/y 必须是数字' }
      const cmd = PYTHON + ' move_ee.py ' + x + ' ' + y
      const spec = shell.resolve({ command: cmd, workdir: WORKDIR, timeoutMs: 10000 })
      const res = await shell.run(spec)
      const out = ((res.stdout && res.stdout.text) || '') + ((res.stderr && res.stderr.text) || '')
      return { ok: true, output: out.trim() }
    })
  },
}

// ===================== client 半部(作为 code.client) =====================
return {
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return
    slots.inject('conversation.input.dock', () => slots.register(
      { name: 'conversation.input.dock', id: 'ros-arm-panel', order: 17, label: '机械臂控制' },
      (props) => {
        const [x, setX] = React.useState('0.5')
        const [y, setY] = React.useState('0.3')
        const [note, setNote] = React.useState('')
        function send() {
          setNote('发送中...')
          host.call('move_ee', { x: x, y: y }).then((res) => {
            if (res && res.ok) setNote(res.output || '已发送')
            else setNote('失败: ' + ((res && res.error) || ''))
          }).catch((e) => setNote('失败: ' + String(e && e.message ? e.message : e)))
        }
        const inputStyle = { width: '60px', margin: '0 4px', fontSize: '12px' }
        return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '4px 0' } },
          React.createElement('span', { style: { fontWeight: 'bold' } }, '机械臂末端'),
          React.createElement('span', null, 'x'),
          React.createElement('input', { value: x, onChange: (e) => setX(e.target.value), style: inputStyle }),
          React.createElement('span', null, 'y'),
          React.createElement('input', { value: y, onChange: (e) => setY(e.target.value), style: inputStyle }),
          React.createElement('button', { onClick: send, style: { cursor: 'pointer', fontSize: '12px' } }, '发送'),
          note ? React.createElement('span', { style: { color: '#6b7280' } }, note) : null
        )
      }
    ))
  },
}
