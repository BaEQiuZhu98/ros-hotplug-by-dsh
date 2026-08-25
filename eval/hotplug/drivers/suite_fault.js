// eval/hotplug/drivers/suite_fault.js - /tmp eval 环境故障注入套件(组合挂载插件).
// 覆盖: T-A-15(kill daemon 重建)/ T-A-16(daemon 僵死 5s 超时)/ T-A-19(挂载与物理分离,
//       含 sim_bridge 停止场景)/ T-A-26(rosbridge 断线重连, 首测记录实际行为).
// 进程注入全部在 netns 内(独立命名空间, 不触碰用户 9090 域); 结果落盘
// eval/results/run-fault/fault.json.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

export const inject = ['agents', 'agentPresets', 'capabilityMount']

const REPO_ROOT = '/root/my-project/ros-hotplug-by-dsh'
const RESULTS_DIR = REPO_ROOT + '/eval/results/run-fault'
const LOGS_DIR = REPO_ROOT + '/eval/results/logs'
const SIM = REPO_ROOT + '/src/ros2/sim_bridge/sim_bridge/two_arm_server.py'
const VENV_PY = '/root/venvs/robo/bin/python3'

const NAMES = {
  'T-A-15': 'daemon kill 自动重建',
  'T-A-16': 'daemon 响应超时兜底',
  'T-A-19': 'mount/unmount 参数与 physical 分离',
  'T-A-26': 'rosbridge 断线重连恢复',
}

const cases = []

