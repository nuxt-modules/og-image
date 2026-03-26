/**
 * Security utilities for OG image generation.
 *
 * Provides request coalescing (single-flight pattern).
 * Edge-runtime compatible (no shared state across isolates, no Node.js-only APIs).
 */

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
