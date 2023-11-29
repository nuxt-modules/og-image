import _satori, { init } from 'satori/wasm'
import initYoga from 'yoga-wasm-web'
import { importWasm } from '../../utils/wasm'

export default {
  initWasmPromise: initYoga(importWasm(import('yoga-wasm-web/dist/yoga.wasm' as string))).then(yoga => init(yoga)),
  satori: _satori,
}
