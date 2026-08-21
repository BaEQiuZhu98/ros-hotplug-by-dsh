// code.host — dynamic Cordis plugin: ros-hotplug-by-dsh-next-demo
//
// This file is the `code.host` function body previously submitted via
// cordis_define; pluginId/packageId are allocated fresh on each rebuild. It returns a
// Cordis plugin object; the Host runs it in the DSH Node process.
//
// Responsibilities:
//   - `demo-status`: scan the 16 demo chapters and report done/dirty/empty.
//   - `commit-demo`: git add + commit a specific chapter (args.dir) or all of demo/.
//
// These are package-private RPC handlers: the client half calls them with
// host.call('demo-status' | 'commit-demo', args).

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
    const DEMOS = [
      '00-dsh-quickstart', '01-what-is-agent', '02-ai-coding', '03-dsh-concepts',
      '04-dsh-plugin', '05-dsh-spatiotemporal', '06-ros2-mujoco-env', '07-rigid-transform',
      '08-kinematics', '09-trajectory-control', '10-ros2-basics', '11-cpp-control',
      '12-dsh-ros-bridge', '13-hotplug', '14-vision', '15-imitation'
    ]
    async function runGit(cwd, command) {
      const spec = shell.resolve({ command: command, workdir: cwd, timeoutMs: 30000 })
      const res = await shell.run(spec)
      return {
        exitCode: res.exitCode,
        stdout: (res.stdout && res.stdout.text) || '',
        stderr: (res.stderr && res.stderr.text) || ''
      }
    }
    function repoOf(args) {
      return (args && typeof args === 'object' && typeof args.repo === 'string' && args.repo) ? args.repo : repoPath()
    }
    async function computeStatus(cwd) {
      const status = await runGit(cwd, 'git status --porcelain -- demo/')
      const dirtyDirs = []
      status.stdout.split('\n').forEach(function (line) {
        if (!line) return
        const path = line.length > 3 ? line.slice(3) : line
        if (path.indexOf('demo/') !== 0) return
        const rest = path.slice(5)
        const slash = rest.indexOf('/')
        const dirName = slash >= 0 ? rest.slice(0, slash) : rest
        if (DEMOS.indexOf(dirName) >= 0 && dirtyDirs.indexOf(dirName) < 0) dirtyDirs.push(dirName)
      })
      const ls = await runGit(cwd, 'git ls-files -- demo/')
      const tracked = ls.stdout.split('\n').filter(function (s) { return s.indexOf('demo/') === 0 })
      const chapters = DEMOS.map(function (dir) {
        const prefix = 'demo/' + dir + '/'
        let committed = false
        for (let j = 0; j < tracked.length; j++) { if (tracked[j].indexOf(prefix) === 0) { committed = true; break } }
        return { dir: dir, num: dir.slice(0, 2), name: dir.slice(3), committed: committed, dirty: dirtyDirs.indexOf(dir) >= 0 }
      })
      let seenEmpty = false
      chapters.forEach(function (c) {
        if (c.dirty) { c.state = 'dirty' }
        else if (c.committed) { c.state = 'done' }
        else { c.state = 'empty'; c.next = !seenEmpty; seenEmpty = true }
      })
      const next = chapters.filter(function (c) { return c.next })[0] || chapters[chapters.length - 1]
      return { chapters: chapters, next: next, dirtyDirs: dirtyDirs, changed: dirtyDirs.length > 0 }
    }
    harness.handle('demo-status', async (args) => {
      try {
        const cwd = repoOf(args)
        const st = await computeStatus(cwd)
        return { ok: true, repo: cwd, chapters: st.chapters, nextDir: 'demo/' + st.next.dir, dirtyDirs: st.dirtyDirs, changed: st.changed }
      } catch (e) { return { ok: false, error: String(e && e.message ? e.message : e) } }
    })
    harness.handle('commit-demo', async (args) => {
      try {
        const cwd = repoOf(args)
        const dir = (args && typeof args === 'object' && typeof args.dir === 'string' && args.dir) ? args.dir : null
        const path = dir ? ('demo/' + dir + '/') : 'demo/'
        const label = dir || 'demo'
        const status = await runGit(cwd, 'git status --porcelain -- ' + path)
        if (!status.stdout.trim()) {
          const st = await computeStatus(cwd)
          return { ok: true, repo: cwd, changed: false, output: 'nothing to commit for ' + label, chapters: st.chapters, dirtyDirs: st.dirtyDirs, nextDir: 'demo/' + st.next.dir }
        }
        const add = await runGit(cwd, 'git add -- ' + path)
        if (add.exitCode !== 0) {
          return { ok: false, error: 'git add failed: ' + (add.stdout + '\n' + add.stderr).trim() }
        }
        const msg = dir ? ('demo: commit ' + dir) : 'demo: commit pending demo files'
        const c = await runGit(cwd, 'git commit -m "' + msg + '"')
        const st = await computeStatus(cwd)
        return { ok: c.exitCode === 0, repo: cwd, changed: true, output: (c.stdout + '\n' + c.stderr).trim(), chapters: st.chapters, dirtyDirs: st.dirtyDirs, nextDir: 'demo/' + st.next.dir }
      } catch (e) { return { ok: false, error: String(e && e.message ? e.message : e) } }
    })
  },
}
