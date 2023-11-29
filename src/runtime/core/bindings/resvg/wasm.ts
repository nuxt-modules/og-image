import { Resvg as _Resvg, initWasm } from '@resvg/resvg-wasm'

export default {
  initWasmPromise: initWasm(import('@resvg/resvg-wasm/index_bg.wasm').then((m) => {
    let mod = m.default
    mod = typeof mod === 'function' ? mod() : mod
    return 'instance' in mod ? mod.instance : mod
  })),
  Resvg: _Resvg,
}
