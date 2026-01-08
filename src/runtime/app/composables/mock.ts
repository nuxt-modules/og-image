import type { OgImageComponents } from '#og-image/components'
import type { DefineOgImageInput, ExtractComponentProps, OgImageOptions, OgImagePageScreenshotOptions } from '../../types'
import { useRuntimeConfig } from 'nuxt/app'

export function defineOgImage(_options: DefineOgImageInput = {}) {
  if (import.meta.dev) {
    console.warn('`defineOgImage()` is skipped as the OG Image module is not enabled.')
  }
}
// eslint-disable-next-line unused-imports/no-unused-vars
export function defineOgImageComponent<T extends keyof OgImageComponents>(component: T, props: Partial<ExtractComponentProps<OgImageComponents[T]>> = {}, options: OgImageOptions = {}) {
  if (import.meta.dev) {
    console.warn('`defineOgImageComponent()` is skipped as the OG Image module is not enabled.')
  }
}
// eslint-disable-next-line unused-imports/no-unused-vars
export function defineOgImageScreenshot(options: OgImagePageScreenshotOptions = {}) {
  if (import.meta.dev) {
    if (useRuntimeConfig()['nuxt-og-image']) {
      console.warn('`defineOgImageScreenshot()` is skipped as the `chromium` compatibility is disabled.')
    }
    else {
      console.warn('`defineOgImageScreenshot()` is skipped as the OG Image module is not enabled.')
    }
  }
}
