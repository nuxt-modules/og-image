import { defineNuxtPlugin } from '#app'
import { ogImageCanonicalUrls } from '../utils/plugins'

export default defineNuxtPlugin(nuxtApp => ogImageCanonicalUrls(nuxtApp))
