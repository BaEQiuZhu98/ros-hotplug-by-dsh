// code.client — dynamic Cordis plugin: ros-hotplug-by-dsh-next-demo
//
// This file is the `code.client` function body previously submitted via
// cordis_define; pluginId/packageId are allocated fresh on each rebuild. It returns a
// Cordis plugin; the browser runs it in the web GUI.
//
// It registers a full-width "demo 进度" strip in the conversation input dock
// (slot `conversation.input.dock`) that shows the 16 demo chapters with icons
// and action buttons, and calls the host half via host.call('demo-status' |
// 'commit-demo').

return {
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return
    slots.inject('conversation.input.dock', () => slots.register(
      { name: 'conversation.input.dock', id: 'ros-demo-progress', order: 15, label: 'demo 进度' },
      (props) => {
        const inputActions = props.inputActions
        const [chapters, setChapters] = React.useState([])
        const [busy, setBusy] = React.useState(false)
        const [note, setNote] = React.useState('')
        const btnStyle = { cursor: 'pointer', fontSize: '12px', padding: '1px 7px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff' }
        const btnPrimary = { cursor: 'pointer', fontSize: '12px', padding: '1px 7px', border: '1px solid #2563eb', borderRadius: '4px', background: '#eff6ff', color: '#1d4ed8' }
        function load() {
          host.call('demo-status', {}).then((res) => {
            if (res && Array.isArray(res.chapters)) setChapters(res.chapters)
            if (res && !res.ok) setNote(res.error || '加载失败')
          }).catch((e) => setNote('加载失败: ' + String(e && e.message ? e.message : e)))
        }
        React.useEffect(function () { load() }, [])
        function commitDir(dir) {
          setBusy(true); setNote('提交 ' + dir + ' ...')
          host.call('commit-demo', { dir: dir }).then((res) => {
            setBusy(false)
            if (res && res.ok) { setNote('已提交 ' + dir); if (Array.isArray(res.chapters)) setChapters(res.chapters) }
            else setNote('提交失败: ' + ((res && (res.error || res.output)) || ''))
          }).catch((e) => { setBusy(false); setNote('提交失败: ' + String(e && e.message ? e.message : e)) })
        }
        function commitAll() {
          setBusy(true); setNote('提交 demo 全部变更 ...')
          host.call('commit-demo', {}).then((res) => {
            setBusy(false)
            if (res && res.ok) { setNote(res.changed ? '已提交 demo 全部变更' : 'demo 无未提交变更'); if (Array.isArray(res.chapters)) setChapters(res.chapters) }
            else setNote('提交失败: ' + ((res && (res.error || res.output)) || ''))
          }).catch((e) => { setBusy(false); setNote('提交失败: ' + String(e && e.message ? e.message : e)) })
        }
        function submitInstruction(next) {
          const nextDir = next ? ('demo/' + next.dir) : 'demo/06-ros2-mujoco-env'
          const nextDemo = next ? next.dir : nextDir
          const instruction = 'demo 目录已提交/确认。请继续编写下一章节: ' + nextDir + ' (' + nextDemo + ')。' + '先读 HANDOFF.md 的开工指示和 demo/README.zh.md 的路线, 再按三条约定实现该 demo 的中英双语 README 与代码: 中文注释+英文标点, 打印输出无 emoji; 完成后不要自行 git commit/push, 提交时机由用户决定(用户会再次点击本按钮)。'
          if (inputActions && typeof inputActions.setDraft === 'function' && typeof inputActions.submit === 'function') {
            inputActions.setDraft(instruction)
            inputActions.submit()
            setNote('已启动 ' + nextDir)
          } else { setNote('inputActions 不可用') }
        }
        function startNext() {
          const next = chapters.filter(function (c) { return c.next })[0]
          const dirty = chapters.filter(function (c) { return c.state === 'dirty' })
          if (dirty.length) {
            setBusy(true); setNote('先提交未提交的 demo ...')
            host.call('commit-demo', {}).then((res) => {
              setBusy(false)
              if (res && res.ok) { if (Array.isArray(res.chapters)) setChapters(res.chapters); submitInstruction(next) }
              else setNote('提交失败: ' + ((res && (res.error || res.output)) || ''))
            }).catch((e) => { setBusy(false); setNote('提交失败: ' + String(e && e.message ? e.message : e)) })
          } else { submitInstruction(next) }
        }
        function chip(c) {
          const icon = c.state === 'done' ? '✓' : (c.state === 'dirty' ? '⚠' : (c.next ? '▶' : '○'))
          const color = c.state === 'done' ? '#2e9e5b' : (c.state === 'dirty' ? '#d97706' : (c.next ? '#2563eb' : '#9ca3af'))
          const els = [React.createElement('span', { key: 'i', style: { color: color } }, icon + ' ' + c.num + ' ' + c.name)]
          if (c.state === 'dirty') els.push(React.createElement('button', { key: 'b', onClick: function () { commitDir(c.dir) }, disabled: busy, style: btnStyle }, '提交'))
          else if (c.next) els.push(React.createElement('button', { key: 'b', onClick: startNext, disabled: busy, style: btnPrimary }, '开始写'))
          return React.createElement('span', { key: c.dir, style: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 8px', border: '1px solid #e5e7eb', borderRadius: '6px', marginRight: '6px', marginBottom: '4px' } }, els)
        }
        return React.createElement('div', { style: { fontSize: '12px', lineHeight: 1.4, padding: '4px 0' } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' } },
            React.createElement('span', { style: { fontWeight: 'bold' } }, 'demo 进度'),
            React.createElement('button', { onClick: function () { setNote(''); load() }, style: btnStyle }, '刷新'),
            React.createElement('button', { onClick: commitAll, disabled: busy, style: btnStyle }, '提交全部'),
            note ? React.createElement('span', { style: { color: '#6b7280' } }, note) : null
          ),
          React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' } },
            chapters.length ? chapters.map(chip) : React.createElement('span', { style: { color: '#9ca3af' } }, '加载中...')
          )
        )
      }
    ))
  },
}
