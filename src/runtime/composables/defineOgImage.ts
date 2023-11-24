import type { Head } from '@unhead/schema'
import { defu } from 'defu'
import type { OgImageOptions, OgImageScreenshotOptions } from '../types'
import { getOgImagePath } from '../utilts'
import { normaliseOgImageOptions } from './util'
import { useRouter, useRuntimeConfig, useServerHead, withSiteUrl } from '#imports'

export function defineOgImageScreenshot(options: OgImageScreenshotOptions = {}) {
  const router = useRouter()
  const route = router.currentRoute.value?.path || ''
  return defineOgImage({
    alt: `Web page screenshot${route ? ` of ${route}` : ''}.`,
    provider: 'browser',
    component: 'PageScreenshot', // this is an alias
    cache: true,
    ...options,
  })
}

/**
 * @param options
 * @deprecated Use `defineOgImage` or `defineOgImageCached` instead
 */
export function defineOgImageStatic(options: OgImageOptions = {}) {
  return defineOgImageCached(options)
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

/**
 * @param options
 * @deprecated Use `defineOgImageWithoutCache` instead
 */
export function defineOgImageDynamic(options: OgImageOptions = {}) {
  return defineOgImageWithoutCache(options)
}

type OgImagePrebuilt = { url: string } & Pick<OgImageOptions, 'width' | 'height' | 'alt'>

export async function defineOgImage(_options: OgImagePrebuilt | OgImageOptions = {}) {
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
    const options = normaliseOgImageOptions(_options)
    const optionsWithDefault = defu(options, defaults)

    const src = withSiteUrl(getOgImagePath(useRouter().currentRoute.value?.path))

    const meta: Head['meta'] = [
      { property: 'og:image', content: src },
      { property: 'og:image:width', content: optionsWithDefault.width },
      { property: 'og:image:height', content: optionsWithDefault.height },
      { property: 'og:image:type', content: 'image/png' },
    ]
    if (options.alt)
      meta.push({ property: 'og:image:alt', content: optionsWithDefault.alt })

    meta.push(...[
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:image:src', content: src },
      { name: 'twitter:image:width', content: optionsWithDefault.width },
      { name: 'twitter:image:height', content: optionsWithDefault.height },
    ])
    if (options.alt)
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
