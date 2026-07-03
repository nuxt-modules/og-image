import init, { Renderer } from '@takumi-rs/wasm/no-bundler'
import { extractResourceUrls } from './resource-urls'

const wasmBinary = import('@takumi-rs/wasm/takumi_wasm_bg.wasm?module' as string)
  .then(m => m.default || m)

export default {
  initWasmPromise: wasmBinary.then(wasm => init({ module_or_path: wasm })),
  Renderer,
  extractResourceUrls,
}
