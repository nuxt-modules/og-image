import { type H3Event, createError } from 'h3'
import { hash } from 'ohash'
import type { NuxtIslandResponse } from 'nuxt/dist/core/runtime/nitro/renderer'
import type { RendererOptions, RuntimeOgImageOptions } from '../../types'

export function fetchIsland(e: H3Event, options: RuntimeOgImageOptions | RendererOptions): Promise<NuxtIslandResponse> {
  if (!options.component) {
    throw createError({
      statusCode: 500,
      statusMessage: `Nuxt OG Image trying to render an invalid component. Received options ${JSON.stringify(options)}`,
    })
  }

  // using Nuxt Island, generate the og:image HTML
  const hashId = hash([options.component, options, Math.random() * 100])
  return e.$fetch<NuxtIslandResponse>(`/__nuxt_island/${options.component}_${hashId}.json`, {
    params: {
      props: JSON.stringify(options),
    },
  })
}
