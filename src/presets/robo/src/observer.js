// robo-observer - 观测插件(设计 §7.6 观测能力).
//
// 职责: 订阅 tools/change 事件, 汇报末端实例的增删(可靠性点「事件通知」的可观测实现).
// 注意: agent 的感知入口是臂管理器提供的 arm_status(按臂查询 ready), 本插件只做
// 事件日志与能力集汇报, 不再注册感知工具.
// 零依赖: 不 import 任何包, 只用注入的服务(tools).
export const name = 'robo-observer'
export const inject = ['tools']

export function apply(ctx) {
  const log = (m) => console.log('[robo-observer] ' + m)

  const offChange = ctx.on('tools/change', () => {
    log('tools/change 事件: 末端实例可能已增删(以 arm_status 查询结果为准)')
  })
  log('启动: 订阅 tools/change 就绪')

  return () => {
    offChange()
  }
}
