import { Resvg as _Resvg, initWasm } from '@resvg/resvg-wasm'
import { readWasmFile } from '../../../util/wasm'

let initPromise: Promise<void> | undefined

export default {
  // Lazily created on first access so module evaluation stays free of file
  // reads and WASM compilation (see bindings/resvg/wasm.ts).
  get initWasmPromise(): Promise<void> {
    initPromise ??= initWasm(readWasmFile('@resvg/resvg-wasm/index_bg.wasm'))
    return initPromise
  },
  Resvg: _Resvg,
}
