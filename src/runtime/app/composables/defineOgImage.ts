import type { OgImageComponents } from '#og-image/components'
import type { ExtractComponentProps, OgImageOptions } from '../../types'
import { _defineOgImageRaw } from './_defineOgImageRaw'

type OgImageComponentOptions<T extends keyof OgImageComponents> = OgImageOptions & {
  props?: Partial<ExtractComponentProps<OgImageComponents[T]>>
}

/**
 * Define an OG image using a component.
 *
 * @param component - The component name (must match an OgImage component)
 * @param propsOrOptions - Either component props, or an array of options for multiple images
 * @param options - Additional OG image options (width, height, etc.)
 */
export function defineOgImage<T extends keyof OgImageComponents>(
  component: T,
  propsOrOptions: Partial<ExtractComponentProps<OgImageComponents[T]>> | OgImageComponentOptions<T>[] = {},
  options: OgImageOptions = {},
): string[] {
  // Handle array of options
  if (Array.isArray(propsOrOptions)) {
    return _defineOgImageRaw(propsOrOptions.map(opt => ({
      ...opt,
      component: component as string,
    })))
  }

  // Single image
  return _defineOgImageRaw({
    ...options,
    component: component as string,
    props: propsOrOptions,
  })
}
