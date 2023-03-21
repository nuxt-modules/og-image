import { defineComponent } from 'vue'
import type { OgImageScreenshotOptions } from '../../types'
import { defineOgImageScreenshot } from '#imports'

export default defineComponent<OgImageScreenshotOptions>({
  name: 'OgImageScreenshot',
  setup(_, { attrs }) {
    // get attrs
    if (process.server)
      defineOgImageScreenshot(attrs)

    return () => null
  },
})
