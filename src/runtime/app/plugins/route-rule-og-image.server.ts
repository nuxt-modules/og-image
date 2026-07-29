import { defineNuxtPlugin } from '#app'
import { routeRuleOgImage } from '../utils/plugins'

export default defineNuxtPlugin(nuxtApp => routeRuleOgImage(nuxtApp))
