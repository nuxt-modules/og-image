import { defineComponent } from 'vue'
import { defineOgImage } from '#imports'

export default defineComponent<{
  title?: string
  description?: string
  component?: string
}>({
  name: 'OgImage',
  setup(_, { attrs }) {
    defineOgImage(attrs)
    return () => null
  },
})
