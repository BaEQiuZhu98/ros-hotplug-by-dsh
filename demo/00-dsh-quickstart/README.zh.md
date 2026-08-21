# demo/00 — DSH 快速上手

## 学什么

- DSH（DeepSeek Harness）是什么：一个「一切皆插件」的 agent 运行框架。
- 两种运行模式：`headless`（命令行，跑完即退）和 `web`（浏览器 GUI）。
- 最小闭环：装好 → 配 key → 跑第一个 agent 对话。

> 这是后面所有 demo 的**运行基座**。先跑通它，再谈 agent/plugin/机器人。

## 怎么跑

### 0. 前置要求
- Node.js ≥ 20（推荐 22+）：`node -v`
- npm
- 一个 DeepSeek API Key（`sk-...`）

### 1. 安装
```bash
npm install -g @deepseek-ai/dsh
dsh --version          # 应打印版本号（如 0.1.0-rc.x）
```
> 若 `dsh` 不在 PATH，改用 `npx @deepseek-ai/dsh --version` 验证。

### 2. 配置 API Key（DSH 通过环境变量读取）
```bash
export DEEPSEEK_API_KEY="sk-你的key"
```
> 这是 DSH 的 `deepseek-official` 模型路由默认读取的环境变量（`apiKeyEnv: DEEPSEEK_API_KEY`）。

### 3. 首次运行（headless 模式）
```bash
dsh --profile headless "用一句话介绍你自己，并告诉我今天是星期几"
```
- 首次会从模板自动初始化 headless profile。
- 跑完会打印最终回答并退出。

### 4. 运行 web GUI
```bash
dsh web
```
- 打开它打印的地址（默认 http://localhost:3080），在浏览器里和 agent 对话。

### 5. 环境自检（可选）
```bash
bash check.sh
```

## 观察什么

1. **headless 输出**：agent 的最终回答（思考过程可能被折叠/省略，取决于模型）。
2. **web GUI**：一个完整的对话会话——你能看到「你的消息 → agent 回复」循环。
3. **agent 的本质**：它不是一个魔法黑盒，而是「模型 + 对话循环 +（可选）工具」的组合。这一认知是 `demo/01` 的主题。

## 与最终目标什么关系

- 后面 `demo/04`（写 plugin）、`demo/12`（DSH↔ROS2）、`demo/13`（热插拔）都跑在同一个 DSH 上。
- 你在此刻建立的心智模型是：**DSH 把「能力」拆成可插拔的插件，agent 只是这些能力的调用者之一**。
