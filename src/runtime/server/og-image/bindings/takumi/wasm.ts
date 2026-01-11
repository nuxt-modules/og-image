// @ts-expect-error optional dependency
import { init, Renderer } from '@takumi-rs/wasm'

const wasmBinary = import('@takumi-rs/wasm/wasm?module' as string)
  .then(m => m.default || m)

export default {
  initWasmPromise: wasmBinary.then(wasm => init(wasm)),
  Renderer,
}
