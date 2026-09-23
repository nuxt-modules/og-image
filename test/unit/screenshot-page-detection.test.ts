import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createResolver } from '@nuxt/kit'
import { join } from 'pathe'
import { describe, expect, it } from 'vitest'
import { detectScreenshotPageUsage } from '../../src/util'

const { resolve } = createResolver(import.meta.url)

describe('detectScreenshotPageUsage', () => {
  it('detects the browser-prerender fixture pages that call defineOgImageScreenshot', async () => {
    const pagesDir = resolve('../fixtures/browser-prerender/pages')
    expect(await detectScreenshotPageUsage([pagesDir])).toBe(true)
  })

  it('detects usage nested in subdirectories', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'og-image-detect-'))
    try {
      mkdirSync(join(dir, 'pages/blog'), { recursive: true })
      writeFileSync(join(dir, 'pages/index.vue'), '<template><div /></template>')
      writeFileSync(join(dir, 'pages/blog/post.vue'), '<script setup>defineOgImageScreenshot()</script>')
      expect(await detectScreenshotPageUsage([dir])).toBe(true)
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('returns false when pages never call defineOgImageScreenshot', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'og-image-detect-'))
    try {
      mkdirSync(join(dir, 'pages'), { recursive: true })
      writeFileSync(join(dir, 'pages/index.vue'), '<script setup>defineOgImage({ renderer: \'satori\' })</script>')
      expect(await detectScreenshotPageUsage([dir])).toBe(false)
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('ignores mentions in HTML comments, template code samples, and disabled calls', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'og-image-detect-'))
    try {
      mkdirSync(join(dir, 'pages/docs'), { recursive: true })
      writeFileSync(
        join(dir, 'pages/docs/guide.vue'),
        `<template>
  <!-- use defineOgImageScreenshot() for screenshots -->
  <pre>defineOgImageScreenshot()</pre>
</template>

<script setup>
// defineOgImageScreenshot({ width: 1200 })
const example = 'defineOgImageScreenshot('
</script>
`,
      )
      expect(await detectScreenshotPageUsage([dir])).toBe(false)
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('still detects a real call when the template only mentions it in comments', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'og-image-detect-'))
    try {
      mkdirSync(join(dir, 'pages'), { recursive: true })
      writeFileSync(
        join(dir, 'pages/index.vue'),
        `<template>
  <!-- defineOgImageScreenshot() -->
</template>

<script setup>
defineOgImageScreenshot({ width: 1200 })
</script>
`,
      )
      expect(await detectScreenshotPageUsage([dir])).toBe(true)
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('returns false for missing directories', async () => {
    expect(await detectScreenshotPageUsage([join(tmpdir(), 'og-image-detect-missing')])).toBe(false)
  })
})
