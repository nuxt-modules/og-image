import { fileURLToPath } from 'node:url'
import { resolve } from 'pathe'

const currentDir = fileURLToPath(new URL('.', import.meta.url))

// Nuxt SEO devtools panel, shipped as a layer (Model C). Components flat-registered.
export default defineNuxtConfig({
  components: [{ path: resolve(currentDir, './components'), pathPrefix: false }],
})
