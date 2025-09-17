import { init } from 'satori'
import _satori from 'satori/wasm'
import initYoga from 'yoga-wasm-web'

const wasm = import('yoga-wasm-web/dist/yoga.wasm?module' as string)
  .then(async yoga => await initYoga(yoga.default || yoga))

export default {
  initWasmPromise: new Promise<void>((resolve) => {
    wasm.then((yoga) => {
      init(yoga)
      resolve()
    })
  }),
  satori: _satori,
}
