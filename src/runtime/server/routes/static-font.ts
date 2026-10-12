import type { FontConfig } from '../../types'
import { readFile } from 'node:fs/promises'
import { createError, defineEventHandler, getRequestURL, useRuntimeConfig } from 'nuxt/server'
import { join } from 'pathe'
import { withoutBase } from 'ufo'
import { staticFontCacheDir } from '#og-image-virtual/build-dir.mjs'
import resolvedFonts from '#og-image/fonts'
import availableFonts from '#og-image/fonts-available'

export default defineEventHandler(async (event) => {
  const path = withoutBase(getRequestURL(event).pathname, useRuntimeConfig().app.baseURL)
  const font = ([...resolvedFonts, ...availableFonts] as FontConfig[]).find(face => face.src === path || face.satoriSrc === path)
  if (!font)
    throw createError({ status: 404, statusText: 'Not Found' })
  const file = path === font.src && font.absolutePath
    ? font.absolutePath
    : join(staticFontCacheDir, path.slice('/_og-static-fonts/'.length))
  const data = await readFile(file)
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  })
})
