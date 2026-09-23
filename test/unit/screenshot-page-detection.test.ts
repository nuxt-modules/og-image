import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createResolver } from '@nuxt/kit'
import { join } from 'pathe'
import { describe, expect, it } from 'vitest'
import { detectScreenshotPageUsage } from '../../src/util'

const { resolve } = createResolver(import.meta.url)

describe('detectScreenshotPageUsage', () => {
  it('detects the browser-prerender fixture pages that call defineOgImageScreenshot', () => {
    const pagesDir = resolve('../fixtures/browser-prerender/pages')
    expect(detectScreenshotPageUsage([pagesDir])).toBe(true)
  })

  it('detects usage nested in subdirectories', () => {
    const dir = mkdtempSync(join(tmpdir(), 'og-image-detect-'))
    try {
      mkdirSync(join(dir, 'pages/blog'), { recursive: true })
      writeFileSync(join(dir, 'pages/index.vue'), '<template><div /></template>')
      writeFileSync(join(dir, 'pages/blog/post.vue'), '<script setup>defineOgImageScreenshot()</script>')
      expect(detectScreenshotPageUsage([dir])).toBe(true)
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('returns false when pages never call defineOgImageScreenshot', () => {
    const dir = mkdtempSync(join(tmpdir(), 'og-image-detect-'))
    try {
      mkdirSync(join(dir, 'pages'), { recursive: true })
      writeFileSync(join(dir, 'pages/index.vue'), '<script setup>defineOgImage({ renderer: \'satori\' })</script>')
      expect(detectScreenshotPageUsage([dir])).toBe(false)
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('returns false for missing directories', () => {
    expect(detectScreenshotPageUsage([join(tmpdir(), 'og-image-detect-missing')])).toBe(false)
  })
})
