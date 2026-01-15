import type { H3Event } from 'h3'
import type { FontConfig } from '../../../../types'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildDir } from '#og-image-virtual/build-dir.mjs'
import { getNitroOrigin } from '#site-config/server/composables'

let fontUrlMapping: Record<string, string> | null = null

async function loadFontUrlMapping(): Promise<Record<string, string>> {
  if (fontUrlMapping)
    return fontUrlMapping
  const content = await readFile(join(buildDir, 'cache', 'og-image', 'font-urls.json'), 'utf-8').catch(() => null)
  fontUrlMapping = content ? JSON.parse(content) : {}
  return fontUrlMapping
}

function getRootDir(): string {
  const idx = buildDir.indexOf('/.nuxt')
  return idx !== -1 ? buildDir.slice(0, idx) : process.cwd()
}

export async function resolve(event: H3Event, font: FontConfig): Promise<Buffer> {
  const path = font.src || font.localPath

  if (import.meta.prerender) {
    // @nuxt/fonts managed fonts - fetch from source using URL mapping
    if (path.startsWith('/_fonts/')) {
      const filename = path.slice('/_fonts/'.length)
      const mapping = await loadFontUrlMapping()
      if (mapping[filename]) {
        const res = await fetch(mapping[filename])
        if (res.ok)
          return Buffer.from(await res.arrayBuffer())
      }
      // Fallback to build cache (fonts may already be downloaded)
      const cached = await readFile(join(buildDir, 'cache', 'fonts', filename)).catch(() => null)
      if (cached?.length)
        return cached
      throw new Error(`Font ${filename} not found in mapping or cache`)
    }

    // Public directory fonts
    const filename = path.slice(1)
    const rootDir = getRootDir()
    const data = await readFile(join(rootDir, 'public', filename)).catch(() => null)
      || await readFile(join(rootDir, '.output', 'public', filename)).catch(() => null)
    if (data?.length)
      return data
    throw new Error(`Font ${filename} not found in public directory`)
  }

  // Runtime: HTTP fetch
  const arrayBuffer = await $fetch<ArrayBuffer>(path, {
    responseType: 'arrayBuffer',
    baseURL: getNitroOrigin(event),
  })
  return Buffer.from(arrayBuffer)
}
