import type { OgImageRenderEventContext } from '../../types'

export function warnPublishUnavailable(
  app: OgImageRenderEventContext['_nitro'] & { _ogImagePublishWarned?: boolean },
  reason: unknown,
  logger: { warn: (message: string, reason: unknown) => void },
): void {
  if (app._ogImagePublishWarned)
    return
  app._ogImagePublishWarned = true
  logger.warn('[Nuxt OG Image] Publish storage is unavailable. Keeping app image URLs. Check the storage driver and credentials.', reason)
}
