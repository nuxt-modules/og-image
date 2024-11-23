import { Resvg as _Resvg, initWasm } from '@resvg/resvg-wasm'
import { readWasmFile } from '../../../util/wasm'

export default {
  initWasmPromise: initWasm(readWasmFile('@resvg/resvg-wasm/index_bg.wasm')),
  Resvg: _Resvg,
}
