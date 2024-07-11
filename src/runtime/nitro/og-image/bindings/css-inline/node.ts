// @ts-expect-error optional dependency
import { inline } from '@css-inline/css-inline'

export default {
  initWasmPromise: Promise.resolve(),
  cssInline: {
    inline,
  },
}
