// cap-mount-panel client 半部 - 能力面板(架构 v2 + 感知槽扩展, 树外包持久化形态).
//
// 通道: 同源 fetch 调 host 半部的 /cap-mount/* 路由(见 src/index.js). React 经模块表基线
// require('react') 获取(tsdown 把它保留为外部依赖).
//
// UI: 输入区上方渲染 ① 末端区: 按挂载服务全局臂清单(默认 A/B)每臂一行, 挂/卸 end-effector
//     类能力 + 「去拿小球」(把消息发给 agent, 由 agent 判断); ② 感知区: 一行, 挂/卸 sensor
//     类能力(按 manifest kind 分组渲染; 挂载是时间点操作, 只作用于已存在会话).
//     标题行: 「刷新」「全部复位」.
import React from 'react'

export const inject = ['slots']

export function apply(ctx) {
  const slots = ctx.get('slots')
  if (slots === undefined) return
  slots.inject('conversation.input.dock', () => slots.register(
    { name: 'conversation.input.dock', id: 'cap-mount-panel', order: 16, label: '能力面板' },
    (props) => {
      const [state, setState] = React.useState({ repo: [], mounted: [], slots: [], arms: [] })
      const [note, setNote] = React.useState('')

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
        rpc('cap_list', {}).then((res) => {
          if (res && res.repo) setState(res)
          else setNote((res && res.error) || '查询失败')
        }).catch((e) => setNote('失败: ' + String(e && e.message ? e.message : e)))
      }
      React.useEffect(() => { refresh() }, [])

      function call(method, args) {
        rpc(method, args).then((res) => {
          if (res && res.ok) {
            if (res.physical && res.physical.ok === false) {
              setNote('挂载成功, 但物理装配失败: ' + String(res.physical.output || '').slice(0, 60))
            } else {
              setNote((res.output || 'ok').slice(0, 80))
            }
          } else setNote((res && res.error) || '失败')
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
        // 按钮由能力仓库清单(repo)动态渲染(仅 end-effector 类): 加新末端只需放 repo 目录.
        function toolBtn(cap, version) {
          const active = current !== null && current.cap === cap && current.version === version
          return b(cap + version, function () {
            if (active) call('arm_unmount', { arm: arm })
            else call('arm_mount', { arm: arm, cap: cap, version: version })
          }, active ? btnOn : btn)
        }
        return React.createElement('div', { key: arm, style: rowStyle },
          React.createElement('span', { style: { fontWeight: 'bold', width: '40px' } }, '臂 ' + arm),
          ...((state.repo || []).filter(function (item) { return item.kind !== 'sensor' })
            .map(function (item) { return toolBtn(item.cap, item.version) })),
          b('去拿小球', function () { askAgent(arm) }, btnGo)
        )
      }

      function perceptionRow() {
        const slot = 'perception'
        const current = curSlot(slot)
        const sensors = (state.repo || []).filter(function (item) { return item.kind === 'sensor' })
        if (sensors.length === 0) return null
        return React.createElement('div', { style: rowStyle },
          React.createElement('span', { style: { fontWeight: 'bold', width: '40px' } }, '感知'),
          ...sensors.map(function (item) {
            const active = current !== null && current.cap === item.cap && current.version === item.version
            return b(item.cap + item.version, function () {
              if (active) call('slot_unmount', { slot: slot })
              else call('slot_mount', { slot: slot, cap: item.cap, version: item.version })
            }, active ? btnOn : btn)
          })
        )
      }

      // 臂行清单: 来自挂载服务全局臂清单(审查 v3: 去 A/B 硬编码); 空清单回退默认 A/B 保证兼容.
      const rowArms = Array.isArray(state.arms) && state.arms.length > 0 ? state.arms : ['A', 'B']

      return React.createElement('div', { style: { fontSize: '12px', padding: '4px 0' } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' } },
          React.createElement('span', { style: { fontWeight: 'bold' } }, '能力面板(装/卸末端与感知, 拿小球交给 agent)'),
          note ? React.createElement('span', { style: { color: '#b45309' } }, note) : null,
          b('刷新', function () { refresh() }),
          b('全部复位', function () { call('reset_all', {}) }, btnRst)
        ),
        ...rowArms.map(function (arm) { return toolRow(arm) }),
        perceptionRow()
      )
    }
  ))
}
