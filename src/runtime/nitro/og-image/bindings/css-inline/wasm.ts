import { initWasm, inline } from '@css-inline/css-inline-wasm'
import { importWasm } from '../../../util/wasm'

export default {
  initWasmPromise: initWasm(importWasm(import('@css-inline/css-inline-wasm/index_bg.wasm' as string))),
  cssInline: {
    inline,
  },
}
