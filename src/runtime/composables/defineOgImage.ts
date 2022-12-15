import { useServerHead } from '@vueuse/head'
import { useRouter } from '#imports'

export const HtmlRendererRoute = '__og_image'
export const RuntimeImageSuffix = 'og-image.png'
export const PayloadScriptId = 'nuxt-og-image-payload'
export const MetaOgImageContentPlaceholder = '__NUXT_OG_IMAGE_PLACEHOLDER__'
export const LinkPrerenderId = 'nuxt-og-image-screenshot-path'

export interface OgImagePayload {
  runtime?: boolean
  title?: string
  description?: string
  component?: string
  [key: string]: any
}

export function defineOgImage(options: OgImagePayload = {}) {
  if (process.server) {
    const router = useRouter()
    useServerHead({
      meta: [
        {
          property: 'og:image',
          content: () => options.runtime ? `${router.currentRoute.value.path}/${RuntimeImageSuffix}` : MetaOgImageContentPlaceholder,
        },
      ],
      link: options.component
        ? [
            {
              id: LinkPrerenderId,
              rel: 'prerender',
              href: `${router.currentRoute.value.path}/${HtmlRendererRoute}`,
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
