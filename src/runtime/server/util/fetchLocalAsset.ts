import type { H3Event } from 'h3'
import { getNitroOrigin } from '#site-config/server/composables'
import { $fetch } from 'ofetch'
import { tryCloudflareAssetsFetch } from './cloudflareAssets'

export interface FetchLocalAssetOptions {
  fetchTimeout: number
  headers?: Record<string, string>
  /**
   * Also attempt an external HTTP fetch to `getNitroOrigin(event) + path` when
   * ASSETS and Nitro localFetch both miss. Enable for platforms where static
   * files are served by edge routing that never reaches the Nitro handler
   * (Vercel, Netlify). Disable for CF Workers where no ASSETS means no assets.
   */
  includeExternalFallback?: boolean
  onStepFailure?: (url: string, err: unknown) => void
}

/**
 * Resolve a same-origin asset path to bytes, trying (in order):
 *   1. Cloudflare Workers ASSETS binding
 *   2. Nitro localFetch (`event.$fetch`) — resolves dynamic routes too
 *   3. External `$fetch` to the Nitro origin (opt-in)
 *
 * All steps share a single `AbortSignal.timeout(fetchTimeout)` so a broken
 * URL can't burn N× the configured budget.
 *
 * Returns `undefined` when every step fails or times out.
 */
export async function fetchLocalAsset(
  event: H3Event,
  path: string,
  options: FetchLocalAssetOptions,
): Promise<ArrayBuffer | undefined> {
  const { fetchTimeout, headers, includeExternalFallback = false, onStepFailure } = options
  const deadline = AbortSignal.timeout(fetchTimeout)

  // Caller-side timeout enforcement: some transports (notably Nitro's
  // event.$fetch on Cloudflare Workers) don't propagate AbortSignal to the
  // in-process handler, so a hung upstream blocks beyond fetchTimeout. Race
  // each step against a shared timer so the deadline is enforced regardless.
  let expired = false
  const timer = new Promise<undefined>((resolve) => {
    setTimeout(() => {
      expired = true
      resolve(undefined)
    }, fetchTimeout)
  })
  const race = <T>(p: Promise<T | undefined>): Promise<T | undefined> => Promise.race([p, timer])

  let result = await race(tryCloudflareAssetsFetch(event, path, deadline).catch((err) => {
    onStepFailure?.(path, err)
    return undefined
  }))
  if (result || expired)
    return result

  result = await race(event.$fetch(path, {
    responseType: 'arrayBuffer',
    signal: deadline,
    timeout: fetchTimeout,
    headers,
  }).catch((err: unknown) => {
    onStepFailure?.(path, err)
    return undefined
  }) as Promise<ArrayBuffer | undefined>)
  if (result || expired || !includeExternalFallback)
    return result

  const absolute = `${getNitroOrigin(event)}${path}`
  return await race($fetch(absolute, {
    responseType: 'arrayBuffer',
    signal: deadline,
    timeout: fetchTimeout,
    headers,
  }).catch((err: unknown) => {
    onStepFailure?.(absolute, err)
    return undefined
  }) as Promise<ArrayBuffer | undefined>)
}
