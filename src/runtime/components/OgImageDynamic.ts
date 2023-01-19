import { defineComponent } from 'vue'
import type { OgImageOptions } from '../../types'
import { defineOgImageDynamic } from '#imports'

export default defineComponent<OgImageOptions>({
  name: 'OgImageDynamic',
  setup(_, { attrs }) {
    defineOgImageDynamic(attrs)
    return () => null
  },
})
