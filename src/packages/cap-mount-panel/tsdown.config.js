import { defineConfig } from 'tsdown'

const PACKAGE_ID = '@ros-hotplug/dsh-plugin-cap-mount-panel'

// 照抄 DSH 官方 client bundle 契约(源仓库 packages/client/tsdown.client.ts 的
// clientConfig, 调研见 .dsh/research/tree-package-build-chain.zh.md):
//   产物必须是经典脚本, 顶层只做 window.__ModuleLoader__.load({id, factory}),
//   factory 为惰性 CJS 闭包 (require) => module.exports;
//   未请求模块表基线的依赖一律内联, 请求过的保持 require(由浏览器模块表提供).
export default defineConfig({
  entry: { client: 'src/client/index.js' },
  outDir: 'lib',
  format: ['cjs'],
  platform: 'browser',
  dts: false,
  clean: false,
  sourcemap: false,
  deps: {
    // react 在官方模块表基线(PLATFORM_MODULES)里, 保持外部 require; 其余全内联.
    neverBundle: (specifier) => specifier === 'react',
    alwaysBundle: (specifier) => specifier !== 'react',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
})
