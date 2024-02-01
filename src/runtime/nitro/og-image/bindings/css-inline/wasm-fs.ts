import { initWasm, inline } from '@css-inline/css-inline-wasm'
import { readWasmFile } from '../../../util/wasm'

export default {
  initWasmPromise: initWasm(readWasmFile('@css-inline/css-inline-wasm/index_bg.wasm')),
  cssInline: {
    inline,
  },
}
