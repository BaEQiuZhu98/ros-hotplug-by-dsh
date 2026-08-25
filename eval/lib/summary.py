#!/usr/bin/env python3
# eval/lib/summary.py - 结果聚合器.
# 扫描 eval/results/run-*/ 下的全部 JSON 记录(pytest.json 与后续驱动脚本产出),
# 聚合为 eval/results/SUMMARY.md: 按门禁分组, 四列计数 + 失败用例逐条链接.
# 用法: python3 eval/lib/summary.py [results_root]

import json
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else \
    Path(__file__).resolve().parents[1] / 'results'

GATES = ['gate1', 'gate2', 'gate3']


def load_run(run_dir):
    cases = []
    for jf in sorted(run_dir.glob('*.json')):
        if jf.name == 'SUMMARY.json':
            continue
        try:
            data = json.loads(jf.read_text(encoding='utf-8'))
        except Exception as e:
            cases.append({'case_id': jf.stem, 'verdict': 'record-error',
                          'error': str(e)})
            continue
        for c in data.get('cases', []):
            c['_run'] = run_dir.name
            c['_file'] = jf.name
            cases.append(c)
    return cases


def main():
    cases = []
    for run_dir in sorted(ROOT.glob('run-*')):
        if run_dir.is_dir():
            cases.extend(load_run(run_dir))
    # 同一 case_id 取最新一轮 run 的判定(避免历史误报永久留在汇总).
    latest = {}
    for c in cases:
        key = c.get('case_id', c.get('_file', '?'))
        if key not in latest or c.get('_run', '') >= latest[key].get('_run', ''):
            latest[key] = c
    cases = list(latest.values())
    by_verdict = {}
    for c in cases:
        by_verdict.setdefault(c.get('verdict', 'unknown'), []).append(c)
    lines = [
        '# eval 汇总(自动生成, 时间聚合全部 run-*)',
        '',
        '| 判定 | 数量 |',
        '|---|---|',
    ]
    for verdict in ('pass', 'fail', 'expected-fail', 'not-injectable',
                    'not-executed', 'deferred', 'record-error', 'unknown'):
        n = len(by_verdict.get(verdict, []))
        if n:
            lines.append('| %s | %d |' % (verdict, n))
    lines.append('')
    for verdict in ('fail', 'expected-fail', 'not-injectable', 'not-executed',
                    'deferred', 'record-error'):
        rows = by_verdict.get(verdict, [])
        if not rows:
            continue
        lines.append('## %s' % verdict)
        lines.append('')
        for c in sorted(rows, key=lambda x: x.get('case_id', '')):
            lines.append('- `%s` %s: %s(记录: results/%s/%s)' % (
                c.get('case_id', '?'), c.get('name', ''),
                (c.get('error') or '')[:200], c.get('_run', '?'), c.get('_file', '?')))
        lines.append('')
    out = ROOT / 'SUMMARY.md'
    out.write_text('\n'.join(lines), encoding='utf-8')
    print('summary: ' + str(out))
    print('cases: %d' % len(cases))


if __name__ == '__main__':
    main()
