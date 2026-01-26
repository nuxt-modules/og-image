import type { OgImageComponents } from '#og-image/components'
import type { ExtractComponentProps, OgImageOptions, OgImagePageScreenshotOptions } from '../../types'
import { useRuntimeConfig } from 'nuxt/app'

export function defineOgImage<T extends keyof OgImageComponents>(_component: T, _props: Partial<ExtractComponentProps<OgImageComponents[T]>> = {}, _options: OgImageOptions = {}) {
  if (import.meta.dev) {
    console.warn('`defineOgImage()` is skipped as the OG Image module is not enabled.')
  }
}

/**
 * @deprecated Use `defineOgImage()` instead.
 */
export function defineOgImageComponent<T extends keyof OgImageComponents>(_component: T, _props: Partial<ExtractComponentProps<OgImageComponents[T]>> = {}, _options: OgImageOptions = {}) {
  if (import.meta.dev) {
    console.warn('[nuxt-og-image] `defineOgImageComponent()` is deprecated. Use `defineOgImage()` instead. Run `npx nuxt-og-image migrate v6` to auto-migrate.')
  }
}

export function defineOgImageScreenshot(_options: OgImagePageScreenshotOptions = {}) {
  if (import.meta.dev) {
    if (useRuntimeConfig()['nuxt-og-image']) {
      console.warn('`defineOgImageScreenshot()` is skipped as the `chromium` compatibility is disabled.')
    }
    else {
      console.warn('`defineOgImageScreenshot()` is skipped as the OG Image module is not enabled.')
    }
  }
}
