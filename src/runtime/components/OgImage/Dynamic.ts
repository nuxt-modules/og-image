import { defineComponent } from 'vue'
import type { OgImageOptions } from '../../types'
import { defineOgImageWithoutCache } from '#imports'

/**
 * @deprecated Use OgImageWithoutCache
 */
export default defineComponent<OgImageOptions>({
  name: 'OgImageDynamic',
  async setup(_, { attrs }) {
    if (import.meta.server)
      await defineOgImageWithoutCache(attrs)

    return () => null
  },
})
