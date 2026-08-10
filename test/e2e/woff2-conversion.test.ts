import { existsSync, readFileSync } from 'node:fs'
import { createResolver } from '@nuxt/kit'
import { $fetch, setup, useTestContext } from '@nuxt/test-utils/e2e'
import { join } from 'pathe'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/woff2-conversion'),
  server: true,
  build: true,
})

function getConvertedFontFiles(): string[] {
  const ctx = useTestContext()
  const buildDir = ctx.nuxt!.options.buildDir
  const mappingPath = join(buildDir, 'cache', 'og-image', 'font-urls.json')
  const staticFontDir = join(buildDir, 'cache', 'og-image', 'static-fonts')
  const mapping = JSON.parse(readFileSync(mappingPath, 'utf8')) as Record<string, string>
  return Object.keys(mapping)
    .filter(filename => filename.endsWith('.woff2'))
    .map(filename => filename.replace(/\.woff2$/, '.woff'))
    .filter(filename => existsSync(join(staticFontDir, filename)))
}

describe('nuxt Fonts WOFF2 conversion', () => {
  it('preserves Nuxt Fonts assets as valid WOFF files', () => {
    const ctx = useTestContext()
    const staticFontDir = join(ctx.nuxt!.options.buildDir, 'cache', 'og-image', 'static-fonts')
    const convertedFonts = getConvertedFontFiles()

    expect(convertedFonts.length).toBeGreaterThan(0)
    for (const filename of convertedFonts) {
      const font = readFileSync(join(staticFontDir, filename))
      expect(font.subarray(0, 4)).toEqual(Buffer.from('wOFF'))
    }
  })

  it('serves converted assets from the static font route', async () => {
    const filename = getConvertedFontFiles()[0]!
    const font = await $fetch(`/_og-static-fonts/${filename}`, { responseType: 'arrayBuffer' }) as ArrayBuffer
    expect(Buffer.from(font).subarray(0, 4)).toEqual(Buffer.from('wOFF'))
  })
})
