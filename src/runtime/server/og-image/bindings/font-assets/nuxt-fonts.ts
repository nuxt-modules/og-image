/**
 * A `renderedFontURLs` entry from the `fonts:public-asset-context` hook.
 *
 * `@nuxt/fonts` v0 (fontless 0.2) stores the source URL. v1 (fontless 0.4) stores a `RenderedFont`.
 */
export type RenderedFontURL = string | { url: string, init?: RequestInit }

/** A JSON-safe original source of a `@nuxt/fonts` asset. */
export interface NuxtFontSource {
  url: string
  headers?: Record<string, string>
}

/**
 * The `@nuxt/fonts` asset context, persisted at build time for dev and prerender.
 *
 * `assetsBaseURL` is `/_fonts` in dev and in `@nuxt/fonts` v0. Vite builds in v1
 * emit fonts under `buildAssetsDir`, so it becomes `/_nuxt/fonts`.
 */
export interface NuxtFontsManifest {
  assetsBaseURL: string
  /** Original source of each font, keyed by its served filename. */
  urls: Record<string, NuxtFontSource>
}

export const DEFAULT_NUXT_FONTS_ASSETS_BASE_URL = '/_fonts'

export function toNuxtFontSource(entry: RenderedFontURL): NuxtFontSource {
  if (typeof entry === 'string')
    return { url: entry }
  const headers = Object.fromEntries(new Headers(entry.init?.headers))
  return Object.keys(headers).length ? { url: entry.url, headers } : { url: entry.url }
}

/** Return the served filename when `path` is a `@nuxt/fonts` asset, else `undefined`. */
export function nuxtFontFilename(path: string, assetsBaseURL: string): string | undefined {
  const prefix = `${assetsBaseURL.replace(/\/$/, '')}/`
  if (!path.startsWith(prefix))
    return
  const filename = path.slice(prefix.length)
  if (!filename || filename.includes('/') || filename.includes('\\'))
    return
  return filename
}
