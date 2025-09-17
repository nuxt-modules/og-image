import _satori, { init } from 'satori/wasm'
import initYoga from 'yoga-wasm-web'
import { readWasmFile } from '../../../util/wasm'

const wasm = readWasmFile('yoga-wasm-web/dist/yoga.wasm')
  .then(async yoga => await initYoga(yoga))

export default {
  initWasmPromise: new Promise<void>((resolve) => {
    wasm.then((yoga) => {
      init(yoga)
      resolve()
    })
  }),
  satori: _satori,
}
