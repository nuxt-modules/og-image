import { defineComponent } from 'vue'
import type { OgImagePayload } from '../../types'
import { defineOgImage } from '#imports'

export default defineComponent<OgImagePayload>({
  name: 'OgImage',
  setup(_, { attrs }) {
    defineOgImage(attrs)
    return () => null
  },
})
