import { defineComponent } from 'vue'
import type { OgImagePayload } from '../../types'
import { defineOgImageStatic } from '#imports'

export default defineComponent<OgImagePayload>({
  name: 'OgImageStatic',
  setup(_, { attrs }) {
    defineOgImageStatic(attrs)
    return () => null
  },
})
