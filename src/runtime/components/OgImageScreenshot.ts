import { defineComponent } from 'vue'
import type { OgImageScreenshotPayload } from '../../types'
import { defineOgImageScreenshot } from '#imports'

export default defineComponent<OgImageScreenshotPayload>({
  name: 'OgImageScreenshot',
  setup(_, { attrs }) {
    // get attrs
    defineOgImageScreenshot(attrs)
    return () => null
  },
})
