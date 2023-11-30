import type { Head } from '@unhead/schema'
import { defu } from 'defu'
import { appendHeader } from 'h3'
import type { AllowedComponentProps, Component, ComponentCustomProps, VNodeProps } from '@vue/runtime-core'
import type { OgImageOptions, OgImageScreenshotOptions } from '../types'
import { getOgImagePath } from '../utilts'
import { normaliseOptions } from '../core/options/normalise'
import type { OgImageComponents } from '#nuxt-og-image/components'
import { useRouter, useRuntimeConfig, useServerHead, withSiteUrl } from '#imports'

export function defineOgImageScreenshot(options: OgImageScreenshotOptions = {}) {
  const router = useRouter()
  const route = router.currentRoute.value?.path || ''
  return defineOgImage({
    alt: `Web page screenshot${route ? ` of ${route}` : ''}.`,
    renderer: 'chromium',
    extension: 'jpeg',
    component: 'PageScreenshot', // this is an alias
    cache: true,
    ...options,
  })
}

export function defineOgImageCached(options: OgImageOptions = {}) {
  const { defaults } = useRuntimeConfig()['nuxt-og-image']
  // if we're not caching by default and are missing cache config, add it
  if (!defaults.cacheTtl && !options.cacheTtl)
    options.cacheTtl = 60 * 60 * 24 * 1000 * 7 // 7 days - 1 week
  return defineOgImage({
    cache: true,
    ...options,
  })
}

export function defineOgImageWithoutCache(options: OgImageOptions = {}) {
  return defineOgImage({
    ...options,
    cache: false,
    cacheTtl: 0,
  })
}

type ExtractComponentProps<T extends Component> = T extends new (...args: any) => any
  ? Omit<InstanceType<T>['$props'], keyof ComponentCustomProps | keyof VNodeProps | keyof AllowedComponentProps>
  : never

export function defineOgImageComponent<T extends keyof OgImageComponents>(component: T, props: ExtractComponentProps<OgImageComponents[T]>, options: OgImageOptions = {}) {
  defineOgImage({
    component,
    ...props,
    ...options,
  })
}

export function defineOgImage(_options: OgImagePrebuilt | OgImageOptions = {}) {
  // string is supported as an easy way to override the generated og image data
  // clone to avoid any issues
  if (import.meta.server) {
    // allow overriding using a prebuild config
    if (_options.url) {
      // can be a jpeg or png
      const type = _options.url.endsWith('.png') ? 'image/png' : 'image/jpeg'
      const meta: Head['meta'] = [
        { property: 'og:image', content: _options.url },
        { property: 'og:image:type', content: type },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:image:src', content: _options.url },
      ]
      if (_options.width) {
        meta.push({ property: 'og:image:width', content: _options.width })
        meta.push({ name: 'twitter:image:width', content: _options.width })
      }
      if (_options.height) {
        meta.push({ property: 'og:image:height', content: _options.height })
        meta.push({ name: 'twitter:image:height', content: _options.height })
      }
      if (_options.alt) {
        meta.push({ property: 'og:image:alt', content: _options.alt })
        meta.push({ name: 'twitter:image:alt', content: _options.alt })
      }
      useServerHead({ meta }, {
        // after async scripts when capo.js is enabled
        tagPriority: 35,
      })
      return
    }

    const { defaults } = useRuntimeConfig()['nuxt-og-image']
    // TODO make sure this is working with route rules
    const options = normaliseOptions(_options)
    const optionsWithDefault = defu(options, defaults)

    const path = getOgImagePath(useRouter().currentRoute.value?.path, optionsWithDefault.extension)
    const src = withSiteUrl(path)

    // prerender the og:image as well
    if (import.meta.prerender)
      appendHeader(useRequestEvent(), 'x-nitro-prerender', path)

    const meta: Head['meta'] = [
      { property: 'og:image', content: src },
      { property: 'og:image:width', content: optionsWithDefault.width },
      { property: 'og:image:height', content: optionsWithDefault.height },
      { property: 'og:image:type', content: `image/${optionsWithDefault.extension}` },
    ]
    if (optionsWithDefault.alt)
      meta.push({ property: 'og:image:alt', content: optionsWithDefault.alt })

    meta.push(...[
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:image:src', content: src },
      { name: 'twitter:image:width', content: optionsWithDefault.width },
      { name: 'twitter:image:height', content: optionsWithDefault.height },
    ])
    if (optionsWithDefault.alt)
      meta.push({ name: 'twitter:image:alt', content: optionsWithDefault.alt })

    useServerHead({
      meta,
      script: [
        {
          id: 'nuxt-og-image-options',
          type: 'application/json',
          processTemplateParams: true,
          innerHTML: () => {
            const payload = {
              title: '%s',
            }
            // don't apply defaults
            // options is an object which has keys that may be kebab case, we need to convert the keys to camel case
            Object.entries(options).forEach(([key, val]) => {
              // with a simple kebab case conversion
              // @ts-expect-error untyped
              payload[key.replace(/-([a-z])/g, g => g[1].toUpperCase())] = val
            })
            return payload
          },
          // we want this to be last in our head
          tagPosition: 'bodyClose',
        },
      ],
    }, {
      // after async scripts when capo.js is enabled
      tagPriority: 35,
    })
  }
}
