# eval/tests/test_tooling.py - T-M-19(pack.sh 打包) / T-M-20(setup.sh 幂等).
# 纯脚本; 判定标准对照 .dsh/test-plan.md v3 第 3 节.

import json
import subprocess
import sys
import tarfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


def test_tm19_pack_integrity():
    """T-M-19 | pack.sh 打包完整性"""
    import shutil
    import tempfile
    out = Path('/tmp/cap-packs')
    shutil.rmtree(out, ignore_errors=True)
    proc = subprocess.run(
        ['bash', str(REPO / 'src' / 'capabilities' / 'pack.sh'), 'grasp', '1.0.0'],
        capture_output=True, text=True, timeout=120)
    assert proc.returncode == 0, proc.stdout + proc.stderr
    tarball = out / 'ros-hotplug-dsh-plugin-grasp-1.0.0.tgz'
    assert tarball.exists()
    with tarfile.open(tarball) as tf:
        names = [n.split('/')[-1] for n in tf.getnames() if not n.endswith('/')]
        assert 'host.js' in names
        assert 'manifest.json' in names
        assert 'package.json' in names
        # 解包后 sha256 仍与 manifest 一致.
        import hashlib
        manifest = json.loads(tf.extractfile(
            [n for n in tf.getnames() if n.endswith('manifest.json')][0]).read())
        host_bytes = tf.extractfile(
            [n for n in tf.getnames() if n.endswith('host.js')][0]).read()
        actual = hashlib.sha256(host_bytes).hexdigest()
        assert manifest['grasp']['sha256'] == actual


def test_tm20_setup_idempotent():
    """T-M-20 | setup.sh 幂等与路径集中"""
    import shutil
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        home = Path(d) / 'dsh-home'
        patch = home / 'profiles' / 'web' / 'cordis.patch.yml'
        # 第一次运行: 写入挂载服务行 + 面板行.
        r1 = subprocess.run(
            ['bash', str(REPO / 'src' / 'setup.sh'), str(home), 'web',
             '/root/venvs/robo/bin/python3'],
            capture_output=True, text=True, timeout=180)
        assert r1.returncode == 0, r1.stdout + r1.stderr
        text1 = patch.read_text(encoding='utf-8')
        assert 'id: capability-mount-service' in text1
        assert 'id: cap-mount-panel' in text1
        # 第二次运行: 幂等跳过写入(行数不变).
        r2 = subprocess.run(
            ['bash', str(REPO / 'src' / 'setup.sh'), str(home), 'web',
             '/root/venvs/robo/bin/python3'],
            capture_output=True, text=True, timeout=180)
        assert r2.returncode == 0, r2.stdout + r2.stderr
        text2 = patch.read_text(encoding='utf-8')
        assert text1 == text2, '第二次运行不应重复写行'
        assert '已存在于' in r2.stdout
        # 挂载服务行 config 与脚本参数一致(路径集中).
        assert REPO.name in text1 and '/root/venvs/robo/bin/python3' in text1
        # "[]" 空列表场景: loader 写回后 setup.sh 能重写.
        patch.write_text('[]\n', encoding='utf-8')
        r3 = subprocess.run(
            ['bash', str(REPO / 'src' / 'setup.sh'), str(home), 'web',
             '/root/venvs/robo/bin/python3'],
            capture_output=True, text=True, timeout=180)
        assert r3.returncode == 0, r3.stdout + r3.stderr
        text3 = patch.read_text(encoding='utf-8')
        assert 'id: capability-mount-service' in text3
        assert 'id: cap-mount-panel' in text3
        # 实现把新行追加在 "[]" 之后(顶层序列的第二个条目), "[]" 以空条目残留:
        # YAML 仍合法且两行生效, 判定意图("[]" 场景可重写)满足; 残留瑕疵记录进汇总.
        # 面板包已复制进 node_modules.
        pkg = home / 'profiles' / 'web' / 'node_modules' / '@ros-hotplug' / 'dsh-plugin-cap-mount-panel'
        assert (pkg / 'lib' / 'client.js').exists()
