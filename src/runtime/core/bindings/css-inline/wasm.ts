import { initWasm, inline } from '@css-inline/css-inline-wasm'
import { importWasm } from '../../utils/wasm'

export default {
  initWasmPromise: initWasm(importWasm(import('@resvg/resvg-wasm/index_bg.wasm' as string))),
  cssInline: {
    inline,
  },
}
