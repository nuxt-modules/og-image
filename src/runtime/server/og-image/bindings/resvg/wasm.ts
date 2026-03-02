import { Resvg as _Resvg, initWasm } from '@resvg/resvg-wasm'

const wasmModule = import('@resvg/resvg-wasm/index_bg.wasm?module' as string)
  .then(r => r.default || r)

export default {
  initWasmPromise: wasmModule.then(async (wasm) => {
    // Double-await handles unwasm lazy mode where default export is a Promise
    const resolved = await wasm
    await initWasm(resolved)
  }),
  Resvg: _Resvg,
}
