import { defineComponent } from 'vue'
import type { OgImagePayload } from '../../types'
import { defineOgImageDynamic } from '#imports'

export default defineComponent<OgImagePayload>({
  name: 'OgImageDynamic',
  setup(_, { attrs }) {
    defineOgImageDynamic(attrs)
    return () => null
  },
})
