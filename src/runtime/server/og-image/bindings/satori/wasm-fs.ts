import _satori, { init } from 'satori/standalone'
import { readWasmFile } from '../../../util/wasm'

// Load Satori's standalone layout engine from disk.
const wasmBinary = readWasmFile('satori/layout.wasm')

export default {
  initWasmPromise: wasmBinary.then(async (wasm) => {
    await init(wasm)
  }),
  satori: _satori,
}
