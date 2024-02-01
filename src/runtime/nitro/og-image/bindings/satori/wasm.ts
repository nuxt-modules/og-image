import _satori from 'satori/wasm'
import initYoga from 'yoga-wasm-web'
import { init } from 'satori'
import { importWasm } from '../../../util/wasm'

const wasm = importWasm(import('yoga-wasm-web/dist/yoga.wasm' as string))
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
