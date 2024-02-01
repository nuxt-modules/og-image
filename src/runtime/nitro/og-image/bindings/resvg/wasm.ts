import { Resvg as _Resvg, initWasm } from '@resvg/resvg-wasm'
import { importWasm } from '../../../util/wasm'

export default {
  initWasmPromise: initWasm(importWasm(import('@resvg/resvg-wasm/index_bg.wasm' as string))),
  Resvg: _Resvg,
}
