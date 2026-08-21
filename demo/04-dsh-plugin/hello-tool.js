// demo/04 示例: 一个注册 hello 工具的最小 Cordis 插件.
//
// 这段代码是"动态插件"的 code.host 主体: 一个纯 JS 函数体, return 一个 Cordis 插件.
//
// code.host 环境的限制(重要):
//   - 不能用 import / require, 不能用 fetch / 全局定时器
//   - 只能用 Builtin.listBuiltins 确认过的符号
//   - 这里的 harness 就是一个已确认的内建符号, 用来注册工具
//
// 概念: Cordis 插件 = 一个带 apply(ctx) 的对象.
//   apply(ctx) 在插件被挂载时执行, 用来注册能力或挂副作用.
//   停止/更新/移除插件时, apply 里注册的东西会被精确撤销(见 demo/05).

return {
  apply(ctx) {
    // harness.registerTool(ctx, tool) 把工具注册进 tools 注册表,
    // 这样它就能在"下一个模型步"被 agent 调用.
    //
    // harness.defineTool({...}) 声明一个工具的完整契约:
    //   name        - 工具名(agent 看到的)
    //   description - 用途说明(模型据此决定何时调用)
    //   parameters  - 输入参数的 JSON Schema
    //   output      - 输出契约: schema 描述类型, render 决定模型看到什么
    //   execute     - 真正执行的函数, 输入 args, 返回 JSON 兼容值
    harness.registerTool(ctx, harness.defineTool({
      name: 'hello',
      description: '返回一句问候. 当用户让你打招呼或问好时使用.',

      parameters: {
        name: {
          type: 'string',
          required: false,
          description: '要问候的名字, 省略则问候 world',
        },
      },

      output: {
        schema: { type: 'string' },
        render(_args, value) {
          // 返回值必须是模型可读的文本块
          return [{ type: 'text', text: value }]
        },
      },

      execute(args) {
        const who = args.name || 'world'
        return '(BaEQiuZhu) hello, ' + who + '!'
      },
    }))
  },
}
