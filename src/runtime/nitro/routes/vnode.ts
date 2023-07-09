import { createError, defineEventHandler, getQuery, setHeader } from 'h3'
import { withBase } from 'ufo'
import { fetchOptionsCached } from '../utils'
import { useProvider } from '#nuxt-og-image/provider'
import { useRuntimeConfig } from '#imports'

export default defineEventHandler(async (e) => {
  const query = getQuery(e)
  const path = withBase(query.path as string || '/', useRuntimeConfig().app.baseURL)

  const options = await fetchOptionsCached(e, path)
  // set json header
  setHeader(e, 'Content-Type', 'application/json')
  const provider = await useProvider(options.provider!)
  if (!provider) {
    throw createError({
      statusCode: 500,
      statusMessage: `Provider ${options.provider} is missing.`,
    })
  }
  return provider.createVNode(options)
})
