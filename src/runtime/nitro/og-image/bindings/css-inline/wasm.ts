import { initWasm, inline } from '@css-inline/css-inline-wasm'

export default {
  initWasmPromise: initWasm(import('@css-inline/css-inline-wasm/index_bg.wasm?module' as string).then((r) => r.default || r)),
  cssInline: {
    inline,
  },
}
