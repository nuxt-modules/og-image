import { Resvg as _Resvg, initWasm } from '@resvg/resvg-wasm'
import { importWasm } from '../../../util/wasm'

export default {
  initWasmPromise: importWasm(import('@resvg/resvg-wasm/index_bg.wasm?module' as string))
    .then(wasm => initWasm(wasm)),
  Resvg: _Resvg,
}
