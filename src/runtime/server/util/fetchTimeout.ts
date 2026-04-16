import type { OgImageRuntimeConfig } from '../../types'

// Minimum floor: AbortSignal.timeout(0) aborts synchronously and negative
// values throw RangeError on Node. Clamp so misconfigured values fail soft.
const MIN_TIMEOUT_MS = 100

export function getFetchTimeout(runtimeConfig: OgImageRuntimeConfig): number {
  const value = runtimeConfig.security?.imageFetchTimeout ?? 3000
  if (!Number.isFinite(value) || value < MIN_TIMEOUT_MS)
    return MIN_TIMEOUT_MS
  return value
}
