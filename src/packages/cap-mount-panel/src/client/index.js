// cap-mount-panel client 半部 - 末端能力面板(架构 v2, 树外包持久化形态).
//
// 与 src/capabilities/mount_service/panel.client.js 语义完全一致(动态插件演示形态),
// 差异只在通道: 动态插件用包私有 host.call, 树外包用同源 fetch 调
// host 半部的 /cap-mount/* 路由(见 src/index.js). React 经模块表基线
// require('react') 获取(tsdown 把它保留为外部依赖).
//
// UI: 输入区上方两行(臂 A/B), 每行按能力仓库清单动态渲染按钮 toggle
//     (点选生效/再点取消, 当前挂载高亮) + 「去拿小球」(把消息发给 agent, 由 agent 判断).
//     标题行: 「刷新」「全部复位」.
import React from 'react'

export const inject = ['slots']

export function apply(ctx) {
  const slots = ctx.get('slots')
  if (slots === undefined) return
  slots.inject('conversation.input.dock', () => slots.register(
    { name: 'conversation.input.dock', id: 'cap-mount-panel', order: 16, label: '末端能力' },
    (props) => {
      const [state, setState] = React.useState({ repo: [], mounted: [] })
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
      function refresh() {
        rpc('cap_list', {}).then((res) => {
          if (res && res.mounted) setState(res)
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
        // 按钮由能力仓库清单(repo)动态渲染: 加新末端只需放 repo 目录, 不改客户端(§10.7 原则 1).
        function toolBtn(cap, version) {
          const active = current !== null && current.cap === cap && current.version === version
          return b(cap + version, function () {
            if (active) call('arm_unmount', { arm: arm })
            else call('arm_mount', { arm: arm, cap: cap, version: version })
          }, active ? btnOn : btn)
        }
        return React.createElement('div', { key: arm, style: rowStyle },
          React.createElement('span', { style: { fontWeight: 'bold', width: '40px' } }, '臂 ' + arm),
          ...((state.repo || []).map(function (item) { return toolBtn(item.cap, item.version) })),
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
}
