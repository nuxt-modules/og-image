import { useServerHead } from '@vueuse/head'
import {
  HtmlRendererRoute,
  LinkPrerenderId,
  MetaOgImageContentPlaceholder, PayloadScriptId, RuntimeImageSuffix,
} from '../const'

export interface OgImagePayload {
  runtime: boolean
  title: string
  description: string
  component: string
  [key: string]: any
}

export function defineOgImage(options: OgImagePayload) {
  if (process.server) {
    const router = useRouter()
    useServerHead({
      meta: [
        {
          property: 'og:image',
          content: () => options.runtime ? `${router.currentRoute.value.path}/${RuntimeImageSuffix}` : MetaOgImageContentPlaceholder,
        },
      ],
      link: [
        {
          id: LinkPrerenderId,
          rel: 'prerender',
          href: `${router.currentRoute.value.path}/${HtmlRendererRoute}`,
        },
      ],
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
