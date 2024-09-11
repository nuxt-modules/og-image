import { defineEventHandler } from 'h3'
import { fontEventHandler } from '../../util/eventHandlers'

// /__og-image__/font/<name>/<weight>.ttf
export default defineEventHandler(async (e) => {
  if (import.meta.dev || import.meta.prerender) {
    return await fontEventHandler(e)
  }
  throw new Error('Not supported in zeroRuntime mode.')
})
