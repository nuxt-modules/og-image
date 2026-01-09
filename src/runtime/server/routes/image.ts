import { defineEventHandler } from 'h3'
import { imageEventHandler } from '../util/eventHandlers'

// /_og/d/<path>/<key>.<extension>
export default defineEventHandler(imageEventHandler)
