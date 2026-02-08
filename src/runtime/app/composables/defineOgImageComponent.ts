import type { OgImageComponents } from '#og-image/components'
import type { OgImageOptions, ReactiveComponentProps } from '../../types'
import { logger } from '../../logger'
import { defineOgImage } from './defineOgImage'

/**
 * @deprecated Use `defineOgImage()` instead. This function will be removed in a future version.
 * Migration: `defineOgImageComponent('X', props, options)` → `defineOgImage('X', props, options)`
 */
export function defineOgImageComponent<T extends keyof OgImageComponents>(
  component: T,
  props: ReactiveComponentProps<OgImageComponents[T]> = {},
  options: OgImageOptions = {},
): string[] {
  if (import.meta.dev) {
    logger.warn('`defineOgImageComponent()` is deprecated. Use `defineOgImage()` instead. Run `npx nuxt-og-image migrate v6` to auto-migrate.')
  }
  return defineOgImage(component, props, options)
}
