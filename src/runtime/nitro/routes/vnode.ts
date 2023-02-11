import {createError, defineEventHandler, getQuery, setHeader} from 'h3'
import { withBase } from 'ufo'
import { fetchOptions, useHostname } from '../utils'
import { useProvider } from '#nuxt-og-image/provider'

export default defineEventHandler(async (e) => {
  const path = getQuery(e).path as string || '/'

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
