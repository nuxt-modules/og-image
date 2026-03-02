import _satori, { init } from 'satori/standalone'
import { readWasmFile } from '../../../util/wasm'

// satori 0.16+ ships its own yoga.wasm (from yoga-layout, not yoga-wasm-web)
const wasmBinary = readWasmFile('satori/yoga.wasm')

export default {
  initWasmPromise: wasmBinary.then(async (wasm) => {
    await init(wasm)
  }),
  satori: _satori,
}
