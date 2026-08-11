import { Resvg as _Resvg, initWasm } from '@resvg/resvg-wasm'
import { importWasm } from '../../../util/wasm'

let initPromise: Promise<void> | undefined

export default {
  // Lazily created on first access: bundlers targeting single-file workers
  // (e.g. Nitro presets with `inlineDynamicImports`) evaluate this module at
  // isolate boot, so an eagerly created promise would compile the WASM on
  // every cold start even for requests that never render an OG image.
  get initWasmPromise(): Promise<void> {
    initPromise ??= importWasm(import('@resvg/resvg-wasm/index_bg.wasm?module' as string))
      .then(wasm => initWasm(wasm))
    return initPromise
  },
  Resvg: _Resvg,
}
