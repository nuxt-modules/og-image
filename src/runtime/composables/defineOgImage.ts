import { useServerHead } from '@vueuse/head'
import { useRouter } from '#imports'
import { DefaultRuntimeImageSuffix, HtmlRendererRoute, LinkPrerenderId, MetaOgImageContentPlaceholder, PayloadScriptId } from '#nuxt-og-image/constants'

export interface OgImagePayload {
  runtime?: boolean
  title?: string
  description?: string
  component?: string
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
          property: 'og:image',
          content: () => options.runtime ? `${route}/${DefaultRuntimeImageSuffix}` : MetaOgImageContentPlaceholder,
        },
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
