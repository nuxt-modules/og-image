import type { H3Event } from '#nuxtseo/h3'
import type { FontConfig } from '../../../../types'
import { readFile } from 'node:fs/promises'
import { join } from 'pathe'
import { withBase } from 'ufo'
import { getRequestURL } from '#nuxtseo/h3'
import { fetchWithEvent, useRuntimeConfig } from '#nuxtseo/nitro'
import { rootDir, staticFontCacheDir } from '#og-image-virtual/build-dir.mjs'
import { getSiteConfig } from '#site-config/server/composables'
import { getFetchTimeout } from '../../../util/fetchTimeout'
import { fetchWithRedirectValidation } from '../../../util/ssrf'
import { useOgImageRuntimeConfig } from '../../../utils'
import { fetchSpecialFontUrl, isDataFontUrl, isExternalFontUrl } from './external-url'

async function readOptionalFile(path: string): Promise<Buffer | null> {
  return readFile(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT')
      return null
    throw error
  })
}

export async function resolve(event: H3Event, font: FontConfig): Promise<Buffer> {
  const path = font.src || font.localPath
  const runtimeConfig = useOgImageRuntimeConfig()
  const timeout = getFetchTimeout(runtimeConfig)

  // Static bundled fonts — read directly from absolute path
  if (font.absolutePath) {
    const data = await readOptionalFile(font.absolutePath)
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
      const cached = await readOptionalFile(join(staticFontCacheDir, filename))
        || await readOptionalFile(join(rootDir, '.output', 'public', '_og-static-fonts', filename))
      if (cached?.length)
        return cached
    }

    const publicPath = path.slice(1)
    const data = await readOptionalFile(join(rootDir, 'public', publicPath))
      || await readOptionalFile(join(rootDir, '.output', 'public', publicPath))
    if (data?.length)
      return data
    // Fall through to Nitro's event-aware fetch, which resolves via the asset server.
  }

  // Static fonts — try og-image's cache first (dev mode)
  if (path.startsWith('/_og-static-fonts/')) {
    const filename = path.slice('/_og-static-fonts/'.length)
    const cached = await readOptionalFile(join(staticFontCacheDir, filename))
    if (cached?.length)
      return cached
  }

  // In dev, try reading public/ files directly from the filesystem first.
  // Native fetch to the Nuxt dev server can hit Vue Router SSR instead of
  // Vite's static file middleware, returning HTML instead of font data.
  if (import.meta.dev) {
    const filename = path.slice(1)
    const data = await readOptionalFile(join(rootDir, 'public', filename))
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
    const ab = await fetchWithRedirectValidation(target.href, { timeout, trustedHost: target.host }).catch(() => {
      // An unreachable dev origin falls through to Nitro's internal fetch.
      return null
    })
    if (ab) {
      return Buffer.from(ab)
    }
  }
  const fullPath = withBase(path, app.baseURL)
  const arrayBuffer = await fetchWithEvent<ArrayBuffer>(event, fullPath, {
    responseType: 'arrayBuffer',
    timeout,
  })
  return Buffer.from(arrayBuffer)
}
