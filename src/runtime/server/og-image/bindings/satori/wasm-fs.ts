import _satori, { init } from 'satori'
import { readWasmFile } from '../../../util/wasm'

const wasmBinary = readWasmFile('yoga-wasm-web/dist/yoga.wasm')

export default {
  initWasmPromise: wasmBinary.then(async (wasm) => {
    // @ts-expect-error untyped
    await init(wasm)
  }),
  satori: _satori,
}
