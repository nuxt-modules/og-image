import type { H3Event } from 'h3'
import type { FontConfig } from '../../../../types'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildDir } from '#og-image-virtual/build-dir.mjs'
import { getNitroOrigin } from '#site-config/server/composables'
import { useRuntimeConfig } from 'nitropack/runtime'
import { withBase } from 'ufo'

let fontUrlMapping: Record<string, string> | undefined

async function loadFontUrlMapping(): Promise<Record<string, string>> {
  if (fontUrlMapping)
    return fontUrlMapping
  const content = await readFile(join(buildDir, 'cache', 'og-image', 'font-urls.json'), 'utf-8').catch(() => null)
  fontUrlMapping = content ? JSON.parse(content) : {}
  return fontUrlMapping!
}

function getRootDir(): string {
  const idx = buildDir.indexOf('/.nuxt')
  return idx !== -1 ? buildDir.slice(0, idx) : process.cwd()
}

export async function resolve(event: H3Event, font: FontConfig): Promise<Buffer> {
  const path = font.src || font.localPath
  const rootDir = getRootDir()

  if (import.meta.prerender) {
    // @nuxt/fonts managed fonts (includes converted TTFs from WOFF2)
    if (path.startsWith('/_fonts/')) {
      const filename = path.slice('/_fonts/'.length)

      // Try filesystem locations first (faster, no network)
      // For converted TTF files, check og-image's cache first
      if (filename.endsWith('.ttf')) {
        const ttfCached = await readFile(join(buildDir, 'cache', 'og-image', 'fonts-ttf', filename)).catch(() => null)
        if (ttfCached?.length)
          return ttfCached
      }
      // Try .output/public/_fonts (includes WOFF files and copied TTFs)
      const cached = await readFile(join(rootDir, '.output', 'public', '_fonts', filename)).catch(() => null)
      if (cached?.length)
        return cached

      // Try external URL from mapping
      const mapping = await loadFontUrlMapping()
      if (mapping[filename]) {
        const res = await fetch(mapping[filename]).catch(() => null)
        if (res?.ok)
          return Buffer.from(await res.arrayBuffer())
      }
      throw new Error(`Font ${filename} not found in mapping or cache`)
    }

    // Public directory fonts
    const filename = path.slice(1)
    const data = await readFile(join(rootDir, 'public', filename)).catch(() => null)
      || await readFile(join(rootDir, '.output', 'public', filename)).catch(() => null)
    if (data?.length)
      return data
    throw new Error(`Font ${filename} not found in public directory`)
  }

  // Runtime: HTTP fetch - need to include app baseURL for font paths
  // For converted TTF fonts, try og-image's TTF cache first
  if (path.startsWith('/_fonts/') && path.endsWith('.ttf')) {
    const filename = path.slice('/_fonts/'.length)
    // Try og-image's own cache directory (survives Nitro's cache clearing)
    const cached = await readFile(join(buildDir, 'cache', 'og-image', 'fonts-ttf', filename)).catch(() => null)
    if (cached?.length)
      return cached
  }

  const { app } = useRuntimeConfig()
  const fullPath = withBase(path, app.baseURL)
  const arrayBuffer = await $fetch(fullPath, {
    responseType: 'arrayBuffer',
    baseURL: getNitroOrigin(event),
  }) as ArrayBuffer
  return Buffer.from(arrayBuffer)
}
