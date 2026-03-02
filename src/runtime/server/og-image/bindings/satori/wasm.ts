import _satori, { init } from 'satori/standalone'
import { importWasm } from '../../../util/wasm'

// satori 0.16+ ships its own yoga.wasm (from yoga-layout, not yoga-wasm-web)
// Aliased via #og-image/yoga-wasm in compatibility.ts to the correct file path
export default {
  initWasmPromise: importWasm(import('#og-image/yoga-wasm' as string))
    .then(wasm => init(wasm)),
  satori: _satori,
}
