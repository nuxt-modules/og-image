import type { H3Event } from 'h3'
import type { FontConfig } from '../../../../types'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildDir } from '#og-image-virtual/build-dir.mjs'
import { useRuntimeConfig } from 'nitropack/runtime'
import { withBase } from 'ufo'

function getRootDir(): string {
  const idx = buildDir.indexOf('/.nuxt')
  return idx !== -1 ? buildDir.slice(0, idx) : process.cwd()
}

let fontUrlMapping: Record<string, string> | undefined

async function loadFontUrlMapping(): Promise<Record<string, string>> {
  if (fontUrlMapping)
    return fontUrlMapping
  const content = await readFile(join(buildDir, 'cache', 'og-image', 'font-urls.json'), 'utf-8').catch(() => null)
  fontUrlMapping = content ? JSON.parse(content) : {}
  return fontUrlMapping!
}

export async function resolve(event: H3Event, font: FontConfig): Promise<Buffer> {
  const path = font.src || font.localPath

  if (import.meta.prerender) {
    const rootDir = getRootDir()

    if (path.startsWith('/_fonts/')) {
      const filename = path.slice('/_fonts/'.length)

      const cached = await readFile(join(buildDir, 'cache', 'fonts', filename)).catch(() => null)
        || await readFile(join(rootDir, '.output', 'public', '_fonts', filename)).catch(() => null)
      if (cached?.length)
        return cached

      const mapping = await loadFontUrlMapping()
      if (mapping[filename]) {
        const res = await fetch(mapping[filename]).catch(() => null)
        if (res?.ok)
          return Buffer.from(await res.arrayBuffer())
      }
      throw new Error(`Font ${filename} not found in mapping or cache`)
    }

    const filename = path.slice(1)
    const data = await readFile(join(rootDir, 'public', filename)).catch(() => null)
      || await readFile(join(rootDir, '.output', 'public', filename)).catch(() => null)
    if (data?.length)
      return data
    throw new Error(`Font ${filename} not found in public directory`)
  }

  // Dev: use event.$fetch for internal routing (handles @nuxt/fonts on-demand serving)
  const { app } = useRuntimeConfig()
  const fullPath = withBase(path, app.baseURL)
  const arrayBuffer = await event.$fetch(fullPath, {
    responseType: 'arrayBuffer',
  }) as ArrayBuffer
  return Buffer.from(arrayBuffer)
}
