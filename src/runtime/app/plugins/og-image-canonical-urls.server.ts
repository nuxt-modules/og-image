import { defineNuxtPlugin } from '#app'
import { ogImageCanonicalUrls as setup } from '../utils/plugins'

export default defineNuxtPlugin({
  setup(nuxtApp) {
    setup(nuxtApp)
  },
})
