#!/usr/bin/env bash
# eval/hotplug/fixtures/fake-python.sh - 伪装 python 解释器(故障注入件).
# 挂载服务 spawn(config.python, [bridge_client.py, daemon]) 时, 本脚本忽略参数,
# 输出一行非 JSON 后长眠, 用于 T-A-17(非 JSON 输出)与 T-A-24 ③(内部异常 500)注入.
echo 'fake-daemon-garbage-not-json'
exec sleep 300
