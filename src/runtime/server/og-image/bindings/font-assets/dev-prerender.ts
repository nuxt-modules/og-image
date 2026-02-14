import type { H3Event } from 'h3'
import type { FontConfig } from '../../../../types'
import { readFile } from 'node:fs/promises'
import { buildDir } from '#og-image-virtual/build-dir.mjs'
import { getNitroOrigin } from '#site-config/server/composables'
import { useRuntimeConfig } from 'nitropack/runtime'
import { join } from 'pathe'
import { withBase } from 'ufo'

function getRootDir(): string {
  const normalizedBuildDir = buildDir.replace(/\\/g, '/')
  const idx = normalizedBuildDir.indexOf('/.nuxt')
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

  // Static bundled fonts — read directly from absolute path
  if (font.absolutePath) {
    const data = await readFile(font.absolutePath).catch(() => null)
    if (data?.length)
      return data
  }

  if (import.meta.prerender) {
    const rootDir = getRootDir()

    // Satori static font downloads (separate from @nuxt/fonts to avoid conflicts)
    if (path.startsWith('/_og-satori-fonts/')) {
      const filename = path.slice('/_og-satori-fonts/'.length)
      const cached = await readFile(join(buildDir, 'cache', 'og-image', 'fonts-ttf', filename)).catch(() => null)
        || await readFile(join(rootDir, '.output', 'public', '_og-satori-fonts', filename)).catch(() => null)
      if (cached?.length)
        return cached
    }

    // @nuxt/fonts managed fonts
    if (path.startsWith('/_fonts/')) {
      const filename = path.slice('/_fonts/'.length)

      // Try .output/public/_fonts (WOFF/WOFF2 files from @nuxt/fonts)
      const cached = await readFile(join(rootDir, '.output', 'public', '_fonts', filename)).catch(() => null)
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
    // Module-provided publicAssets (e.g. _og-fonts) aren't in user's public/ dir
    // Fall through to event.$fetch which resolves via Nitro's asset server
  }

  // Satori static fonts — try og-image's cache first (dev mode)
  if (path.startsWith('/_og-satori-fonts/')) {
    const filename = path.slice('/_og-satori-fonts/'.length)
    const cached = await readFile(join(buildDir, 'cache', 'og-image', 'fonts-ttf', filename)).catch(() => null)
    if (cached?.length)
      return cached
  }

  // Use event.$fetch for internal routing — avoids network issues with IPv6/HTTPS dev server
  const { app } = useRuntimeConfig()
  const origin = getNitroOrigin(event)
  if (import.meta.dev && !origin.includes('::1')) {
    const arrayBuffer = await $fetch(withBase(path, app.baseURL), {
      responseType: 'arrayBuffer',
      baseURL: getNitroOrigin(event),
    }).catch(() => null) as ArrayBuffer
    if (arrayBuffer) {
      return Buffer.from(arrayBuffer)
    }
  }
  const fullPath = withBase(path, app.baseURL)
  const arrayBuffer = await event.$fetch(fullPath, {
    responseType: 'arrayBuffer',
  }) as ArrayBuffer
  return Buffer.from(arrayBuffer)
}
