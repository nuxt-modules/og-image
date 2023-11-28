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
    delete debug.baseCacheKey
    delete debug.runtimeConfig.version
    delete debug.componentNames
    expect(debug).toMatchInlineSnapshot(`
      {
        "cachedKeys": [],
        "runtimeConfig": {
          "defaults": {
            "cache": true,
            "cacheTtl": 86400000,
            "component": "Fallback",
            "extension": "jpg",
            "height": 600,
            "renderer": "satori",
            "width": 1200,
          },
          "fonts": [
            {
              "name": "Inter",
              "path": "",
              "weight": "400",
            },
            {
              "name": "Inter",
              "path": "",
              "weight": "700",
            },
          ],
          "hasNuxtIcon": false,
          "resvgOptions": {},
          "runtimeBrowser": true,
          "runtimeCacheStorage": "default",
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
