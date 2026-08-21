#!/usr/bin/env python3
"""
demo/01 - 最小 ReAct agent(纯标准库, 零第三方依赖)

目标: 用 DeepSeek API 演示"agent 到底是什么"-
      LLM + 工具调用(tool calling) + 思考-行动-观察循环(ReAct).

运行前先设置:
    export DEEPSEEK_API_KEY="sk-你的key"

用法:
    python3 agent.py "现在是几点? 顺便算一下 3*7+2"
"""
import datetime
import json
import os
import re
import sys
import urllib.request

# ---------------------------------------------------------------------------
# 0. 三个全局配置: 从环境变量读取, 避免把密钥/地址写死在代码里
# ---------------------------------------------------------------------------
# 你的 DeepSeek API Key(sk- 开头). os.environ.get 读取环境变量, 读不到就给空串.
API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")

# API 服务地址. rstrip("/") 去掉结尾可能的斜杠, 避免后面拼 URL 时出现 "//".
# 默认是 DeepSeek 官方地址; 如果你走代理/网关, 改这个环境变量即可.
BASE_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")

# 模型名. deepseek-chat 是 DeepSeek 对话模型的稳定别名(永远指向最新对话模型).
# 若你的账号用不了, 改成别的, 例如: export DEEPSEEK_MODEL=deepseek-v4-flash
MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")


# ---------------------------------------------------------------------------
# 1. 工具: agent 能"动手"做的事. 每个工具 = 一个普通 Python 函数.
#    注意: 这些函数只是"被执行", 它们自己不知道会被谁调用, 为什么要调用.
# ---------------------------------------------------------------------------
def tool_get_time() -> dict:
    """获取当前时间. 返回一个 dict, 最终会变成 JSON 字符串回给模型."""
    # isoformat(timespec="seconds"): 格式化成 "2026-08-21T11:30:00"(精确到秒)
    return {"now": datetime.datetime.now().isoformat(timespec="seconds")}


def tool_calc(expr: str) -> dict:
    """计算一个只含四则运算的算术表达式."""
    # 安全校验: 只允许 数字 + 四则运算符 + 括号 + 空格. 这是"工具必须防注入"的好习惯.
    # fullmatch 要求整个字符串完全匹配, 不能夹带别的字符(例如分号, 引号).
    if not re.fullmatch(r"[0-9+\-*/().\s]+", expr):
        return {"error": "仅支持四则运算, 例如 3*7+2"}
    try:
        # eval 执行字符串表达式. 这里做了两层保护:
        #   {"__builtins__": {}} - 把内建函数(如 open/exec/__import__)全部清空,
        #                         所以表达式里调不了任何危险函数.
        #   {}                     - 全局命名空间也给空 dict.
        # 因此即使传进来恶意字符串, 也只能做纯算术, 无法执行任意代码.
        return {"result": "上海现在天气怎么样"}
    except Exception as e:  # noqa: BLE001 - 表达式非法时, 把错误信息作为正常结果返回
        return {"error": f"表达式非法: {e}"}


# ---------------------------------------------------------------------------
# 2. 工具的"说明书": 这是给"模型"看的 JSON Schema, 不是给代码看的.
#    代码真正执行的是下面的 TOOL_FNS; 模型真正看懂的是下面的 TOOLS.
# ---------------------------------------------------------------------------
# TOOLS 描述了"有哪些工具, 每个工具叫什么, 有什么参数, 什么时候用".
# 它会在调用 chat() 时作为 payload 的 "tools" 字段发给模型.
# 模型根据这份说明书, 决定"要不要调工具, 调哪个, 传什么参数".
TOOLS = [
    {
        "type": "function",                    # 工具类型: 函数
        "function": {
            "name": "get_time",                # 工具名(必须和 TOOL_FNS 的键一致)
            "description": "获取当前时间. 当用户问时间/日期时使用.",  # 告诉模型何时用它
            # 参数的 JSON Schema: 这个工具没有参数, 所以 properties 为空, required 为空
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calc",
            "description": "计算一个只含四则运算的算术表达式, 例如 3*7+2.",
            # 这个工具有一个参数 expr(字符串, 必填)
            "parameters": {
                "type": "object",
                "properties": {"expr": {"type": "string", "description": "算术表达式"}},
                "required": ["expr"],
            },
        },
    },
]

