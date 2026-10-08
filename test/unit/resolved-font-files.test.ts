import { readFile, rm } from 'node:fs/promises'
import { join } from 'pathe'
import { describe, expect, it } from 'vitest'
import { cacheResolvedFontFiles } from '../../src/build/fonts'

describe('resolved font files', () => {
  it('copies served bytes without public assets or a Nuxt Fonts cache', async () => {
    const dir = join(process.env.HOME!, 'scratch', `og-resolved-fonts-${crypto.randomUUID()}`)
    const files = new Map([
      ['/docs/_nuxt/fonts/a.woff2', async () => Buffer.from('provider subset')],
      ['/docs/fonts/a.woff2', async () => Buffer.from('local font')],
    ])
    try {
      const paths = await cacheResolvedFontFiles(files, dir)
      expect(await readFile(paths['/docs/_nuxt/fonts/a.woff2']!, 'utf8')).toBe('provider subset')
      expect(await readFile(paths['/docs/fonts/a.woff2']!, 'utf8')).toBe('local font')
      files.set('/docs/fonts/a.woff2', async () => Buffer.from('updated font'))
      const updated = await cacheResolvedFontFiles(files, dir)
      expect(await readFile(updated['/docs/fonts/a.woff2']!, 'utf8')).toBe('updated font')
    }
    finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('propagates a failed read instead of using stale output', async () => {
    const files = new Map([['/docs/font.woff2', async (): Promise<Buffer> => {
      throw new Error('font unavailable')
    }]])
    await expect(cacheResolvedFontFiles(files, '/unused')).rejects.toThrow('font unavailable')
  })
})
