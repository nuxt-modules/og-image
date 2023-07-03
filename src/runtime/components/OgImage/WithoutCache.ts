import { defineComponent } from 'vue'
import type { OgImageOptions } from '../../../types'
import { defineOgImageWithoutCache } from '#imports'

export default defineComponent<OgImageOptions>({
  name: 'OgImageWithoutCache',
  async setup(_, { attrs }) {
    if (process.server)
      defineOgImageWithoutCache(attrs)

    return () => null
  },
})
