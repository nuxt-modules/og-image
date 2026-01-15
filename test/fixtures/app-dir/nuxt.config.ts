import NuxtOgImage from '../../../src/module'

// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  extends: ['../.base'],
  modules: [
    NuxtOgImage,
  ],
  site: {
    url: 'https://nuxtseo.com',
  },
  ogImage: {
    debug: true,
  },
  dir: {
    public: 'app/public',
  },
  srcDir: 'app/',
  devtools: { enabled: false },
})
