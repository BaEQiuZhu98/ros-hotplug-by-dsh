// demo/13 - DSH web 前端: 双臂热插拔面板(配置夹爪/吸盘 + 触碰小球 + 设置小球位置 + 校验).
//
// 分两个半部(各自是 return { apply(ctx){...} }):
//   host 半部  : 提供 configure/touch/set_ball RPC, 做校验, 用 shell 跑 send_cmd.py 经 rosbridge 发指令.
//   client 半部: 渲染两条臂(A/B)的按钮 + 小球位置输入框, 加状态与报错显示.
//
// 用法: host 半部作 code.host、client 半部作 code.client, cordis_define + cordis_run.

// ===================== host 半部(作为 code.host) =====================
return {
  apply(ctx) {
    const shell = ctx.get('shell')
    if (shell === undefined) return
    const WORKDIR = '/root/my-project/ros-hotplug-by-dsh/demo/13-hotplug'
    const PYTHON = '/root/venvs/robo/bin/python3'
    const state = { A: 'none', B: 'none' }

    function sendCmd(topic, payload) {
      const cmd = PYTHON + ' send_cmd.py ' + topic + ' ' + payload
      const spec = shell.resolve({ command: cmd, workdir: WORKDIR, timeoutMs: 10000 })
      return shell.run(spec).then(function (res) {
        const out = ((res.stdout && res.stdout.text) || '') + ((res.stderr && res.stderr.text) || '')
        return { exitCode: res.exitCode, output: out.trim() }
      })
    }

    harness.handle('configure', async (args) => {
      const arm = String(args && args.arm)
      const tool = String(args && args.tool)
      if (arm !== 'A' && arm !== 'B') return { ok: false, error: '非法机械臂: ' + arm }
      if (tool !== 'grasp' && tool !== 'suction') return { ok: false, error: '非法末端执行器: ' + tool + ' (只能是 grasp/suction)' }
      const r = await sendCmd('/tool_config', arm + ':' + tool)
      if (r.exitCode !== 0) return { ok: false, error: '配置失败: ' + r.output }
      state[arm] = tool
      return { ok: true, output: r.output, state: state }
    })

    harness.handle('touch', async (args) => {
      const arm = String(args && args.arm)
      if (arm !== 'A' && arm !== 'B') return { ok: false, error: '非法机械臂: ' + arm }
      if (state[arm] === 'none') return { ok: false, error: '臂 ' + arm + ' 未配置末端执行器, 请先点夹爪/吸盘' }
      const r = await sendCmd('/touch_command', arm)
      if (r.exitCode !== 0) return { ok: false, error: '触碰失败: ' + r.output }
      return { ok: true, output: r.output, state: state }
    })

    harness.handle('set_ball', async (args) => {
      const x = Number(args && args.x)
      const y = Number(args && args.y)
      if (isNaN(x) || isNaN(y)) return { ok: false, error: '小球位置必须是数字' }
      const r = await sendCmd('/ball_position', x + ',' + y)
      if (r.exitCode !== 0) return { ok: false, error: '设置小球失败: ' + r.output }
      return { ok: true, output: r.output, state: state }
    })

    harness.handle('status', async () => { return { ok: true, state: state } })
  },
}

// ===================== client 半部(作为 code.client) =====================
return {
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return
    slots.inject('conversation.input.dock', () => slots.register(
      { name: 'conversation.input.dock', id: 'ros-hotplug-panel', order: 18, label: '双臂热插拔' },
      (props) => {
        const [state, setState] = React.useState({ A: 'none', B: 'none' })
        const [bx, setBx] = React.useState('0.5')
        const [by, setBy] = React.useState('0.0')
        const [note, setNote] = React.useState('')
        function call(method, args) {
          host.call(method, args).then((res) => {
            if (res && res.ok) { if (res.state) setState(res.state); setNote(res.output || '成功') }
            else setNote((res && res.error) || '失败')
          }).catch((e) => setNote('失败: ' + String(e && e.message ? e.message : e)))
        }
        function toolName(arm) { return state[arm] === 'grasp' ? '夹爪' : (state[arm] === 'suction' ? '吸盘' : '无') }
        const btnStyle = { cursor: 'pointer', fontSize: '12px', padding: '2px 8px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff' }
        const btnTouch = { cursor: 'pointer', fontSize: '12px', padding: '2px 8px', border: '1px solid #2563eb', borderRadius: '4px', color: '#1d4ed8', background: '#eff6ff' }
        const inputStyle = { width: '46px', margin: '0 3px', fontSize: '12px' }
        function b(label, fn, style) { return React.createElement('button', { onClick: fn, style: style }, label) }
        function armRow(arm) {
          return React.createElement('div', { key: arm, style: { display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0' } },
            React.createElement('span', { style: { fontWeight: 'bold', width: '44px' } }, '臂 ' + arm),
            React.createElement('span', { style: { color: '#6b7280', width: '40px' } }, toolName(arm)),
            b('夹爪', function () { call('configure', { arm: arm, tool: 'grasp' }) }, btnStyle),
            b('吸盘', function () { call('configure', { arm: arm, tool: 'suction' }) }, btnStyle),
            b('触碰小球', function () { call('touch', { arm: arm }) }, btnTouch),
          )
        }
        function ballRow() {
          return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0' } },
            React.createElement('span', { style: { fontWeight: 'bold', width: '44px' } }, '小球'),
            React.createElement('span', null, 'x'),
            React.createElement('input', { value: bx, onChange: (e) => setBx(e.target.value), style: inputStyle }),
            React.createElement('span', null, 'y'),
            React.createElement('input', { value: by, onChange: (e) => setBy(e.target.value), style: inputStyle }),
            b('设置', function () { call('set_ball', { x: bx, y: by }) }, btnTouch),
          )
        }
        return React.createElement('div', { style: { fontSize: '12px', padding: '4px 0' } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' } },
            React.createElement('span', { style: { fontWeight: 'bold' } }, '双臂热插拔'),
            note ? React.createElement('span', { style: { color: '#b45309' } }, note) : null
          ),
          armRow('A'),
          armRow('B'),
          ballRow(),
        )
      }
    ))
  },
}
