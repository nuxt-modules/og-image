import satori, { init } from 'satori/standalone'
import { readWasmFile } from '../../../util/wasm'

const wasm = readWasmFile('yoga-wasm-web/dist/yoga.wasm')

export default {
  initWasmPromise: new Promise<void>((resolve) => {
    wasm.then(async (yoga) => {
      await init(yoga)
      resolve()
    })
  }),
  satori,
}
