import { defineOgImage as _defineOgImage } from './defineOgImage'
import { defineOgImageComponent as _defineOgImageComponent } from './defineOgImageComponent'
import { defineOgImageScreenshot as _defineOgImageScreenshot } from './defineOgImageScreenshot'

// zeroRuntime builds serve images only from prerendered files: there is no /_og/d/ handler.
// Outside prerender these calls do nothing, so a server rendered page never points at a
// missing image. `import.meta.prerender` is a build constant, so the runtime bundles drop
// the real composables.

export const defineOgImage: typeof _defineOgImage = (...args) =>
  import.meta.prerender ? _defineOgImage(...args) : []

/**
 * @deprecated Use `defineOgImage()` instead.
 */
export const defineOgImageComponent: typeof _defineOgImageComponent = (...args) =>
  import.meta.prerender ? _defineOgImageComponent(...args) : []

export const defineOgImageScreenshot: typeof _defineOgImageScreenshot = (...args) =>
  import.meta.prerender ? _defineOgImageScreenshot(...args) : []
