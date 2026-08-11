import init, { Renderer } from '@takumi-rs/wasm/no-bundler'
import { extractResourceUrls } from './resource-urls'

let initPromise: ReturnType<typeof init> | undefined

export default {
  // Lazily created on first access: bundlers targeting single-file workers
  // (e.g. Nitro presets with `inlineDynamicImports`) evaluate this module at
  // isolate boot, so an eagerly created promise would compile the WASM on
  // every cold start even for requests that never render an OG image.
  get initWasmPromise(): ReturnType<typeof init> {
    initPromise ??= import('@takumi-rs/wasm/takumi_wasm_bg.wasm?module' as string)
      .then(m => m.default || m)
      .then(wasm => init({ module_or_path: wasm }))
    return initPromise
  },
  Renderer,
  extractResourceUrls,
}
