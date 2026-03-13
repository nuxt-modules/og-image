import type { OgImageComponents } from '#og-image/components'
import type { OgImageOptions, OgImagePageScreenshotOptions, ReactiveComponentProps } from '../../types'
import { useRuntimeConfig } from 'nuxt/app'
import { logger } from '../../logger'

export function defineOgImage<T extends keyof OgImageComponents>(_component: T, _props: ReactiveComponentProps<OgImageComponents[T]> = {}, _options: OgImageOptions = {}) {
  if (import.meta.dev) {
    logger.warn('`defineOgImage()` is skipped as the OG Image module is not enabled.')
  }
}

/**
 * @deprecated Use `defineOgImage()` instead.
 */
export function defineOgImageComponent<T extends keyof OgImageComponents>(_component: T, _props: ReactiveComponentProps<OgImageComponents[T]> = {}, _options: OgImageOptions = {}) {
  if (import.meta.dev) {
    logger.warn('`defineOgImageComponent()` is deprecated. Use `defineOgImage()` instead. Run `npx nuxt-og-image migrate v6` to auto-migrate.')
  }
}

export function defineOgImageScreenshot(_options: OgImagePageScreenshotOptions = {}) {
  if (import.meta.dev) {
    if (useRuntimeConfig()['nuxt-og-image']) {
      console.warn('`defineOgImageScreenshot()` is skipped as the `browser` compatibility is disabled.')
    }
    else {
      console.warn('`defineOgImageScreenshot()` is skipped as the OG Image module is not enabled.')
    }
  }
}
