// cap-mount-panel client 半部 - 能力面板(架构 v2 + 感知槽扩展 + 小球设定 + 折叠, 树外包持久化形态).
//
// 通道: 同源 fetch 调 host 半部的 /cap-mount/* 路由(见 src/index.js). React 经模块表基线
// require('react') 获取(tsdown 把它保留为外部依赖).
//
// UI 布局(自上而下, 标题行可折叠/展开, 折叠时只占一行):
//   ① 操作行: 刷新 | 全部复位 | 每臂一个「臂X复位」| 折叠/展开;
//   ② 臂行(按挂载服务全局臂清单, 默认 A/B): 每臂一行, 下拉框选择「不装配」/各末端
//     版本(仅 end-effector 类), 行尾显示物理末端;
//   ③ 感知行: 一行, 下拉框选择「不装配」/各感知能力(sensor 类, 挂载是时间点操作,
//     只作用于已存在会话);
//   ④ 拿小球行: 下拉框选择「不指定臂/臂A/臂B」+「去拿小球」(把消息发给 agent,
//     由 agent 判断执行);
//   ⑤ 小球行: 显示小球当前位置 + x/y 输入 + 「设定」(set_ball 立即生效); 点刷新
//     后显示小球当前具体位置.
import React from 'react'

export const inject = ['slots']

