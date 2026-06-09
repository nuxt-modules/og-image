import { resolve } from 'pathe'

// Nuxt SEO devtools panel, shipped as a layer (Model C). Components flat-registered.
export default defineNuxtConfig({
  components: [{ path: resolve(__dirname, './components'), pathPrefix: false }],
})
