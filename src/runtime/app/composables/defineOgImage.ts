import type { OgImageComponents } from '#og-image/components'
import type { OgImageOptions, ReactiveComponentProps } from '../../types'
import { _defineOgImageRaw } from './_defineOgImageRaw'

type OgImageComponentOptions<T extends keyof OgImageComponents> = OgImageOptions & {
  props?: ReactiveComponentProps<OgImageComponents[T]>
}

/**
 * Define an OG image using a component.
 *
 * @param component - The component name (must match an OgImage component)
 * @param propsOrOptions - Either component props, or an array of options for multiple images
 * @param options - Additional OG image options (width, height, etc.), or an array of options for multiple images sharing the same props
 */
export function defineOgImage<T extends keyof OgImageComponents>(
  component: T,
  propsOrOptions: ReactiveComponentProps<OgImageComponents[T]> | OgImageComponentOptions<T>[] = {},
  options: OgImageOptions | OgImageComponentOptions<T>[] = {},
): string[] {
  // Handle array of options (no shared props)
  if (Array.isArray(propsOrOptions)) {
    return _defineOgImageRaw(propsOrOptions.map(opt => ({
      ...opt,
      component: component as string,
    })))
  }

  const sharedProps = propsOrOptions && Object.keys(propsOrOptions).length > 0
    ? propsOrOptions
    : undefined

  // Handle shared props + array of variants
  if (Array.isArray(options)) {
    return _defineOgImageRaw(options.map((opt) => {
      const input: OgImageOptions = {
        ...opt,
        component: component as string,
      }
      if (sharedProps) {
        // Per-variant props override shared props
        input.props = opt.props ? { ...sharedProps, ...opt.props } : { ...sharedProps }
      }
      return input
    }))
  }

  // Single image
  const input: OgImageOptions = {
    ...options,
    component: component as string,
  }
  if (sharedProps)
    input.props = sharedProps
  return _defineOgImageRaw(input)
}
