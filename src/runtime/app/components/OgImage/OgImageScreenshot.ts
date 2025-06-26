import type { OgImagePageScreenshotOptions } from '../../../types'
import { defineComponent } from 'vue'
import { defineOgImageScreenshot } from '../../composables/defineOgImageScreenshot'

export default defineComponent<OgImagePageScreenshotOptions>({
  name: 'OgImageScreenshot',
  async setup(_, { attrs }) {
    // get attrs
    if (import.meta.server)
      defineOgImageScreenshot(attrs)

    return () => null
  },
})
