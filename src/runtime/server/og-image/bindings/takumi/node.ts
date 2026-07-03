import { Renderer } from '@takumi-rs/core'
import { extractResourceUrls } from './resource-urls'

export default {
  initWasmPromise: Promise.resolve(),
  Renderer,
  extractResourceUrls,
}
