import { withBase } from 'ufo'
import { useRequestEvent } from '#app'
import { useNitroOrigin, useRouter, useRuntimeConfig, useServerHead, useSiteConfig } from '#imports'
import { componentNames } from '#build/og-image-component-names.mjs'

export function defineOgImageScreenshot(options: OgImageScreenshotOptions = {}) {
  const router = useRouter()
  const route = router?.currentRoute?.value?.path || ''
  defineOgImage({
    alt: `Web page screenshot${route ? ` of ${route}` : ''}.`,
    provider: 'browser',
    component: null,
    static: true,
    ...options,
  })
}

export function defineOgImageDynamic(options: OgImageOptions = {}) {
  const { runtimeSatori } = useRuntimeConfig()['nuxt-og-image']
  defineOgImage({
    provider: runtimeSatori ? 'satori' : 'browser',
    static: false,
    cacheTtl: 0,
    ...options,
  })
}

export function defineOgImageStatic(options: OgImageOptions = {}) {
  const { runtimeSatori } = useRuntimeConfig()['nuxt-og-image']
  defineOgImage({
    provider: runtimeSatori ? 'satori' : 'browser',
    static: true,
    ...options,
  })
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
