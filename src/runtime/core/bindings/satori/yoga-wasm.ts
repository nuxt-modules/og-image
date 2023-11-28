import _satori, { init } from 'satori/wasm'
import initYoga from 'yoga-wasm-web'
import YogaWasm from 'yoga-wasm-web/dist/yoga.wasm'

export default {
  initWasmPromise: initYoga(YogaWasm).then(yoga => init(yoga)),
  satori: _satori,
}
