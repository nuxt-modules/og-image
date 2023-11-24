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
    expect(debug).toMatchInlineSnapshot(`
      {
        "baseCacheKey": "/cache/nuxt-og-image@2.2.4",
        "cachedKeys": [],
        "componentNames": [
          {
            "hash": "eInRfPPznm",
            "kebabName": "og-image-template-fallback",
            "pascalName": "OgImageTemplateFallback",
          },
        ],
        "runtimeConfig": {
          "assetDirs": [
            "/home/harlan/packages/nuxt-og-image/test/fixtures/basic/public",
            "/home/harlan/packages/nuxt-og-image/src/runtime/public-assets",
            "/home/harlan/packages/nuxt-og-image/src/runtime/public-assets-optional/inter-font",
            "/home/harlan/packages/nuxt-og-image/src/runtime/public-assets-optional/inter-font",
            "/home/harlan/packages/nuxt-og-image/src/runtime/public-assets-optional/resvg",
            "/home/harlan/packages/nuxt-og-image/src/runtime/public-assets-optional/yoga",
            "/home/harlan/packages/nuxt-og-image/src/runtime/public-assets-optional/svg2png",
          ],
          "defaults": {
            "cache": true,
            "cacheTtl": 86400000,
            "component": "OgImageTemplateFallback",
            "height": 630,
            "provider": "satori",
            "width": 1200,
          },
          "fonts": [
            {
              "name": "Inter",
              "weight": "400",
            },
            {
              "name": "Inter",
              "weight": "700",
            },
          ],
          "runtimeBrowser": false,
          "runtimeCacheStorage": "default",
          "runtimeSatori": true,
          "satoriOptions": {},
          "version": "2.2.4",
        },
        "siteConfigUrl": {
          "source": "nuxt-site-config:config",
          "value": "https://nuxtseo.com",
        },
      }
    `)
  }, 60000)
})
