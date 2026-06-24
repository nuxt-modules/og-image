import type { H3Event } from 'h3'
import type { FontConfig } from '../../../../types'
import { readFile } from 'node:fs/promises'
import { getRequestURL } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import { join } from 'pathe'
import { withBase } from 'ufo'
import { buildDir, rootDir } from '#og-image-virtual/build-dir.mjs'
import { getSiteConfig } from '#site-config/server/composables'
import { getFetchTimeout } from '../../../util/fetchTimeout'
import { fetchWithRedirectValidation } from '../../../util/ssrf'
import { useOgImageRuntimeConfig } from '../../../utils'
import { fetchSpecialFontUrl, isDataFontUrl, isExternalFontUrl } from './external-url'

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
  const runtimeConfig = useOgImageRuntimeConfig()
  const timeout = getFetchTimeout(runtimeConfig)

  // Static bundled fonts — read directly from absolute path
  if (font.absolutePath) {
    const data = await readFile(font.absolutePath).catch(() => null)
    if (data?.length)
      return data
  }

  // `data:` and external font URLs are attacker-reachable via the `fonts` URL
  // param (GHSA-q8hw-4fvp-9rwv). None of the relative-path branches below match
  // them, so without this gate they fall through to an unvalidated fetch/$fetch.
  // `data:` is decoded inline; external URLs are unsupported (use @nuxt/fonts)
  // except the site's own origin, fetched through the SSRF guard.
  if (path && (isDataFontUrl(path) || isExternalFontUrl(path)))
    return fetchSpecialFontUrl(path, getSiteConfig(event).url, timeout)

  if (import.meta.prerender) {
    // Static font downloads (separate from @nuxt/fonts to avoid conflicts)
    if (path.startsWith('/_og-static-fonts/')) {
      const filename = path.slice('/_og-static-fonts/'.length)
      const cached = await readFile(join(buildDir, 'cache', 'og-image', 'fonts-ttf', filename)).catch(() => null)
        || await readFile(join(rootDir, '.output', 'public', '_og-static-fonts', filename)).catch(() => null)
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
        const res = await fetch(mapping[filename], { signal: AbortSignal.timeout(timeout) }).catch(() => null)
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
    // Fall through to event.$fetch which resolves via Nitro's asset server
  }

  // Static fonts — try og-image's cache first (dev mode)
  if (path.startsWith('/_og-static-fonts/')) {
    const filename = path.slice('/_og-static-fonts/'.length)
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
      const res = await fetch(mapping[filename], { signal: AbortSignal.timeout(timeout) }).catch(() => null)
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
    const target = new URL(withBase(path, app.baseURL), origin)
    // Same-origin dev fetch: trust our own (loopback) host but re-validate any
    // redirect that leaves it, so an open redirect can't reach an internal
    // target via the font path (GHSA-q8hw-4fvp-9rwv).
    const ab = await fetchWithRedirectValidation(target.href, { timeout, trustedHost: target.host }).catch(() => null)
    if (ab) {
      return Buffer.from(ab)
    }
  }
  const fullPath = withBase(path, app.baseURL)
  const fetchArrayBuffer = event.$fetch as unknown as (path: string, options: { responseType: 'arrayBuffer', timeout: number }) => Promise<ArrayBuffer>
  const arrayBuffer = await fetchArrayBuffer(fullPath, {
    responseType: 'arrayBuffer',
    timeout,
  })
  return Buffer.from(arrayBuffer)
}
