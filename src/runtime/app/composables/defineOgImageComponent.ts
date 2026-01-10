import type { OgImageComponents } from '#og-image/components'
import type { ExtractComponentProps, OgImageOptions } from '../../types'
import { defineOgImage } from './defineOgImage'

type OgImageComponentOptions<T extends keyof OgImageComponents> = OgImageOptions & {
  props?: Partial<ExtractComponentProps<OgImageComponents[T]>>
}

export function defineOgImageComponent<T extends keyof OgImageComponents>(
  component: T,
  propsOrOptions: Partial<ExtractComponentProps<OgImageComponents[T]>> | OgImageComponentOptions<T>[] = {},
  options: OgImageOptions = {},
): string[] {
  // Handle array of options
  if (Array.isArray(propsOrOptions)) {
    return defineOgImage(propsOrOptions.map(opt => ({
      ...opt,
      component,
    })))
  }

  // Single image (existing behavior)
  return defineOgImage({
    ...options,
    component,
    props: propsOrOptions,
  })
}
