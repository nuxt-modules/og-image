import { useServerHead } from '@vueuse/head'
import { withBase } from 'ufo'
import { useRequestEvent } from '#app'
import type { OgImageOptions, OgImageScreenshotOptions } from '../../types'
import { useRouter } from '#imports'
import { defaults, forcePrerender, host, satoriProvider } from '#nuxt-og-image/config'

export function defineOgImageScreenshot(options: OgImageScreenshotOptions = {}) {
  const router = useRouter()
  const route = router?.currentRoute?.value?.path || ''
  defineOgImage({
    alt: `Web page screenshot${route ? ` of ${route}` : ''}.`,
    provider: 'browser',
    static: true,
    ...options,
  })
}

export function defineOgImageDynamic(options: OgImageOptions = {}) {
  defineOgImage({
    provider: satoriProvider ? 'satori' : 'browser',
    static: !!forcePrerender,
    ...options,
  })
}

export function defineOgImageStatic(options: OgImageOptions = {}) {
  defineOgImage({
    provider: satoriProvider ? 'satori' : 'browser',
    static: true,
    ...options,
  })
}

export function defineOgImage(options: OgImageOptions = {}) {
  if (process.server) {
    const router = useRouter()
    const route = router?.currentRoute?.value?.path || ''

    const e = useRequestEvent()

    // prerender satori images, we can't prerender browser screenshots
    if ((forcePrerender || options.static) && options.provider === 'satori')
      e.res.setHeader('x-nitro-prerender', `${route === '/' ? '' : route}/__og_image__/og.png`)

    const meta = [
      {
        property: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        property: 'og:image',
        content: () => withBase(`${route === '/' ? '' : route}/__og_image__/og.png`, host),
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
          children: () => {
            const payload = {}
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
