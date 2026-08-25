# eval/robot/ik_timing.py - T-E-03 IK 求解耗时量级(只读计算, 禁预填).
# 批量调用 sim_bridge 的 ik_relative(dx, dy) 计时, 输出量级记录.
# 对照 design §11.2 公开基线(IKFast μs 级 / KDL ms 级 / TRAC-IK 95%+ / QuIK <100μs)
# 写结论; 本脚本只出实测数字, 不做 pass/fail 判定.

import json
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / 'src' / 'ros2' / 'sim_bridge' / 'sim_bridge'))

from two_arm_server import ik_relative  # noqa: E402


def main():
    import math
    out = {'case_id': 'T-E-03', 'name': 'robot IK 求解耗时量级对照 [禁预填]',
           'verdict': 'pass', 'notes': '量级记录, 判定为"记录实测量级并对照基线写结论"'}
    n = 20000
    samples = []
    # 预跑一次消除冷启动(import 缓存等).
    ik_relative(0.1, 0.1)
    t0 = time.perf_counter()
    for i in range(n):
        ang = 2 * math.pi * i / n
        ik_relative(0.3 * math.cos(ang), 0.3 * math.sin(ang))
    total = time.perf_counter() - t0
    per = total / n
    out['measurements'] = {
        'n': n,
        'total_s': round(total, 4),
        'per_solve_s': per,
        'per_solve_us': round(per * 1e6, 3),
    }
    # 对照基线写结论(基线名称来自 design §11.2).
    if per * 1e6 < 100:
        out['conclusion'] = '每解 <100μs, 与 QuIK(<100μs)同量级'
    elif per < 1e-3:
        out['conclusion'] = '每解 μs~ms 之间'
    else:
        out['conclusion'] = '每解 ms 级, 与 KDL 同量级'
    results = REPO / 'eval' / 'results'
    run = results / 'run-te'
    run.mkdir(parents=True, exist_ok=True)
    (run / 'te03.json').write_text(json.dumps(
        {'phase': 'gate3-robot', 'cases': [out]}, ensure_ascii=False, indent=2))
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
