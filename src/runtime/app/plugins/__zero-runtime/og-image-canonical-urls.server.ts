import { defineNuxtPlugin } from '#app'
import { ogImageCanonicalUrls } from '../../utils/plugins'

export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.dev || import.meta.prerender) {
    return ogImageCanonicalUrls(nuxtApp)
  }
})
