import { createError, defineEventHandler } from '#nuxtseo/h3'
import { imageEventHandler } from '../../util/eventHandlers'

// /_og/d/<path>/<key>.<extension>
export default defineEventHandler(async (e): Promise<any> => {
  if (import.meta.dev || import.meta.prerender) {
    return await imageEventHandler(e)
  }
  throw createError({ statusCode: 404, statusMessage: 'Not Found' })
})
