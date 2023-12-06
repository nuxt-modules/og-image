import { createError } from 'h3'
import { hash } from 'ohash'
import type { NuxtIslandResponse } from 'nuxt/dist/core/runtime/nitro/renderer'
import type { OgImageRenderEventContext } from '../../types'

export function fetchIsland({ options, e }: OgImageRenderEventContext): Promise<NuxtIslandResponse> {
  if (!options.component) {
    throw createError({
      statusCode: 500,
      statusMessage: `Nuxt OG Image trying to render an invalid component. Received options ${JSON.stringify(options)}`,
    })
  }

  // using Nuxt Island, generate the og:image HTML
  const hashId = hash([options.component, options])
  const props = typeof options.props !== 'undefined' ? options.props : options
  return e.$fetch<NuxtIslandResponse>(`/__nuxt_island/${options.component}_${hashId}.json`, {
    params: {
      props: JSON.stringify(props),
    },
  })
}
