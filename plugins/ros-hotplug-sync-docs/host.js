// code.host — dynamic Cordis plugin: ros-hotplug-sync-docs
//
// This file is the `code.host` function body previously submitted via
// cordis_define; pluginId/packageId are allocated fresh on each rebuild. It returns a
// Cordis plugin; the Host runs it in the DSH Node process.
//
// Responsibility: `sync-docs` collects the repo's md files (docs), knowledge
// points (from demo/README.zh.md quick-reference table), key features (from
// README.zh.md reliability table) and conclusions (positioning / novelty /
// summary), and returns them to the client for selection.

return {
  apply(ctx) {
    const shell = ctx.get('shell')
    if (shell === undefined) return
    const sandboxPolicy = ctx.get('sandboxPolicy')
    const FALLBACK_REPO = '/root/my-project/ros-hotplug-by-dsh'
    function repoPath() {
      if (sandboxPolicy && typeof sandboxPolicy.workspaceRoot === 'string' && sandboxPolicy.workspaceRoot) {
        return sandboxPolicy.workspaceRoot.replace(/\/+$/, '') + '/ros-hotplug-by-dsh'
      }
      return FALLBACK_REPO
    }
    async function runGit(cwd, command) {
      const spec = shell.resolve({ command: command, workdir: cwd, timeoutMs: 30000 })
      const res = await shell.run(spec)
      return {
        exitCode: res.exitCode,
        stdout: (res.stdout && res.stdout.text) || '',
        stderr: (res.stderr && res.stderr.text) || ''
      }
    }
    function cellsOf(line) {
      return line.split('|').map(function (s) { return s.trim() }).filter(function (s) { return s.length > 0 })
    }
    function parseKnowledge(text) {
      const out = []
      const lines = text.split('\n')
      let on = false
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line.indexOf('知识速查表') >= 0) { on = true; continue }
        if (!on) continue
        const t = line.trim()
        if (t.charAt(0) !== '|') continue
        if (t.indexOf('---') >= 0) continue
        const cells = cellsOf(t)
        if (cells.length < 2) continue
        const head = cells[0]
        if (head === '名词' || head === '对') continue
        out.push({ title: head, detail: cells.slice(1).join(' -> ') })
      }
      return out
    }
    function parseFeatures(text) {
      const out = []
      const lines = text.split('\n')
      let on = false
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line.indexOf('可靠性设计概览') >= 0) { on = true; continue }
        if (on && line.trim().indexOf('##') === 0) { on = false; continue }
        if (!on) continue
        const t = line.trim()
        if (t.charAt(0) !== '|') continue
        if (t.indexOf('---') >= 0) continue
        const cells = cellsOf(t)
        if (cells.length < 2) continue
        if (cells[0] === '项目经验') continue
        out.push({ title: cells[0], detail: cells.slice(1).join(' -> ') })
      }
      return out
    }
    function parseConclusions(readme, handoff) {
      const out = []
      const rl = readme.split('\n')
      for (let i = 0; i < rl.length; i++) {
        const line = rl[i]
        if (line.indexOf('一句话定位') >= 0) {
          const a = line.indexOf('：'); const b = line.indexOf(':')
          const idx = a >= 0 ? a : b
          if (idx >= 0) { const m = line.slice(idx + 1).split('**').join('').trim(); if (m) out.push({ title: '一句话定位', detail: m }) }
        }
        if (line.indexOf('新颖性主张') >= 0) {
          for (let j = i + 1; j < Math.min(i + 4, rl.length); j++) {
            const n = rl[j].trim()
            if (n.charAt(0) === '>') {
              let s = n; while (s.charAt(0) === '>' || s.charAt(0) === ' ') s = s.slice(1)
              out.push({ title: '新颖性主张', detail: s.split('**').join('') }); break
            }
          }
        }
      }
      const hl = handoff.split('\n')
      for (let i = 0; i < hl.length; i++) {
        const line = hl[i]
        if (line.indexOf('## 0.') === 0) {
          for (let j = i + 1; j < Math.min(i + 3, hl.length); j++) {
            const n = hl[j].trim()
            if (n.length > 0 && n.charAt(0) !== '>') { out.push({ title: '一句话概括', detail: n }); break }
          }
        }
        if (line.indexOf('## 5.4') === 0) {
          const n = (hl[i + 1] || '').trim()
          if (n) out.push({ title: '下一步', detail: n })
        }
      }
      return out
    }
    function labelOf(path) {
      let p = path
      if (p.slice(-3) === '.md') p = p.slice(0, -3)
      if (p.slice(-3) === '.zh') p = p.slice(0, -3)
      if (p === 'README') return 'README (根, 大纲)'
      if (p === 'DESIGN') return 'DESIGN (技术说明)'
      if (p === 'HANDOFF') return 'HANDOFF (会话交接)'
      if (p.indexOf('demo/') === 0) { const r = p.slice(5); return r === 'README' ? 'demo 路线 README' : ('demo/' + r) }
      if (p.indexOf('docs/') === 0) return 'docs/' + p.slice(5)
      return p
    }
    harness.handle('sync-docs', async (args) => {
      try {
        const cwd = (args && typeof args === 'object' && typeof args.repo === 'string' && args.repo) ? args.repo : repoPath()
        const findRes = await runGit(cwd, "find . -name '*.md' -not -path './.git/*' -not -path './.dsh/*' | sort")
        const docs = findRes.stdout.split('\n').map(function (s) { return s.trim() }).filter(function (s) { return s.length > 0 }).map(function (p) {
          if (p.slice(0, 2) === './') p = p.slice(2)
          return { path: p, title: labelOf(p) }
        })
        const readme = (await runGit(cwd, 'cat demo/README.zh.md')).stdout
        const rootReadme = (await runGit(cwd, 'cat README.zh.md')).stdout
        const handoff = (await runGit(cwd, 'cat HANDOFF.md')).stdout
        return { ok: true, repo: cwd, docs: docs, knowledge: parseKnowledge(readme), features: parseFeatures(rootReadme), conclusions: parseConclusions(rootReadme, handoff) }
      } catch (e) { return { ok: false, error: String(e && e.message ? e.message : e) } }
    })
  },
}
