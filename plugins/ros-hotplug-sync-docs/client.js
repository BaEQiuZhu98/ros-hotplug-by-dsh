// code.client — dynamic Cordis plugin: ros-hotplug-sync-docs
//
// This file is the `code.client` function body previously submitted via
// cordis_define; pluginId/packageId are allocated fresh on each rebuild. It returns a
// Cordis plugin; the browser runs it in the web GUI.
//
// It registers a collapsible "同步文档" panel in the conversation input dock
// (slot `conversation.input.dock`). It collects items from the host half via
// host.call('sync-docs'), lists them with icons and checkboxes, and on
// "应用选中" submits an instruction that triggers the agent to refresh the md.

return {
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return
    slots.inject('conversation.input.dock', () => slots.register(
      { name: 'conversation.input.dock', id: 'ros-sync-docs', order: 16, label: '同步文档' },
      (props) => {
        const inputActions = props.inputActions
        const [open, setOpen] = React.useState(false)
        const [data, setData] = React.useState({ docs: [], knowledge: [], features: [], conclusions: [] })
        const [sel, setSel] = React.useState({})
        const [busy, setBusy] = React.useState(false)
        const [note, setNote] = React.useState('')
        const btnStyle = { cursor: 'pointer', fontSize: '12px', padding: '1px 7px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff' }
        const btnPrimary = { cursor: 'pointer', fontSize: '12px', padding: '1px 7px', border: '1px solid #2563eb', borderRadius: '4px', background: '#eff6ff', color: '#1d4ed8' }
        function load() {
          setBusy(true); setNote('收集中...')
          host.call('sync-docs', {}).then((res) => {
            setBusy(false)
            if (res && res.ok) { setData({ docs: res.docs || [], knowledge: res.knowledge || [], features: res.features || [], conclusions: res.conclusions || [] }); setNote('') }
            else setNote('收集失败: ' + ((res && res.error) || ''))
          }).catch((e) => { setBusy(false); setNote('收集失败: ' + String(e && e.message ? e.message : e)) })
        }
        function toggle(id) {
          setSel(function (prev) { const n = Object.assign({}, prev); if (n[id]) delete n[id]; else n[id] = true; return n })
        }
        function selectAll() {
          const n = {}
          data.docs.forEach(function (d) { n['doc:' + d.path] = true })
          data.knowledge.forEach(function (k, i) { n['k:' + i] = true })
          data.features.forEach(function (f, i) { n['f:' + i] = true })
          data.conclusions.forEach(function (c, i) { n['c:' + i] = true })
          setSel(n)
        }
        function clearAll() { setSel({}) }
        function count() { return Object.keys(sel).length }
        function apply() {
          const docs = data.docs.filter(function (d) { return sel['doc:' + d.path] }).map(function (d) { return d.path })
          const knowledge = data.knowledge.filter(function (k, i) { return sel['k:' + i] }).map(function (k) { return k.title })
          const features = data.features.filter(function (f, i) { return sel['f:' + i] }).map(function (f) { return f.title })
          const conclusions = data.conclusions.filter(function (c, i) { return sel['c:' + i] }).map(function (c) { return c.title })
          const total = docs.length + knowledge.length + features.length + conclusions.length
          if (!total) { setNote('请先勾选要刷新的条目'); return }
          const parts = []
          if (docs.length) parts.push('要刷新的文档: ' + docs.join(', '))
          if (knowledge.length) parts.push('知识点: ' + knowledge.join('; '))
          if (features.length) parts.push('关键特性: ' + features.join('; '))
          if (conclusions.length) parts.push('结论: ' + conclusions.join('; '))
          const instruction = '请执行一次文档同步(只改 md 文件, 不要擅自 git commit/push, 提交时机由用户决定): 1) 回顾本次对话历史与 HANDOFF.md; 2) 按下面选中的条目刷新对应文档, 把选中项写入/合并进合适的 md, 尤其 demo/README.zh.md 的知识速查表; 3) 遵守三条约定: 中文注释+英文标点, 无 emoji, 不修改 docs/timestamps/ 回执, 不重写 git 历史. ' + parts.join('; ')
          if (inputActions && typeof inputActions.setDraft === 'function' && typeof inputActions.submit === 'function') {
            inputActions.setDraft(instruction)
            inputActions.submit()
            setNote('已提交同步任务')
          } else { setNote('inputActions 不可用') }
        }
        function row(id, label, detail) {
          return React.createElement('label', { key: id, style: { display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '2px 0', cursor: 'pointer' } },
            React.createElement('input', { type: 'checkbox', checked: !!sel[id], onChange: function () { toggle(id) } }),
            React.createElement('span', null,
              React.createElement('span', { style: { fontWeight: 500 } }, label),
              detail ? React.createElement('span', { style: { color: '#9ca3af', marginLeft: '6px' } }, detail) : null
            )
          )
        }
        function group(title, icon, rows) {
          return React.createElement('div', { style: { marginBottom: '8px' } },
            React.createElement('div', { style: { fontWeight: 'bold', marginBottom: '2px' } }, icon + ' ' + title),
            rows
          )
        }
        const total = data.docs.length + data.knowledge.length + data.features.length + data.conclusions.length
        const docRows = data.docs.map(function (d) { return row('doc:' + d.path, d.title, d.path) })
        const kRows = data.knowledge.map(function (k, i) { return row('k:' + i, k.title, k.detail) })
        const fRows = data.features.map(function (f, i) { return row('f:' + i, f.title, f.detail) })
        const cRows = data.conclusions.map(function (c, i) { return row('c:' + i, c.title, c.detail) })
        return React.createElement('div', { style: { fontSize: '12px', lineHeight: 1.5, padding: '4px 0', borderTop: '1px dashed #e5e7eb', marginTop: '4px' } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
            React.createElement('button', { onClick: function () { setOpen(!open) }, style: { cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontWeight: 'bold' } }, (open ? '▾' : '▸') + ' 同步文档 (' + total + ')'),
            React.createElement('button', { onClick: load, disabled: busy, style: btnStyle }, busy ? '收集中...' : '收集'),
            React.createElement('button', { onClick: selectAll, style: btnStyle }, '全选'),
            React.createElement('button', { onClick: clearAll, style: btnStyle }, '清空'),
            React.createElement('button', { onClick: apply, style: btnPrimary }, '应用选中 (' + count() + ')'),
            note ? React.createElement('span', { style: { color: '#6b7280' } }, note) : null
          ),
          open ? React.createElement('div', { style: { marginTop: '4px', maxHeight: '320px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '6px' } },
            group('文档 (' + data.docs.length + ')', '📄', docRows),
            group('知识点 (' + data.knowledge.length + ')', '🧠', kRows),
            group('关键特性 (' + data.features.length + ')', '⭐', fRows),
            group('结论 (' + data.conclusions.length + ')', '💡', cRows),
            (!total ? React.createElement('span', { style: { color: '#9ca3af' } }, '还没有条目, 点击「收集」') : null)
          ) : null
        )
      }
    ))
  },
}
