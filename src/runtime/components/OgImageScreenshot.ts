import { defineComponent } from 'vue'
import type { OgImageScreenshotOptions } from '../../types'
import { defineOgImageScreenshot } from '#imports'

export default defineComponent<OgImageScreenshotOptions>({
  name: 'OgImageScreenshot',
  setup(_, { attrs }) {
    // get attrs
    defineOgImageScreenshot(attrs)
    return () => null
  },
})
