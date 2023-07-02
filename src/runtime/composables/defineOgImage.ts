import { withBase } from 'ufo'
import type { OgImageOptions, OgImageScreenshotOptions } from '../../types'
import { useRequestEvent } from '#app'
import { useNitroOrigin, useRouter, useRuntimeConfig, useServerHead, useSiteConfig } from '#imports'
import { componentNames } from '#build/og-image-component-names.mjs'

export function defineOgImageScreenshot(options: OgImageScreenshotOptions = {}) {
  const router = useRouter()
  const route = router?.currentRoute?.value?.path || ''
  return defineOgImage({
    alt: `Web page screenshot${route ? ` of ${route}` : ''}.`,
    provider: 'browser',
    component: null,
    cache: true,
    ...options,
  })
}

/**
 * @deprecated Use `defineOgImageCached` instead
 */
export function defineOgImageStatic(options: OgImageOptions = {}) {
  return defineOgImageCached(options)
}

export function defineOgImageCached(options: OgImageOptions = {}) {
  const { defaults } = useRuntimeConfig()['nuxt-og-image']
  // if we're not caching by default and are missing cache config, add it
  if (!defaults.cacheTtl && !options.cacheTtl)
    options.cacheTtl = 60 * 60 * 24 * 7 // 1 week
  return defineOgImage({
    cache: true,
    ...options,
  })
}

export function defineOgImageWithoutCache(options: OgImageOptions = {}) {
  return defineOgImage({
    cache: false,
    cacheTtl: 0,
    ...options,
  })
}

/**
 * @deprecated Use `defineOgImageWithoutCache` instead
 */
export function defineOgImageDynamic(options: OgImageOptions = {}) {
  return defineOgImageWithoutCache(options)
}

export async function defineOgImage(_options: OgImageOptions = {}) {
  // clone to avoid any issues
  const options = { ...unref(_options) }
  if (process.server) {
    // support deprecations
    if (options.static)
      options.cache = options.cache || options.static
    if (!options.provider)
      options.provider = 'satori'
    const { defaults, runtimeSatori } = useRuntimeConfig()['nuxt-og-image']
    if (options.provider === 'satori' && !runtimeSatori)
      options.provider = 'browser'
    // try and fix component name if we're using a shorthand (i.e Banner instead of OgImageBanner)
    if (options.component && componentNames) {
      const originalName = options.component
      let isValid = componentNames.some(component => component.pascalName === originalName || component.kebabName === originalName)
      if (!isValid) {
        for (const component of componentNames) {
          if (component.pascalName.endsWith(originalName) || component.kebabName.endsWith(originalName)) {
            options.component = component.pascalName
            isValid = true
            break
          }
        }
      }
    }

    const router = useRouter()
    const route = router?.currentRoute?.value?.path || ''

    const e = useRequestEvent()
    const baseUrl = process.env.prerender ? (await useSiteConfig(e)).url : useNitroOrigin(e)

    const src = withBase(`${route === '/' ? '' : route}/__og_image__/og.png`, baseUrl || '')

    const meta = [
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'twitter:image:src',
        content: src,
      },
      {
        property: 'og:image',
        content: src,
      },
      {
        property: 'og:image:width',
        content: options.width || defaults.width,
      },
      {
        property: 'og:image:height',
        content: options.height || defaults.height,
      },
    ]
    if (options.alt) {
      meta.push({
        property: 'og:image:alt',
        content: options.alt,
      })
    }

    useServerHead({
      meta,
      script: [
        {
          id: 'nuxt-og-image-options',
          type: 'application/json',
          innerHTML: () => {
            const payload = {
              title: '%s',
            }
            // options is an object which has keys that may be kebab case, we need to convert the keys to camel case
            Object.entries(options).forEach(([key, val]) => {
              // with a simple kebab case conversion
              // @ts-expect-error untyped
              payload[key.replace(/-([a-z])/g, g => g[1].toUpperCase())] = val
            })
            return payload
          },
        },
      ],
    })
  }
}
