import { Resvg as _Resvg, initWasm } from '@resvg/resvg-wasm'

export default {
  initWasmPromise: initWasm(import('@resvg/resvg-wasm/index_bg.wasm?module' as string).then((r) => r.default || r)),
  Resvg: _Resvg,
}
