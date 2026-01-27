import _satori, { init } from 'satori'
import initYoga from 'yoga-wasm-web'

const yogaWasm = import('yoga-wasm-web/dist/yoga.wasm?module' as string)
  .then(m => m.default || m)

export default {
  initWasmPromise: yogaWasm.then(async (wasm) => {
    const yoga = await initYoga(wasm)
    // @ts-expect-error untyped
    await init(yoga)
  }),
  satori: _satori,
}
