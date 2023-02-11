import {createError, defineEventHandler, getQuery, setHeader} from 'h3'
import { withBase } from 'ufo'
import { fetchOptions, useHostname } from '../utils'
import { useProvider } from '#nuxt-og-image/provider'

export default defineEventHandler(async (e) => {
  const path = getQuery(e).path as string || '/'
  const options = await fetchOptions(e, path)
  setHeader(e, 'Content-Type', 'image/svg+xml')
  const provider = await useProvider(options.provider!)
  if (!provider) {
    throw createError({
      statusCode: 500,
      statusMessage: `Provider ${options.provider} is missing.`,
    })
  }
  return provider.createSvg(withBase(path, useHostname(e)), options)
})
