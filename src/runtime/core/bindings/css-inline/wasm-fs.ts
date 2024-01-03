import { initWasm, inline } from '@css-inline/css-inline-wasm'
import { readWasmFile } from '../../utils/wasm'

export default {
  initWasmPromise: initWasm(readWasmFile('@css-inline/css-inline-wasm/index_bg.wasm')),
  cssInline: {
    inline,
  },
}
