import { defineComponent } from 'vue'
import type { OgImageOptions } from '../../types'
import { defineOgImage } from '#imports'

export default defineComponent<OgImageOptions>({
  name: 'OgImage',
  async setup(_, { attrs }) {
    if (process.server)
      // just use defaults
      await defineOgImage(attrs)

    return () => null
  },
})
