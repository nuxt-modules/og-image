import _satori, { init } from 'satori/standalone'

const yogaWasm = import('yoga-wasm-web/dist/yoga.wasm?module' as string)
  .then(m => m.default || m)

export default {
  initWasmPromise: yogaWasm.then(async (wasm) => {
    await init(wasm)
  }),
  satori: _satori,
}
