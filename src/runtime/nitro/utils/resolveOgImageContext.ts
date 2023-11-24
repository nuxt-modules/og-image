import { parseURL, withoutTrailingSlash } from 'ufo'
import type { H3Event } from 'h3'
import { createError } from 'h3'
import { fetchOptionsCached } from '../utils'
import type { Renderer } from '../../types'
import { useProvider } from '#nuxt-og-image/provider'

export async function resolveOgImageContext(e: H3Event) {
  const path = parseURL(e.path).pathname

  const extension = path.split('.').pop()
  const basePath = withoutTrailingSlash(path
    .replace('/__og-image__/image', '')
    .replace(`/og.${extension}`, ''),
  )

  const options = await fetchOptionsCached(e, basePath)
  if (!options) {
    return createError({
      statusCode: 404,
      statusMessage: 'OG Image not found.',
    })
  }
  const provider = await useProvider(options.provider!) as Renderer
  if (!provider) {
    throw createError({
      statusCode: 500,
      statusMessage: `Provider ${options.provider} is missing.`,
    })
  }
  return {
    extension,
    provider,
    options,
  }
}
