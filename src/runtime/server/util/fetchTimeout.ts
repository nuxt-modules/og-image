import type { OgImageRuntimeConfig } from '../../types'

export function getFetchTimeout(runtimeConfig: OgImageRuntimeConfig): number {
  return runtimeConfig.security?.imageFetchTimeout ?? 3000
}
