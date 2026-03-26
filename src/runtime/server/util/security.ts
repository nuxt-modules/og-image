/**
 * Security utilities for OG image generation.
 *
 * Request coalescing (single-flight) and concurrency semaphore.
 * All utilities are edge-runtime compatible (no shared state across isolates).
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