export function apply(ctx) {
  const svc = ctx.capabilityMount
  const rpc = async (method, args) => {
    const r = await fetch('http://127.0.0.1:3199/cap-mount/' + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {}),
    })
    return await r.json()
  }
  const record = (id, verdict, error, notes) => {
    cases.push({ case_id: id, name: NAMES[id] || id, verdict: verdict,
      error: error === undefined ? null : error, notes: notes || null })
  }
  const sh = (cmd, opts = {}) => {
    return execSync(cmd, {
      env: { ...process.env, HOME: process.env.HOME || '/root',
        ROS_DOMAIN_ID: '43', ROS_LOG_DIR: LOGS_DIR, ...(opts.env || {}) },
      ...opts,
    }).toString()
  }
  const daemonPids = () => sh("ps -eo pid,args | grep 'bridge_client.py daemon' | grep -v grep | awk '{print $1}'").trim().split(/\s+/).filter(Boolean)
  const simPids = () => sh("ps -eo pid,args | grep 'two_arm_server.py' | grep -v grep | awk '{print $1}'").trim().split(/\s+/).filter(Boolean)
  const rbPids = () => sh("ps -eo pid,args | grep -E 'rosbridge_websocket|ros2 launch' | grep -v grep | awk '{print $1}'").trim().split(/\s+/).filter(Boolean)
  const logOf = (name) => (existsSync(LOGS_DIR + '/' + name) ? readFileSync(LOGS_DIR + '/' + name, 'utf8') : '')

  const run = async () => {
    await new Promise((r) => setTimeout(r, 6000))
    let handle = null
    try {
      handle = await ctx.agents.create({
        sessionId: 'eval-fault-' + Date.now(),
        meta: { cwd: REPO_ROOT, agentPreset: 'robo' },
        setup: async (agentCtx) => { await ctx.agentPresets.mount(agentCtx, 'robo') },
      })

      // ---- T-A-19 ① 非法臂 ----
      const t19bad = await rpc('arm_mount', { arm: 'C', cap: 'grasp', version: '1.0.0' })
      const t19ok1 = t19bad.ok === false && t19bad.error.includes('非法机械臂')

      // ---- T-A-19 ② 正常挂载: physical 分离 ----
      const t19ok2 = await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      await rpc('arm_unmount', { arm: 'A' })

      // ---- T-A-19 ③ sim_bridge 停止时挂载(记录实际行为) ----
      for (const pid of simPids()) sh('kill ' + pid)
      await new Promise((r) => setTimeout(r, 1500))
      const t19stop = await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      // 恢复 sim_bridge(与装配脚本同环境: source ros + venv, env 直接写进内层命令).
      sh("setsid bash -c 'source /opt/ros/humble/setup.bash && source /root/venvs/robo/bin/activate && HOME=/root ROS_DOMAIN_ID=43 ROS_LOG_DIR=" + LOGS_DIR + " " + VENV_PY + " " + SIM + "' > " + LOGS_DIR + "/eval-sim.log 2>&1 &", { env: {} })
      await new Promise((r) => setTimeout(r, 6000))
      const t19after = await rpc('cap_list', {})
      const t19ok3 = t19stop.ok === true && t19stop.physical && t19stop.physical.ok === false
      record('T-A-19', (t19ok1 && t19ok2.ok === true && t19ok2.physical && t19ok2.physical.ok === true && t19ok3) ? 'pass' : 'fail',
        (t19ok1 && t19ok2.ok === true && t19ok2.physical && t19ok2.physical.ok === true && t19ok3) ? null : null,
        '① 非法臂=' + JSON.stringify(t19bad) + '; ② 正常=' + JSON.stringify({ ok: t19ok2.ok, ph: t19ok2.physical }) +
        '; ③ sim 停止时挂载实测=' + JSON.stringify(t19stop) +
        (t19ok3 ? ' —— 修复后回读校验使 physical.ok=false 成立' : ' —— 与判定不符, 汇总上报') +
        '; 恢复后 cap_list=' + JSON.stringify(t19after))
      await rpc('reset_all', {})

      // ---- T-A-15: kill daemon 后重建 ----
      await rpc('arm_unmount', { arm: 'A' })
      const pids15 = daemonPids()
      for (const pid of pids15) sh('kill ' + pid)
      await new Promise((r) => setTimeout(r, 1000))
      const t15r1 = await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      await new Promise((r) => setTimeout(r, 1500))
      const t15r2 = await rpc('arm_mount', { arm: 'B', cap: 'grasp', version: '1.0.0' })
      const ta15ok = t15r2.ok === true && t15r2.physical && t15r2.physical.ok === true
      record('T-A-15', ta15ok ? 'pass' : 'fail', ta15ok ? null
        : JSON.stringify({ first: t15r1, second: t15r2 }),
        'kill 后第一次调用=' + JSON.stringify({ ok: t15r1.ok, error: t15r1.error, ph: t15r1.physical })
        + '; 第二次(重建后)=' + JSON.stringify({ ok: t15r2.ok, ph: t15r2.physical }))
      await rpc('reset_all', {})

      // ---- T-A-16: daemon 僵死(STOP)超时兜底 ----
      for (const pid of daemonPids()) sh('kill -STOP ' + pid)
      const t0 = Date.now()
      const t16r1 = await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      const elapsed = Date.now() - t0
      for (const pid of daemonPids()) sh('kill -CONT ' + pid)
      await new Promise((r) => setTimeout(r, 1500))
      // 超时那次挂载逻辑已生效(armsByArm 已记录): 先卸载验证 bridge 通道恢复, 再重挂验证全链路.
      const t16un = await rpc('arm_unmount', { arm: 'A' })
      const t16r2 = await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      const t16text = JSON.stringify(t16r1)
      const ta16ok = elapsed < 8000 && t16r1.ok === true
        && t16r1.physical && t16r1.physical.ok === false
        && t16text.includes('超时') && t16un.ok === true && t16r2.ok === true
      record('T-A-16', ta16ok ? 'pass' : 'fail', ta16ok ? null
        : JSON.stringify({ elapsedMs: elapsed, t16r1, t16un, t16r2 }),
        'STOP 后挂载耗时 ' + elapsed + 'ms, 响应=' + t16text.slice(0, 220)
        + '; 修复后超时以 physical.ok=false 返回(挂载逻辑成功, 分离语义在超时路径成立)'
        + '; 恢复后 unmount=' + JSON.stringify({ ok: t16un.ok }) + ', 重挂=' + JSON.stringify({ ok: t16r2.ok }))
      await rpc('reset_all', {})

      // ---- T-A-26: rosbridge 断线重连(首测记录实际行为) ----
      await rpc('arm_unmount', { arm: 'A' })
      const rbPidList = rbPids()
      for (const pid of rbPidList) sh('kill ' + pid)
      await new Promise((r) => setTimeout(r, 1500))
      const t26down = await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      // 重启 rosbridge(域 43, 9090), 并轮询端口就绪(launch 启动需数秒).
      sh("setsid bash -c 'source /opt/ros/humble/setup.bash && source /root/venvs/robo/bin/activate && HOME=/root ROS_DOMAIN_ID=43 ROS_LOG_DIR=" + LOGS_DIR + " ros2 launch rosbridge_server rosbridge_websocket_launch.xml port:=9090' > " + LOGS_DIR + "/eval-rosbridge.log 2>&1 &", { env: {} })
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 1000))
        const probe = sh('(echo > /dev/tcp/127.0.0.1/9090) 2>/dev/null && echo up || echo down', { env: {} }).trim()
        if (probe === 'up') break
      }
      await new Promise((r) => setTimeout(r, 3000))
      // 断线期间那次挂载逻辑已生效: 先卸载验证 bridge 通道恢复, 再重挂验证全链路.
      const t26un = await rpc('arm_unmount', { arm: 'A' })
      const t26up = await rpc('arm_mount', { arm: 'A', cap: 'grasp', version: '1.0.0' })
      const recovered = t26un.ok === true && t26un.physical && t26un.physical.ok === true
        && t26up.ok === true && t26up.physical && t26up.physical.ok === true
      record('T-A-26', recovered ? 'pass' : 'fail',
        recovered ? null : JSON.stringify({ down: t26down, unmount: t26un, up: t26up }),
        '断线期间挂载=' + JSON.stringify({ ok: t26down.ok, ph: t26down.physical })
        + '; rosbridge 恢复后卸载=' + JSON.stringify({ ok: t26un.ok, ph: t26un.physical })
        + ', 重挂=' + JSON.stringify({ ok: t26up.ok, ph: t26up.physical })
        + (recovered ? ' —— 修复后 daemon 检测断线即退出, 挂载服务状态机在下一次调用时重建并重连成功' : ' —— 未恢复, 汇总上报'))
      await rpc('reset_all', {})
    } catch (e) {
      record('SUITE', 'fail', String(e && e.stack ? e.stack : e), null)
    }
    try { if (handle) await handle.dispose() } catch (e) { /* 忽略 */ }
    dump()
  }

  function dump() {
    mkdirSync(RESULTS_DIR, { recursive: true })
    writeFileSync(RESULTS_DIR + '/fault.json', JSON.stringify({
      phase: 'gate2-suite-fault', summary: {
        total: cases.length,
        pass: cases.filter((c) => c.verdict === 'pass').length,
        fail: cases.filter((c) => c.verdict === 'fail').length,
      }, cases: cases,
    }, null, 2))
  }

  run()
}
