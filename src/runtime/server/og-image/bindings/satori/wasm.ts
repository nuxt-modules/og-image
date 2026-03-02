import _satori, { init } from 'satori/standalone'

// satori 0.16+ ships its own yoga.wasm (from yoga-layout, not yoga-wasm-web)
// The Emscripten glue in satori/standalone is compiled for this specific WASM binary
// Aliased via #og-image/yoga-wasm in compatibility.ts to the correct file path
const yogaWasm = import('#og-image/yoga-wasm' as string)
  .then(m => m.default || m)

export default {
  initWasmPromise: yogaWasm.then(async (wasm) => {
    // Double-await handles unwasm lazy mode where default export is a Promise
    const resolved = await wasm
    await init(resolved)
  }),
  satori: _satori,
}
