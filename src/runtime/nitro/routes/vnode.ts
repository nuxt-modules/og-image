import { createError, defineEventHandler, getQuery, setHeader } from 'h3'
import { withBase } from 'ufo'
import { fetchOptions, useHostname } from '../utils'
import { useProvider } from '#nuxt-og-image/provider'
import { useRuntimeConfig } from '#imports'

export default defineEventHandler(async (e) => {
  const query = getQuery(e)
  const path = withBase(query.path as string || '/', useRuntimeConfig().app.baseURL)

  const options = await fetchOptions(e, path)
  // set json header
  setHeader(e, 'Content-Type', 'application/json')
  const provider = await useProvider(options.provider!)
  if (!provider) {
    throw createError({
      statusCode: 500,
      statusMessage: `Provider ${options.provider} is missing.`,
    })
  }
  return provider.createVNode(withBase(path, useHostname(e)), options)
})
