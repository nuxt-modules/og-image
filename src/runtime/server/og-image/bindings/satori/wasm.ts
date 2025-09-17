import satori, { init } from 'satori/standalone'

const wasm = import('yoga-wasm-web/dist/yoga.wasm?module' as string)

export default {
  initWasmPromise: new Promise<void>((resolve) => {
    wasm.then(async (yoga) => {
      await init(yoga)
      resolve()
    })
  }),
  satori,
}
