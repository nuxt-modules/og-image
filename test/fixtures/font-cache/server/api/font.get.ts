import { defineEventHandler } from 'h3'
import { resolve } from '#og-image-virtual/public-assets.mjs'

export default defineEventHandler(event => resolve(event, {
  family: 'Inter',
  weight: 400,
  style: 'normal',
  src: '/_fonts/cached.ttf',
  localPath: '/_fonts/cached.ttf',
}))
