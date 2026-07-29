import type { H3Event } from 'h3'
import { getRequestURL } from 'h3'
import { getCloudflareEnv } from './cloudflare'

interface AssetsBinding {
  fetch: (request: string | Request, init?: RequestInit) => Promise<Response>
}

/**
 * Access the Cloudflare Workers ASSETS binding if available.
 *
 * Requires either:
 * - `nitro.cloudflare.deployConfig: true` (generates wrangler.json with ASSETS)
 * - A wrangler.toml/json with `[assets]` configured
 */
export function getCloudflareAssets(event: H3Event): AssetsBinding | undefined {
  const assets = getCloudflareEnv(event)?.ASSETS || event.context.ASSETS
  return typeof assets === 'object'
    && assets !== null
    && 'fetch' in assets
    && typeof assets.fetch === 'function'
    ? assets as AssetsBinding
    : undefined
}

/**
 * Fetch a path directly from the CF Workers ASSETS binding.
 *
 * Prefer this over same-origin subrequests on Workers: it hits the static asset
 * handler without billing a subrequest and without re-running the Worker's
 * middleware chain.
 *
 * Returns `undefined` when no ASSETS binding is available or the asset doesn't
 * exist (letting callers fall through to other resolution strategies).
 */
export async function tryCloudflareAssetsFetch(
  event: H3Event,
  path: string,
  signal?: AbortSignal,
): Promise<ArrayBuffer | undefined> {
  const assets = getCloudflareAssets(event)
  if (!assets)
    return
  const origin = getRequestURL(event).origin
  const url = new URL(path, origin).href
  const res = await assets.fetch(url, signal ? { signal } : undefined).catch(() => {
    // Binding failures fall through to the caller's other asset sources.
    return null
  })
  if (!res || !res.ok)
    return
  return res.arrayBuffer()
}
