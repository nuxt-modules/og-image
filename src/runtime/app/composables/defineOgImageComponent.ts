import type { OgImageComponents } from '#og-image/components'
import type { ExtractComponentProps, OgImageOptions } from '../../types'
import { defineOgImage } from './defineOgImage'

export function defineOgImageComponent<T extends keyof OgImageComponents>(component: T, props: Partial<ExtractComponentProps<OgImageComponents[T]>> = {}, options: OgImageOptions = {}) {
  return defineOgImage({
    ...options,
    component,
    props,
  })
}
