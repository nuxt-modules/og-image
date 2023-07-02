import { defineComponent } from 'vue'
import type { OgImageScreenshotOptions } from '../../../types'
import { defineOgImageScreenshot } from '#imports'

export default defineComponent<OgImageScreenshotOptions>({
  name: 'OgImageScreenshot',
  async setup(_, { attrs }) {
    // get attrs
    if (process.server)
      await defineOgImageScreenshot(attrs)

    return () => null
  },
})
