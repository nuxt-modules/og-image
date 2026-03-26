/**
 * Security utilities for OG image generation.
 *
 * Provides URL validation (SSRF protection), request coalescing (single-flight),
 * and a concurrency semaphore. All utilities are edge-runtime compatible (no shared
 * state across isolates, no Node.js-only APIs).
 */
import { useOgImageRuntimeConfig } from '../utils'

// ---------------------------------------------------------------------------
// SSRF protection: same-origin URL validation
// ---------------------------------------------------------------------------

// RFC 1918 / loopback / link-local patterns (covers IPv4 and common IPv6 forms)
const RE_PRIVATE_IP = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.|169\.254\.|::1|fc00:|fd00:|fe80:|0\.0\.0\.0)/i
const RE_LOCALHOST = /^localhost$/i

function extractHostname(url: string): string | null {
  try {
    return new URL(url).hostname
  }
  catch {
    return null
  }
}

/**
 * Returns true when `hostname` is the same domain as `siteHostname` or a
 * subdomain of it.  e.g. siteHostname = "example.com" matches
 * "cdn.example.com", "a.b.example.com", "example.com".
 */
function isSameOriginOrSubdomain(hostname: string, siteHostname: string): boolean {
  const h = hostname.toLowerCase()
  const s = siteHostname.toLowerCase()
  return h === s || h.endsWith(`.${s}`)
}

/**
 * Validate that a URL is safe to fetch from the server.
 * Allows: same origin + subdomains of the site URL, plus any domains in the
 * configurable `allowedDomains` list.
 * Blocks: private/loopback IPs, non-http(s) protocols, localhost.
 */
export function isAllowedUrl(url: string, siteUrl?: string, allowedDomains?: string[]): boolean {
  const hostname = extractHostname(url)
  if (!hostname)
    return false

  // Block non-http(s) protocols
  let protocol: string
  try {
    protocol = new URL(url).protocol
  }
  catch {
    return false
  }
  if (protocol !== 'http:' && protocol !== 'https:')
    return false

  // Block private IPs and localhost
  if (RE_PRIVATE_IP.test(hostname) || RE_LOCALHOST.test(hostname))
    return false

  // Allow same origin + subdomains
  if (siteUrl) {
    const siteHostname = extractHostname(siteUrl)
    if (siteHostname && isSameOriginOrSubdomain(hostname, siteHostname))
      return true
  }

  // Allow explicitly configured domains (with subdomain matching)
  if (allowedDomains) {
    for (const domain of allowedDomains) {
      if (isSameOriginOrSubdomain(hostname, domain))
        return true
    }
  }

  return false
}

/**
 * Convenience wrapper that reads site URL and allowedDomains from runtime config.
 */
export function validateExternalUrl(url: string, siteUrl: string): boolean {
  const runtimeConfig = useOgImageRuntimeConfig()
  return isAllowedUrl(url, siteUrl, runtimeConfig.allowedDomains)
}

// ---------------------------------------------------------------------------
// Request coalescing (single-flight)
// ---------------------------------------------------------------------------

const inFlight = new Map<string, Promise<any>>()

/**
 * Ensures only one render executes per cache key at a time. Concurrent requests
 * for the same key share the same Promise. Process-local, edge-compatible.
 */
export function coalesce<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key)
  if (existing)
    return existing as Promise<T>
  const promise = fn().finally(() => inFlight.delete(key))
  inFlight.set(key, promise)
  return promise
}

// ---------------------------------------------------------------------------
// Concurrency semaphore
// ---------------------------------------------------------------------------

export type Semaphore = ReturnType<typeof createSemaphore>

/**
 * Creates a simple in-process semaphore. Edge-compatible (no shared state).
 * When the limit is reached, new callers wait in a FIFO queue.
 */
export function createSemaphore(limit: number) {
  let active = 0
  const queue: Array<() => void> = []

  function release() {
    active--
    const next = queue.shift()
    if (next)
      next()
  }

  return {
    async acquire(): Promise<void> {
      if (active < limit) {
        active++
        return
      }
      return new Promise<void>((resolve) => {
        queue.push(() => {
          active++
          resolve()
        })
      })
    },
    release,
    /** Number of renders currently executing */
    get active() { return active },
    /** Number of requests waiting */
    get waiting() { return queue.length },
  }
}
