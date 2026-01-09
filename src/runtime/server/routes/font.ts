import { defineEventHandler } from 'h3'
import { fontEventHandler } from '../util/eventHandlers'

// /_og/f/<name>/<weight>.ttf
export default defineEventHandler(fontEventHandler)
