import type { ExtractComponentProps, OgImageOptions } from '../types'
import { defineOgImage } from './defineOgImage'
import type { OgImageComponents } from '#nuxt-og-image/components'

export function defineOgImageComponent<T extends keyof OgImageComponents>(component: T, props: ExtractComponentProps<OgImageComponents[T]>, options: OgImageOptions = {}) {
  return defineOgImage({
    ...options,
    component,
    props,
  })
}
