import { useServerHead } from '@vueuse/head'
import { useRouter } from '#imports'
import { DefaultRuntimeImageSuffix, HtmlRendererRoute, LinkPrerenderId, MetaOgImageContentPlaceholder, PayloadScriptId } from '#nuxt-og-image/constants'

export interface OgImagePayload {
  runtime?: boolean
  title?: string
  description?: string
  component?: string
  alt?: string
  [key: string]: any
}

export function defineOgImageScreenshot() {
  defineOgImage()
}

export function defineOgImage(options: OgImagePayload = {}) {
  if (process.server) {
    const router = useRouter()
    const route = router?.currentRoute?.value?.path || ''
    useServerHead({
      meta: [
        {
          property: 'twitter:card',
          content: 'summary_large_image',
        },
        {
          property: 'og:image',
          content: () => options.runtime ? `${route}/${DefaultRuntimeImageSuffix}` : MetaOgImageContentPlaceholder,
        },
        options.alt
          ? {
              property: 'og:image:alt',
              content: options.alt,
            }
          : {},
      ],
      link: options.component
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
