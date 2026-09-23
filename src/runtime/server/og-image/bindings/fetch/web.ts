// Edge fetch for the SSRF guard (Cloudflare, Vercel Edge, Netlify Edge,
// WebContainers). These runtimes have no DNS API, so only the literal host
// check in `fetchWithRedirectValidation` runs. Edge requests leave from the
// provider network, not from the app's own host.

export interface GuardedFetchInit {
  headers?: Record<string, string>
  signal: AbortSignal
  /** Rejects the connection when a resolved address matches. Node only. */
  isBlockedAddress?: (address: string) => boolean
}

export function guardedFetch(url: string, { headers, signal }: GuardedFetchInit): Promise<Response> {
  return fetch(url, { redirect: 'manual', headers, signal })
}
