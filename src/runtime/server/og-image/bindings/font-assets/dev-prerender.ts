import type { H3Event } from 'h3'
import type { FontConfig } from '../../../../types'
import { readFile } from 'node:fs/promises'
import { buildDir, rootDir } from '#og-image-virtual/build-dir.mjs'
import { getRequestURL } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import { join } from 'pathe'
import { withBase } from 'ufo'

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

  // @nuxt/fonts managed fonts — in dev mode, /_fonts/ is served by a Nuxt dev server handler
  // (addDevServerHandler) which isn't reachable via event.$fetch (Nitro-internal only).
  // Use the persisted font URL mapping to download directly from the CDN.
  if (import.meta.dev && path.startsWith('/_fonts/')) {
    const filename = path.slice('/_fonts/'.length)
    const mapping = await loadFontUrlMapping()
    if (mapping[filename]) {
      const res = await fetch(mapping[filename]).catch(() => null)
      if (res?.ok)
        return Buffer.from(await res.arrayBuffer())
    }
  }

  // In dev, try reading public/ files directly from the filesystem first.
  // Native fetch to the Nuxt dev server can hit Vue Router SSR instead of
  // Vite's static file middleware, returning HTML instead of font data.
  if (import.meta.dev) {
    const filename = path.slice(1)
    const data = await readFile(join(rootDir, 'public', filename)).catch(() => null)
    if (data?.length)
      return data
  }

  const { app } = useRuntimeConfig()
  if (import.meta.dev) {
    const reqUrl = getRequestURL(event)
    const origin = `${reqUrl.protocol}//${reqUrl.host}`
    const url = new URL(withBase(path, app.baseURL), origin).href
    const res = await fetch(url).catch(() => null)
    if (res?.ok) {
      return Buffer.from(await res.arrayBuffer())
    }
  }
  const fullPath = withBase(path, app.baseURL)
  const arrayBuffer = await event.$fetch(fullPath, {
    responseType: 'arrayBuffer',
  }) as ArrayBuffer
  return Buffer.from(arrayBuffer)
}
