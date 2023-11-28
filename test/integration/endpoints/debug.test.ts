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
            "category": "community",
            "credits": "NuxtLabs <https://nuxtlabs.com/>",
            "hash": "Y8Cv5a2BVV",
            "kebabName": "nuxt",
            "pascalName": "Nuxt",
          },
          {
            "category": "official",
            "hash": "QlFued2LU6",
            "kebabName": "branded-logo",
            "pascalName": "BrandedLogo",
          },
          {
            "category": "official",
            "hash": "IdN05D6pf9",
            "kebabName": "fallback",
            "pascalName": "Fallback",
          },
          {
            "category": "official",
            "hash": "ksAWfVlFKD",
            "kebabName": "simple-blog",
            "pascalName": "SimpleBlog",
          },
          {
            "category": "official",
            "hash": "jEJbMD36vp",
            "kebabName": "wave",
            "pascalName": "Wave",
          },
          {
            "category": "official",
            "hash": "wty22cZhxS",
            "kebabName": "with-emoji",
            "pascalName": "WithEmoji",
          },
        ],
        "runtimeConfig": {
          "defaults": {
            "cache": true,
            "cacheTtl": 86400000,
            "component": "Fallback",
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
