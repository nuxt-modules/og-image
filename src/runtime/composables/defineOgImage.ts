import { useServerHead } from '@vueuse/head'
import { withBase } from 'ufo'
import type { OgImagePayload, OgImageScreenshotPayload } from '../../types'
import { useRouter } from '#imports'
import { PayloadScriptId } from '#nuxt-og-image/constants'
import { forcePrerender, height, host, width } from '#nuxt-og-image/config'

export function defineOgImageScreenshot(options: OgImageScreenshotPayload = {}) {
  const router = useRouter()
  const route = router?.currentRoute?.value?.path || ''
  defineOgImage({
    alt: `Web page screenshot${route ? ` of ${route}` : ''}.`,
    provider: 'browser',
    prerender: true,
    ...options,
  })
}

export function defineOgImageDynamic(options: OgImageScreenshotPayload = {}) {
  defineOgImage({
    provider: 'satori',
    ...options,
  })
}

export function defineOgImageStatic(options: OgImageScreenshotPayload = {}) {
  defineOgImage({
    provider: 'satori',
    prerender: true,
    ...options,
  })
}

export function defineOgImage(options: OgImagePayload = {}) {
  if (process.server) {
    const router = useRouter()
    const route = router?.currentRoute?.value?.path || ''

    const e = useRequestEvent()

    // pre-render satori images
    if ((forcePrerender || options.prerender) && options.provider === 'satori')
      e.res.setHeader('x-nitro-prerender', `${route === '/' ? '' : route}/__og_image__/og.png`)

    const meta = [
      {
        property: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        property: 'og:image',
        content: () => withBase(`${route}/__og_image__/og.png`, host),
      },
      {
        property: 'og:image:width',
        content: width,
      },
      {
        property: 'og:image:height',
        content: height,
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
          id: PayloadScriptId,
          type: 'application/json',
          children: () => JSON.stringify(options),
        },
      ],
    })
  }
}
