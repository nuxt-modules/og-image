import { defineComponent } from 'vue'
import { defineOgImageScreenshot } from '#imports'

export default defineComponent<{
  title?: string
  description?: string
  component?: string
}>({
  name: 'OgImageScreenshot',
  setup() {
    // get attrs
    defineOgImageScreenshot()
    return () => null
  },
})
