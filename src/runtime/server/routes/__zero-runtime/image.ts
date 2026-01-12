import { defineEventHandler } from 'h3'
import { imageEventHandler } from '../../util/eventHandlers'

// /_og/d/<path>/<key>.<extension>
export default defineEventHandler(async (e): Promise<any> => {
  if (import.meta.dev || import.meta.prerender) {
    return await imageEventHandler(e)
  }
  throw new Error('Not supported in zeroRuntime mode.')
})
