import _satori, { init } from 'satori/standalone'
import { readWasmFile } from '../../../util/wasm'

let initPromise: Promise<void> | undefined

export default {
  // satori 0.16+ ships its own yoga.wasm (from yoga-layout, not yoga-wasm-web)
  //
  // Lazily created on first access so module evaluation stays free of file
  // reads and WASM compilation (see bindings/satori/wasm.ts).
  get initWasmPromise(): Promise<void> {
    initPromise ??= readWasmFile('satori/yoga.wasm').then(async (wasm) => {
      await init(wasm)
    })
    return initPromise
  },
  satori: _satori,
}
