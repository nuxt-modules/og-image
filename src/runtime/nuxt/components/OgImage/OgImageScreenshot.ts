import { defineOgImageScreenshot } from '#imports'
import { defineComponent } from 'vue'
import type { OgImagePageScreenshotOptions } from '../../../types'

export default defineComponent<OgImagePageScreenshotOptions>({
  name: 'OgImageScreenshot',
  async setup(_, { attrs }) {
    // get attrs
    if (import.meta.server)
      defineOgImageScreenshot(attrs)

    return () => null
  },
})
