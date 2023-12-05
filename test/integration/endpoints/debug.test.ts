import { describe, expect, it } from 'vitest'
import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../../fixtures/basic'),
})
describe('debug', () => {
  it('basic', async () => {
    const debug = await $fetch('/__og-image__/debug.json')
    delete debug.runtimeConfig.baseCacheKey
    delete debug.runtimeConfig.version
    delete debug.componentNames
    delete debug.baseCacheKey
    expect(debug).toMatchInlineSnapshot(`
      {
        "runtimeConfig": {
          "colorPreference": "light",
          "debug": true,
          "defaults": {
            "cacheMaxAgeSeconds": 259200,
            "component": "NuxtSeo",
            "emojis": "noto",
            "extension": "jpg",
            "height": 600,
            "renderer": "satori",
            "width": 1200,
          },
          "fonts": [
            {
              "key": "nuxt-og-image:fonts:inter-latin-ext-400-normal.woff",
              "name": "Inter",
              "weight": "400",
            },
            {
              "key": "nuxt-og-image:fonts:inter-latin-ext-700-normal.woff",
              "name": "Inter",
              "weight": "700",
            },
          ],
          "hasNuxtIcon": false,
          "resvgOptions": {},
          "runtimeChromium": true,
          "runtimeSatori": true,
          "satoriOptions": {},
          "sharpOptions": {},
        },
        "siteConfigUrl": {
          "source": "nuxt-site-config:config",
          "value": "https://nuxtseo.com",
        },
      }
    `)
  }, 60000)
})
