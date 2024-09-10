import type { OgImageComponents } from '#nuxt-og-image/components'
import { defineOgImage } from './defineOgImage'
import type { ExtractComponentProps, OgImageOptions } from '../../types'

export function defineOgImageComponent<T extends keyof OgImageComponents>(component: T, props: Partial<ExtractComponentProps<OgImageComponents[T]>> = {}, options: OgImageOptions = {}) {
  return defineOgImage({
    ...options,
    component,
    props,
  })
}
