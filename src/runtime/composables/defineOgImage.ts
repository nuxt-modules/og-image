import { useServerHead } from '@vueuse/head'
import type { OgImagePayload, OgImageScreenshotPayload } from '../../types'
import { useRouter } from '#imports'
import { DefaultRuntimeImageSuffix, HtmlRendererRoute, LinkPrerenderId, MetaOgImageContentPlaceholder, PayloadScriptId } from '#nuxt-og-image/constants'

export function defineOgImageScreenshot(options: OgImageScreenshotPayload = {}) {
  defineOgImage({
    alt: '__OG_IMAGE_SCREENSHOT_ALT',
    ...options,
  })
}

export function defineOgImage(options: OgImagePayload = {}) {
  if (process.server) {
    const router = useRouter()
    const route = router?.currentRoute?.value?.path || ''

    const meta = [
      {
        property: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        property: 'og:image',
        content: () => options.runtime ? `${route}/${DefaultRuntimeImageSuffix}` : MetaOgImageContentPlaceholder,
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
      link: !options.runtime && options.component
        ? [
            {
              id: LinkPrerenderId,
              rel: 'prerender',
              href: `${route}/${HtmlRendererRoute}`,
            },
          ]
        : [],
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
