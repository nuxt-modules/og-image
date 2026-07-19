import { defineNuxtPlugin } from '#app'
import { routeRuleOgImage } from '../../utils/plugins'

export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.dev || import.meta.prerender) {
    return routeRuleOgImage(nuxtApp)
  }
})
