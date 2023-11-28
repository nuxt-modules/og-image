import { Resvg as _Resvg, initWasm } from '@resvg/resvg-wasm'
import ReSVGWasm from '@resvg/resvg-wasm/index_bg.wasm'

export default {
  initWasmPromise: initWasm(ReSVGWasm).catch(() => {}),
  Resvg: _Resvg,
}
