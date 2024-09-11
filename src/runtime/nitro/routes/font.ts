import { defineEventHandler } from 'h3'
import { fontEventHandler } from '../util/eventHandlers'

// /__og-image__/font/<name>/<weight>.ttf
export default defineEventHandler(fontEventHandler)
