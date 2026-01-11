// @ts-expect-error optional dependency
import { Renderer } from '@takumi-rs/core'

export default {
  initWasmPromise: Promise.resolve(),
  Renderer,
}
