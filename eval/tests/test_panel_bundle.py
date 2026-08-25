# eval/tests/test_panel_bundle.py - T-M-21 cap-mount-panel bundle 契约格式.
# 纯脚本; 判定标准对照 .dsh/test-plan.md v3 第 3 节 T-M-21.
# 只读检查仓库内已构建产物 lib/client.js, 不重建.

from pathlib import Path

BUNDLE = (Path(__file__).resolve().parents[2]
          / 'src' / 'packages' / 'cap-mount-panel' / 'lib' / 'client.js')
PACKAGE_ID = '@ros-hotplug/dsh-plugin-cap-mount-panel'


def test_tm21_bundle_contract_format():
    """T-M-21 | cap-mount-panel bundle 契约格式"""
    content = BUNDLE.read_text(encoding='utf-8')
    # 首行以 window.__ModuleLoader__.load({ 开头(tsdown 多行输出, 不以整串判等).
    assert content.startswith('window.__ModuleLoader__.load({')
    # 惰性 CJS 工厂形态: id 为本包名, factory 为 (require) => 闭包.
    assert PACKAGE_ID in content
    assert 'factory: (require)' in content
    assert 'var module = { exports: {} };' in content
    assert 'return module.exports;' in content
    assert content.rstrip().endswith('});')
    # react 保持外部 require(模块表基线), 不内联其实现.
    assert 'require("react")' in content
    assert 'react.production' not in content
