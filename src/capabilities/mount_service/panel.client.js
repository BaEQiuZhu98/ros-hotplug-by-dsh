// cap-mount-panel client 半部 - 末端能力面板(架构 v2).
//
// 落盘形态: 本文件内容直接作为动态插件的 code.client(cordis_define), 重启 dsh web 后
// 由 agent 读本文件重新激活. 将来持久化走组合挂载 + tsdown client.
//
// UI: 输入区上方两行(臂 A/B), 每行 grasp1.0.0/grasp1.1.0/suction1.0.0 三键 toggle
//     (点选生效/再点取消, 当前挂载高亮) + 「去拿小球」(把消息发给 agent, 由 agent 判断).
//     标题行: 「刷新」「全部复位」.
return {
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return
    slots.inject('conversation.input.dock', () => slots.register(
      { name: 'conversation.input.dock', id: 'cap-mount-panel', order: 16, label: '末端能力' },
      (props) => {
        const [state, setState] = React.useState({ repo: [], mounted: [] })
        const [note, setNote] = React.useState('')

        function cur(arm) {
          return (state.mounted || []).find((m) => m.arm === arm) || null
        }
        function refresh() {
          host.call('cap_list', {}).then((res) => {
            if (res && res.mounted) setState(res)
            else setNote((res && res.error) || '查询失败')
          }).catch((e) => setNote('失败: ' + String(e && e.message ? e.message : e)))
        }
        React.useEffect(() => { refresh() }, [])

        function call(method, args) {
          host.call(method, args).then((res) => {
            if (res && res.ok) setNote((res.output || 'ok').slice(0, 80))
            else setNote((res && res.error) || '失败')
            refresh()
          }).catch((e) => setNote('失败: ' + String(e && e.message ? e.message : e)))
        }
        function askAgent(arm) {
          const ia = props && props.inputActions
          if (ia && typeof ia.setDraft === 'function' && typeof ia.submit === 'function') {
            ia.setDraft('用臂 ' + arm + ' 去拿小球')
            ia.submit()
            setNote('已把「用臂 ' + arm + ' 去拿小球」发给 agent, 由 agent 判断执行')
          } else {
            setNote('无法发送消息: 缺少 inputActions')
          }
        }

        const btn = { cursor: 'pointer', fontSize: '12px', padding: '2px 8px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', color: '#374151' }
        const btnOn = { cursor: 'pointer', fontSize: '12px', padding: '2px 8px', border: '1px solid #16a34a', borderRadius: '4px', background: '#dcfce7', color: '#14532d', fontWeight: 'bold' }
        const btnGo = { cursor: 'pointer', fontSize: '12px', padding: '2px 8px', border: '1px solid #2563eb', borderRadius: '4px', color: '#1d4ed8', background: '#eff6ff' }
        const btnRst = { cursor: 'pointer', fontSize: '12px', padding: '2px 8px', border: '1px solid #ea580c', borderRadius: '4px', color: '#c2410c', background: '#fff7ed' }
        const rowStyle = { display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0' }
        function b(label, fn, style) { return React.createElement('button', { onClick: fn, style: style || btn }, label) }

        function toolRow(arm) {
          const current = cur(arm)
          function toolBtn(cap, version) {
            const active = current !== null && current.cap === cap && current.version === version
            return b(cap + version, function () {
              if (active) call('arm_unmount', { arm: arm })
              else call('arm_mount', { arm: arm, cap: cap, version: version })
            }, active ? btnOn : btn)
          }
          return React.createElement('div', { key: arm, style: rowStyle },
            React.createElement('span', { style: { fontWeight: 'bold', width: '40px' } }, '臂 ' + arm),
            toolBtn('grasp', '1.0.0'),
            toolBtn('grasp', '1.1.0'),
            toolBtn('suction', '1.0.0'),
            b('去拿小球', function () { askAgent(arm) }, btnGo)
          )
        }

        return React.createElement('div', { style: { fontSize: '12px', padding: '4px 0' } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' } },
            React.createElement('span', { style: { fontWeight: 'bold' } }, '末端能力(装/卸面板, 拿小球交给 agent)'),
            note ? React.createElement('span', { style: { color: '#b45309' } }, note) : null,
            b('刷新', function () { refresh() }),
            b('全部复位', function () { call('reset_all', {}) }, btnRst)
          ),
          toolRow('A'),
          toolRow('B')
        )
      }
    ))
  },
}
