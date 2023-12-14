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
        "compatibility": {
          "chromium": false,
          "css-inline": "node",
          "resvg": "node",
          "satori": "node",
          "sharp": "node",
        },
        "runtimeConfig": {
          "colorPreference": "light",
          "debug": true,
          "defaults": {
            "cacheMaxAgeSeconds": 259200,
            "component": "NuxtSeo",
            "emojis": "noto",
            "extension": "png",
            "height": 600,
            "renderer": "satori",
            "width": 1200,
          },
          "fonts": [
            {
              "cacheKey": "Inter:400",
              "key": "nuxt-og-image:fonts:inter-latin-ext-400-normal.woff",
              "name": "Inter",
              "path": "/__og-image__/font/Inter/400.ttf",
              "style": "normal",
              "weight": "400",
            },
            {
              "cacheKey": "Inter:700",
              "key": "nuxt-og-image:fonts:inter-latin-ext-700-normal.woff",
              "name": "Inter",
              "path": "/__og-image__/font/Inter/700.ttf",
              "style": "normal",
              "weight": "700",
            },
          ],
          "hasNuxtIcon": false,
          "resvgOptions": {},
          "satoriOptions": {},
          "sharpOptions": {},
        },
      }
    `)
  }, 60000)
})
