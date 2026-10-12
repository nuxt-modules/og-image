import _satori, { init } from 'satori/standalone'
import { importWasm } from '../../../util/wasm'

// Load the bundled layout engine for runtimes that require compiled WASM.
// The compatibility layer aliases the matching Satori binary.
export default {
  initWasmPromise: importWasm(import('#og-image/layout-wasm' as string))
    .then(wasm => init(wasm)),
  satori: _satori,
}