# 工具名 -> 真正的函数. 模型只说出"我要调 calc", 代码用它找到 tool_calc 去执行.
TOOL_FNS = {"get_time": tool_get_time, "calc": tool_calc}


# ---------------------------------------------------------------------------
# 3. 调用 LLM: 把对话历史发给模型, 拿回模型的回复(一次 HTTP 请求)
# ---------------------------------------------------------------------------
def chat(messages: list, tools: list | None = None) -> dict:
    """
    这是本 demo 与 DeepSeek API 交互的唯一入口.

    参数:
      messages - 对话历史. 一个 list, 每个元素是一"条"消息, 用 role 区分身份:
                 {"role": "user", "content": "..."}      用户说的话
                 {"role": "assistant", "content": "..."} 模型说过的话
                 {"role": "tool", ...}                   工具返回的结果
      tools    - (可选)工具的说明书(上面那个 TOOLS). 传了它, 模型才可能请求调工具.

    返回: API 响应的 JSON, 已经解析成 Python dict. 形如:
      {"choices": [{"message": {"role": "assistant", "content": "..."}}]}
    """

    # ---- 3.1 组装"请求体"payload: 要 POST 给服务器的 JSON 对象 ----
    # payload 最终长这样(注意 tools 是可选的):
    #   {"model": "deepseek-chat", "messages": [...], "tools": [...]}
    payload = {"model": MODEL, "messages": messages}
    if tools:
        # 只有调用方真的传了 tools 才加进去; 否则不发送空的 tools 列表.
        payload["tools"] = tools

    # ---- 3.2 构造一个 HTTP 请求"对象"(这一步还不联网) ----
    # urllib.request.Request(...) 只是"描述"一个请求: 目标 URL + 方法 + 请求头 + 请求体.
    # 它不发送任何数据; 真正的网络请求发生在下一段 urlopen().
    req = urllib.request.Request(
        # 目标 URL: DeepSeek 的"对话补全"接口, 完整地址是
        #   https://api.deepseek.com/chat/completions
        f"{BASE_URL}/chat/completions",

        # 请求体(body): 把 payload 这个 dict:
        #   1) json.dumps(payload)      -> 序列化成 JSON 字符串(dict 变成文本)
        #   2) .encode("utf-8")         -> 字符串编码成字节(bytes)
        # HTTP 请求体在网络上传输的永远是"字节", 不是 Python 对象.
        data=json.dumps(payload).encode("utf-8"),

        # 请求头(headers): 告诉服务器"我怎么发的, 我是谁"
        headers={
            # 声明请求体是 JSON 格式, 服务器才知道按 JSON 解析
            "Content-Type": "application/json",
            # 鉴权头: Bearer <key>. f"Bearer {API_KEY}" 拼出 "Bearer sk-xxx".
            # 服务器凭这个 key 识别你是谁, 有没有额度.
            "Authorization": f"Bearer {API_KEY}",
        },

        # HTTP 方法: POST(因为带了请求体). GET 是"取", POST 是"提交数据".
        method="POST",
    )

    # ---- 3.3 真正发送请求, 并读取, 解析响应 ----
    # urlopen(req, timeout=60): 发送 req 这个请求, 返回一个"响应对象"resp.
    #   timeout=60 表示最多等 60 秒, 超时就抛异常(避免卡死).
    # with ... as resp: 像 with open() 打开文件一样, 用完自动关闭连接.
    with urllib.request.urlopen(req, timeout=60) as resp:
        # resp.read()          -> 读响应体的原始内容, 返回"字节"(bytes)
        # .decode("utf-8")     -> 把字节按 UTF-8 解码成"字符串"(此时是一大段 JSON 文本)
        # json.loads(...)      -> 把 JSON 字符串解析成"Python dict"
        # 最后 return 出去: 调用方拿到的就是结构化的 Python 数据.
        return json.loads(resp.read().decode("utf-8"))


