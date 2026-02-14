import _satori, { init } from 'satori/standalone'
import { readWasmFile } from '../../../util/wasm'

const wasmBinary = readWasmFile('yoga-wasm-web/dist/yoga.wasm')

export default {
  initWasmPromise: wasmBinary.then(async (wasm) => {
    await init(wasm)
  }),
  satori: _satori,
}
