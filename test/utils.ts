import type { MatchImageSnapshotOptions } from 'jest-image-snapshot'
import { $fetch } from '@nuxt/test-utils/e2e'
import { configureToMatchImageSnapshot } from 'jest-image-snapshot'
import { expect } from 'vitest'

/**
 * Extract the first og:image URL path from HTML.
 * Handles both attribute orderings and absolute/relative URLs.
 */
export function extractOgImageUrl(html: string): string | null {
  const match = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
    || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)
  if (!match?.[1])
    return null
  try {
    const url = new URL(match[1])
    return url.pathname
  }
  catch {
    return match[1]
  }
}

/**
 * Extract URL path from an absolute URL string.
 */
function extractPath(urlStr: string): string {
  try {
    return new URL(urlStr).pathname
  }
  catch {
    return urlStr
  }
}

/**
 * Extract all og:image and twitter:image URL paths from HTML.
 */
export function extractImageUrls(html: string): { og: string[], twitter: string[] } {
  const ogMatches = html.matchAll(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/g)
  const twitterMatches = html.matchAll(/<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"/g)
  return {
    og: Array.from(ogMatches, m => extractPath(m[1]!)),
    twitter: Array.from(twitterMatches, m => extractPath(m[1]!)),
  }
}

/**
 * Fetch a page, extract the og:image URL, and fetch the .html preview.
 */
export async function fetchOgHtml(pagePath: string): Promise<string | null> {
  const html = await $fetch(pagePath).catch(() => '') as string
  if (!html)
    return null
  const ogUrl = extractOgImageUrl(html)
  if (!ogUrl)
    return null
  return await $fetch(ogUrl.replace(/\.png$/, '.html')).catch(() => '') as string
}

/**
 * Fetch a page, extract the og:image URL, and fetch the image as a Buffer.
 */
export async function fetchOgImage(pagePath: string): Promise<Buffer> {
  const html = await $fetch(pagePath) as string
  const ogUrl = extractOgImageUrl(html)
  expect(ogUrl).toBeTruthy()
  const image: ArrayBuffer = await $fetch(ogUrl!, { responseType: 'arrayBuffer' })
  return Buffer.from(image)
}

/**
 * Poll until a condition is met or timeout.
 */
export async function waitFor(fn: () => Promise<boolean>, { timeout = 15000, interval = 500 } = {}): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await fn())
      return
    await new Promise(r => setTimeout(r, interval))
  }
  throw new Error(`waitFor timed out after ${timeout}ms`)
}

/**
 * Parse PNG dimensions from the file header.
 */
export function getImageDimensions(buffer: Buffer): { width: number, height: number } {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    }
  }
  throw new Error('Not a valid PNG')
}

// Snapshot threshold presets
export const SNAPSHOT_STRICT: MatchImageSnapshotOptions = {
  customDiffConfig: { threshold: 0.1 },
  failureThresholdType: 'percent',
  failureThreshold: 0.1,
}

export const SNAPSHOT_DEFAULT: MatchImageSnapshotOptions = {
  failureThresholdType: 'percent',
  failureThreshold: 0.5,
}

export const SNAPSHOT_LOOSE: MatchImageSnapshotOptions = {
  failureThresholdType: 'percent',
  failureThreshold: 1,
}

/**
 * Fetch multiple OG images in parallel. Returns a Map of pagePath → Buffer.
 * Use this within a single `it()` to parallelize independent image fetches.
 */
export async function fetchOgImages(...pagePaths: string[]): Promise<Map<string, Buffer>> {
  const entries = await Promise.all(
    pagePaths.map(async (path) => {
      const buf = await fetchOgImage(path)
      return [path, buf] as const
    }),
  )
  return new Map(entries)
}

/**
 * Configure and register image snapshot matcher on `expect`.
 */
export function setupImageSnapshots(opts?: MatchImageSnapshotOptions) {
  const toMatchImageSnapshot = configureToMatchImageSnapshot(opts ?? SNAPSHOT_DEFAULT)
  expect.extend({ toMatchImageSnapshot })
}