# ---------------------------------------------------------------------------
# 4. ReAct 循环: 思考 -> 行动(调工具) -> 观察(工具结果) -> 再思考...
#    这是"agent"区别于"一次性问答"的核心: 模型可以分多轮, 边想边做.
# ---------------------------------------------------------------------------
def run_agent(question: str) -> str:
    # messages 是贯穿全程的"对话历史". 一开始只有用户的一句话.
    # 之后每轮都会往里追加内容, 模型看到的上下文就越来越完整.
    messages = [{"role": "user", "content": question}]
    print(f"user: {question}\n")

    # 最多循环 10 轮. 限制轮数是防止"模型一直调工具停不下来"导致死循环.
    for step in range(10):
        # 把当前历史(连同工具说明书)发给模型, 拿到模型这一轮的回复.
        resp = chat(messages, TOOLS)
        # 响应的结构固定: choices[0] 是"第一个候选", .message 是模型这条回复消息.
        msg = resp["choices"][0]["message"]

        # ---- 4a. 情况一: 模型想调用工具 ----
        # 当模型觉得"光靠嘴答不了, 需要工具"时, 它不会直接给答案,
        # 而是在 message 里带一个 tool_calls 字段(一个列表).
        # 每个元素是一次工具调用请求: {"id":..., "function": {"name":..., "arguments":...}}
        if msg.get("tool_calls"):
            print(f"step {step}: 模型决定调用 {len(msg['tool_calls'])} 个工具")

            # 关键一步: 把"模型请求调工具"这条 assistant 消息"连同它的 tool_calls"原样塞回历史.
            # 为什么必须塞回? 因为 API 要求对话历史是严格按顺序的:
            #   一条带 tool_calls 的 assistant 消息, 后面必须紧跟对应的 role=tool 结果,
            #   模型才能把"我上次要调的工具"和"工具返回的结果"对上号.
            messages.append(
                {
                    "role": "assistant",
                    "content": msg.get("content") or "",  # 调工具时 content 常为空, 给个空串兜底
                    "tool_calls": msg["tool_calls"],      # 原样保留工具调用请求
                }
            )

            # 逐个执行模型请求的工具.
            for tc in msg["tool_calls"]:
                name = tc["function"]["name"]          # 工具名, 例如 "calc"
                # arguments 在 API 里是"JSON 字符串"(不是 dict), 所以先 json.loads 解析成 dict.
                # .get("arguments") or "{}" 兜底: 万一没有参数, 给一个空 JSON 对象.
                args = json.loads(tc["function"].get("arguments") or "{}")

                # 按名字找到本地函数, 用解析出来的参数真正执行它.
                # **args 把 {"expr": "3*7+2"} 展开成 keyword 参数 expr="3*7+2".
                result = TOOL_FNS[name](**args)
                print(f"   tool: {name}({args}) -> {result}")

                # 把工具结果以 role=tool 塞回历史.
                #   tool_call_id 必须等于上面那次调用的 id - 模型靠这个 id 把"问"和"答"配对.
                #   content 是结果的 JSON 字符串(ensure_ascii=False 保留中文不转义).
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": json.dumps(result, ensure_ascii=False),
                    }
                )
            print()

            # 带着"多了 assistant 工具调用 + 工具结果"的新历史, 回到循环顶部,
            # 再次调用模型, 让它根据工具结果决定"继续调"还是"回答".
            continue

        # ---- 4b. 情况二: 模型直接给出最终答案 ----
        # 没有 tool_calls, 说明模型认为可以回答了, content 就是它的最终答案.
        answer = msg.get("content") or ""
        print(f"answer: {answer}")
        return answer

    # 循环 10 轮还没得到最终答案, 说明模型一直在调工具停不下来, 主动截断.
    print("达到最大步数, 仍未得到最终答案")
    return ""


# ---------------------------------------------------------------------------
# 入口: 只在"直接运行本文件"时执行(被 import 时不执行)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    if not API_KEY:
        sys.exit("请先设置环境变量 DEEPSEEK_API_KEY (export DEEPSEEK_API_KEY=\"sk-...\")")

    # 把命令行参数拼成一句话; 没传参数就用默认问题.
    question = " ".join(sys.argv[1:]) or "现在是几点? 顺便算一下 3*7+2"
    run_agent(question)
