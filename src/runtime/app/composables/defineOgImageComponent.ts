import type { OgImageComponents } from '#og-image/components'
import type { ExtractComponentProps, OgImageOptions } from '../../types'
import { defineOgImage } from './defineOgImage'

/**
 * @deprecated Use `defineOgImage()` instead. This function will be removed in a future version.
 * Migration: `defineOgImageComponent('X', props, options)` → `defineOgImage('X', props, options)`
 */
export function defineOgImageComponent<T extends keyof OgImageComponents>(
  component: T,
  props: Partial<ExtractComponentProps<OgImageComponents[T]>> = {} as Partial<ExtractComponentProps<OgImageComponents[T]>>,
  options: OgImageOptions = {},
): string[] {
  if (import.meta.dev) {
    console.warn('[nuxt-og-image] `defineOgImageComponent()` is deprecated. Use `defineOgImage()` instead. Run `npx nuxt-og-image migrate v6 --api` to auto-migrate.')
  }
  return defineOgImage(component, props, options)
}
