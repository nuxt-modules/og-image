import { readFileSync } from 'node:fs'
import { createResolver } from '@nuxt/kit'
import { $fetch, setup, useTestContext } from '@nuxt/test-utils/e2e'
import { join } from 'pathe'
import { describe, expect, it } from 'vitest'
import { getConvertedFontFiles } from '../utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/woff2-conversion'),
  server: true,
  build: true,
})

describe('nuxt Fonts WOFF2 conversion', () => {
  it('preserves Nuxt Fonts assets as valid TTF files', () => {
    const ctx = useTestContext()
    const staticFontDir = join(ctx.nuxt!.options.buildDir, 'cache', 'og-image', 'static-fonts')
    const convertedFonts = getConvertedFontFiles(ctx.nuxt!.options.buildDir)

    expect(convertedFonts.length).toBeGreaterThan(0)
    for (const filename of convertedFonts) {
      const font = readFileSync(join(staticFontDir, filename))
      expect(font.subarray(0, 4)).toEqual(Buffer.from([0, 1, 0, 0]))
    }
  })

  it('serves converted assets from the static font route', async () => {
    const filename = getConvertedFontFiles(useTestContext().nuxt!.options.buildDir)[0]!
    const font = await $fetch(`/_og-static-fonts/${filename}`, { responseType: 'arrayBuffer' }) as ArrayBuffer
    expect(Buffer.from(font).subarray(0, 4)).toEqual(Buffer.from([0, 1, 0, 0]))
  })
})
