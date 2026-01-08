import _satori, { init } from 'satori'

const wasmBinary = import('yoga-wasm-web/dist/yoga.wasm?module' as string)
  .then(yoga => yoga.default || yoga)

export default {
  initWasmPromise: wasmBinary.then(async (wasm) => {
    await init(wasm)
  }),
  satori: _satori,
}
