import _satori, { init } from 'satori/standalone'
import { importWasm } from '../../../util/wasm'

let initPromise: Promise<void> | undefined

export default {
  // satori 0.16+ ships its own yoga.wasm (from yoga-layout, not yoga-wasm-web)
  // Aliased via #og-image/yoga-wasm in compatibility.ts to the correct file path
  //
  // Lazily created on first access: bundlers targeting single-file workers
  // (e.g. Nitro presets with `inlineDynamicImports`) evaluate this module at
  // isolate boot, so an eagerly created promise would compile the WASM on
  // every cold start even for requests that never render an OG image.
  get initWasmPromise(): Promise<void> {
    initPromise ??= importWasm(import('#og-image/yoga-wasm' as string))
      .then(wasm => init(wasm))
    return initPromise
  },
  satori: _satori,
}
