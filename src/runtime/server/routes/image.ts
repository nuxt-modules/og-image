import { defineEventHandler } from 'h3'
import { imageEventHandler } from '../util/eventHandlers'

// /__og-image__/image/<path>/og.<extension
export default defineEventHandler(imageEventHandler)
