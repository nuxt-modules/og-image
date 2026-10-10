import NuxtOgImage from 'nuxt-og-image'
import NuxtSiteConfig from 'nuxt-site-config'
import NuxtSeoShared from 'nuxtseo-shared'

for (const module of [NuxtOgImage, NuxtSiteConfig, NuxtSeoShared]) {
  const metadata = await module.getMeta()
  metadata.compatibility ||= {}
  metadata.compatibility.nuxt = `${metadata.compatibility.nuxt} || 5.0.0-2610061032-c7ad8cd`
}

export default defineNuxtConfig({
  workspaceDir: import.meta.dirname,
  vite: { resolve: { dedupe: ['nuxt', 'vue', 'vue-router'] } },
  modules: [NuxtSiteConfig, NuxtOgImage],
  ogImage: {
    enabled: process.env.NUXT_TEST_OG_DISABLED === '1' ? false : undefined,
    debug: true,
    security: {
      secret: false,
    },
  },
  site: {
    name: 'Nuxt 5 OG Image',
    url: 'https://og-image.example.com',
  },
  devtools: { enabled: false },
  compatibilityDate: '2026-06-10',
})