export function apply(ctx) {
  const slots = ctx.get('slots')
  if (slots === undefined) return
  slots.inject('conversation.input.dock', () => slots.register(
    { name: 'conversation.input.dock', id: 'cap-mount-panel', order: 16, label: '能力面板' },
    (props) => {
      const [state, setState] = React.useState({ repo: [], mounted: [], slots: [], arms: [] })
      const [caps, setCaps] = React.useState(null)
      const [note, setNote] = React.useState('')
      const [ballX, setBallX] = React.useState('')
      const [ballY, setBallY] = React.useState('')
      const [collapsed, setCollapsed] = React.useState(false)
      const [takeArm, setTakeArm] = React.useState('any')

      // 同源 RPC: 与 host 半部的 /cap-mount/<method> 路由一一对应.
      function rpc(method, args) {
        return fetch('/cap-mount/' + method, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args || {}),
        }).then(function (r) { return r.json() })
      }

      function cur(arm) {
        return (state.mounted || []).find((m) => m.arm === arm) || null
      }
      function curSlot(slot) {
        return (state.slots || []).find((s) => s.slot === slot) || null
      }
      function refresh() {
        rpc('query_state', {}).then((res) => {
          if (res && res.ok && res.list) {
            setState(res.list)
            setCaps(res.caps || null)
            if (res.caps && Array.isArray(res.caps.ball)) {
              setBallX(String(res.caps.ball[0]))
              setBallY(String(res.caps.ball[1]))
            }
            setNote(res.capsError || '')
          } else setNote((res && res.error) || '查询失败')
        }).catch((e) => setNote('失败: ' + String(e && e.message ? e.message : e)))
      }
      React.useEffect(() => { refresh() }, [])

      function call(method, args) {
        rpc(method, args).then((res) => {
          if (res && res.ok) {
            if (res.physical && res.physical.ok === false) {
              setNote('挂载成功, 但物理装配失败: ' + String(res.physical.output || '').slice(0, 60))
            } else if (res.home && res.home.ok === false) {
              setNote('已复位装配, 但回原位失败: ' + String(res.home.output || '').slice(0, 60))
            } else {
              setNote((res.output || 'ok').slice(0, 100))
            }
          } else setNote((res && res.error) || '失败')
          refresh()
        }).catch((e) => setNote('失败: ' + String(e && e.message ? e.message : e)))
      }
      function askAgent() {
        const ia = props && props.inputActions
        if (ia && typeof ia.setDraft === 'function' && typeof ia.submit === 'function') {
          const text = takeArm === 'any' ? '去拿小球' : '用臂 ' + takeArm + ' 去拿小球'
          ia.setDraft(text)
          ia.submit()
          setNote('已把「' + text + '」发给 agent, 由 agent 判断执行')
        } else {
          setNote('无法发送消息: 缺少 inputActions')
        }
      }

      const btn = { cursor: 'pointer', fontSize: '12px', padding: '2px 8px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', color: '#374151' }
      const btnGo = { cursor: 'pointer', fontSize: '12px', padding: '2px 8px', border: '1px solid #2563eb', borderRadius: '4px', color: '#1d4ed8', background: '#eff6ff' }
      const btnRst = { cursor: 'pointer', fontSize: '12px', padding: '2px 8px', border: '1px solid #ea580c', borderRadius: '4px', color: '#c2410c', background: '#fff7ed' }
      const selStyle = { fontSize: '12px', padding: '2px 4px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', color: '#374151', maxWidth: '150px' }
      const inpStyle = { fontSize: '12px', padding: '2px 4px', width: '48px', border: '1px solid #d1d5db', borderRadius: '4px' }
      const rowStyle = { display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0', flexWrap: 'wrap' }
      function b(label, fn, style) { return React.createElement('button', { onClick: fn, style: style || btn }, label) }

      // 臂行清单: 来自挂载服务全局臂清单(审查 v3: 去 A/B 硬编码); 空清单回退默认 A/B 保证兼容.
      const rowArms = Array.isArray(state.arms) && state.arms.length > 0 ? state.arms : ['A', 'B']

      // 下拉框选项: 「不装配」+ 仓库清单(按 kind 过滤); 当前装配若不在仓库中仍列出.
      function mountOptions(kind, current) {
        const options = [{ v: 'none', label: '不装配' }]
        for (const item of (state.repo || [])) {
          const match = kind === 'sensor' ? item.kind === 'sensor' : item.kind !== 'sensor'
          if (!match) continue
          options.push({ v: item.cap + '@' + item.version, label: item.cap + ' ' + item.version })
        }
        if (current !== null && !options.some((o) => o.v === current.cap + '@' + current.version)) {
          options.push({ v: current.cap + '@' + current.version, label: '当前: ' + current.cap + ' ' + current.version })
        }
        return options
      }

      function armRow(arm) {
        const current = cur(arm)
        const key = current === null ? 'none' : current.cap + '@' + current.version
        const options = mountOptions('tool', current)
        const physical = caps && caps.tools ? caps.tools[arm] : undefined
        const select = React.createElement('select', {
          value: key,
          onChange: function (e) {
            const v = e.target.value
            if (v === 'none') call('arm_unmount', { arm: arm })
            else {
              const parts = v.split('@')
              call('arm_mount', { arm: arm, cap: parts[0], version: parts[1] })
            }
          },
          style: selStyle,
        }, options.map((o) => React.createElement('option', { key: o.v, value: o.v }, o.label)))
        return React.createElement('div', { key: arm, style: rowStyle },
          React.createElement('span', { style: { fontWeight: 'bold', width: '40px' } }, '臂 ' + arm),
          select,
          physical !== undefined
            ? React.createElement('span', { style: { color: '#6b7280' } }, '物理: ' + physical)
            : null
        )
      }

      function perceptionRow() {
        const slot = 'perception'
        const current = curSlot(slot)
        const sensors = (state.repo || []).filter(function (item) { return item.kind === 'sensor' })
        if (sensors.length === 0) return null
        const key = current === null ? 'none' : current.cap + '@' + current.version
        const options = mountOptions('sensor', current)
        const select = React.createElement('select', {
          value: key,
          onChange: function (e) {
            const v = e.target.value
            if (v === 'none') call('slot_unmount', { slot: slot })
            else {
              const parts = v.split('@')
              call('slot_mount', { slot: slot, cap: parts[0], version: parts[1] })
            }
          },
          style: selStyle,
        }, options.map((o) => React.createElement('option', { key: o.v, value: o.v }, o.label)))
        return React.createElement('div', { style: rowStyle },
          React.createElement('span', { style: { fontWeight: 'bold', width: '40px' } }, '感知'),
          select
        )
      }

      function takeRow() {
        const select = React.createElement('select', {
          value: takeArm,
          onChange: function (e) { setTakeArm(e.target.value) },
          style: selStyle,
        },
          React.createElement('option', { value: 'any' }, '不指定臂'),
          ...rowArms.map(function (arm) {
            return React.createElement('option', { key: arm, value: arm }, '臂 ' + arm)
          })
        )
        return React.createElement('div', { style: rowStyle },
          React.createElement('span', { style: { fontWeight: 'bold', width: '40px' } }, '拿小球'),
          select,
          b('去拿小球', function () { askAgent() }, btnGo)
        )
      }

      function ballRow() {
        const ball = caps && Array.isArray(caps.ball) ? caps.ball : null
        return React.createElement('div', { style: rowStyle },
          React.createElement('span', { style: { fontWeight: 'bold', width: '40px' } }, '小球'),
          React.createElement('span', { style: { color: '#6b7280' } },
            '位置: ' + (ball === null ? '未查询' : Number(ball[0]).toFixed(2) + ', ' + Number(ball[1]).toFixed(2))),
          React.createElement('input', {
            value: ballX, placeholder: 'x',
            onChange: function (e) { setBallX(e.target.value) }, style: inpStyle,
          }),
          React.createElement('input', {
            value: ballY, placeholder: 'y',
            onChange: function (e) { setBallY(e.target.value) }, style: inpStyle,
          }),
          b('设定', function () { call('set_ball', { x: ballX, y: ballY }) })
        )
      }

      const header = React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
        React.createElement('span', { style: { fontWeight: 'bold' } }, '能力面板'),
        note ? React.createElement('span', { style: { color: '#b45309' } }, note) : null,
        b('刷新', function () { refresh() }),
        b('全部复位', function () { call('reset_all', {}) }, btnRst),
        ...rowArms.map(function (arm) {
          return b('臂' + arm + '复位', function () { call('arm_reset', { arm: arm }) }, btnRst)
        }),
        b(collapsed ? '展开' : '折叠', function () { setCollapsed(!collapsed) })
      )

      return React.createElement('div', { style: { fontSize: '12px', padding: '4px 0' } },
        header,
        collapsed ? null : React.createElement('div', null,
          ...rowArms.map(function (arm) { return armRow(arm) }),
          perceptionRow(),
          takeRow(),
          ballRow()
        )
      )
    }
  ))
}
