// eval/hotplug/drivers/recon.js - 会话类用例驱动的第一步: 侦察.
// 以动态插件(code.host)形态在真实宿主运行, 通过宿主服务:
//   - agents.list() 枚举活 agent, 找到「机器人任务」robo 会话;
//   - tools.schemas(scope) 列出该 agent 作用域可见工具表(服务于 T-S-01);
//   - 结果经 fs 服务写入 eval/results/recon-agent.json(工作区落盘).
// 只读, 不挂载/不执行工具.

return {
  apply(ctx) {
    const fs = ctx.get('fs')
    const agentsSvc = ctx.get('agents')
    const tools = ctx.get('tools')
    const out = { time: new Date().toISOString(), agents: [] }
    if (agentsSvc === undefined) {
      out.error = '无 agents 服务'
    } else {
      for (const a of agentsSvc.list()) {
        const entry = {
          id: String(a && a.id),
          cwd: a && a.cwd,
          keys: Object.keys(a || {}).slice(0, 14),
        }
        try {
          entry.toolNames = tools === undefined ? [] : tools.schemas(a).map((t) => t.name)
        } catch (e) {
          entry.toolNames = 'err: ' + String(e && e.message ? e.message : e)
        }
        out.agents.push(entry)
      }
    }
    const target = '/root/my-project/ros-hotplug-by-dsh/eval/results/recon-agent.json'
    fs.resolve(target).then((t) => fs.writeText(t, JSON.stringify(out, null, 2)))
      .catch((e) => console.error('[eval-driver] 侦察结果写入失败: ' + String(e && e.message ? e.message : e)))
  },
}
