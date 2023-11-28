import { defineComponent } from 'vue'
import type { OgImageOptions } from '../../types'
import { defineOgImageCached } from '#imports'

/**
 * @deprecated Use OgImageCached instead
 */
export default defineComponent<OgImageOptions>({
  name: 'OgImageStatic',
  async setup(_, { attrs }) {
    if (import.meta.server)
      await defineOgImageCached(attrs)

    return () => null
  },
})
