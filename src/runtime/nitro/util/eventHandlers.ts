import type { H3Event } from 'h3'
import type { ResolvedFontConfig } from '../../types'
import { createError, getQuery, H3Error, proxyRequest, sendRedirect, setHeader, setResponseHeader } from 'h3'
import { parseURL } from 'ufo'
import { normaliseFontInput, useOgImageRuntimeConfig } from '../../shared'
import { resolveContext } from '../og-image/context'
import { assets } from '../og-image/satori/font'
import { html } from '../og-image/templates/html'
import { useOgImageBufferCache } from './cache'

export async function fontEventHandler(e: H3Event) {
  const path = parseURL(e.path).pathname
  const { fonts } = useOgImageRuntimeConfig()

  // used internally for html previews
  const key = path.split('/font/')[1]
  if (key.includes(':')) {
    const font = fonts.find(f => f.key === key)
    // use as storage key
    if (font?.key && await assets.hasItem(font.key)) {
      let fontData = await assets.getItem(font.key)
      // if buffer
      if (fontData instanceof Uint8Array) {
        const decoder = new TextDecoder()
        fontData = decoder.decode(fontData)
      }
      // set header either as ttf, otf or woff2
      if (key.includes('.oft')) {
        setResponseHeader(e, 'Content-Type', 'font/otf')
      }
      else if (key.includes('.woff2')) {
        setResponseHeader(e, 'Content-Type', 'font/woff2')
      }
      else if (key.includes('.ttf')) {
        setResponseHeader(e, 'Content-Type', 'font/ttf')
      }
      // fontData is a base64 string, need to turn it into a buffer
      // buf is a string need to convert it to a buffer
      return Buffer.from(fontData!, 'base64')
    }
  }

  const [_name, _weight] = key.split('.')[0].split('/')

  if (!_name || !_weight)
    return 'Provide a font name and weight'

  // make sure name starts with a capital letter
  const name = _name[0].toUpperCase() + _name.slice(1)
  // make sure weight is a valid number between 100 to 900 in 100 increments
  const weight = Math.round(Number.parseInt(_weight) / 100) * 100

  const config = useOgImageRuntimeConfig()
  const normalisedFonts = normaliseFontInput(config.fonts)
  let font: ResolvedFontConfig | undefined
  if (typeof getQuery(e).font === 'string')
    font = JSON.parse(getQuery(e).font as string)
  if (!font) {
    font = normalisedFonts.find((font) => {
      return font.name.toLowerCase() === name.toLowerCase() && weight === Number(font.weight)
    })
  }
  if (!font) {
    return createError({
      statusCode: 404,
      statusMessage: `[Nuxt OG Image] Font ${name}:${weight} not found`,
    })
  }

  // using H3Event $fetch will cause the request headers not to be sent
  const css = await globalThis.$fetch(`https://fonts.googleapis.com/css2?family=${name}:wght@${weight}`, {
    headers: {
      // Make sure it returns TTF.
      'User-Agent':
        'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1',
    },
  })
  if (!css) {
    return createError({
      statusCode: 500,
      statusMessage: `[Nuxt OG Image] Invalid Google Font ${name}:${weight}`,
    })
  }

  const ttfResource = css.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/)
  if (ttfResource?.[1])
    return proxyRequest(e, ttfResource[1], {})

  // try woff2
  const woff2Resource = css.match(/src: url\((.+)\) format\('woff2'\)/)
  if (woff2Resource?.[1])
    return sendRedirect(e, woff2Resource[1])

  return createError({
    statusCode: 500,
    statusMessage: `[Nuxt OG Image] Malformed Google Font CSS ${css}`,
  })
}

export async function imageEventHandler(e: H3Event) {
  const ctx = await resolveContext(e)
  if (ctx instanceof H3Error)
    return ctx

  const { isDebugJsonPayload, extension, options, renderer } = ctx
  const { debug, baseCacheKey } = useOgImageRuntimeConfig()
  const compatibilityHints: string[] = []
  // debug
  if (isDebugJsonPayload) {
    const queryExtension = getQuery(e).extension || ctx.options.extension
    // figure out compatibilityHints based on what we're using
    if (['jpeg', 'jpg'].includes(queryExtension) && options.renderer === 'satori')
      compatibilityHints.push('Converting PNGs to JPEGs requires Sharp which only runs on Node based systems.')
    if (options.renderer === 'chromium')
      compatibilityHints.push('Using Chromium to generate images is only supported in Node based environments. It\'s recommended to only use this if you\'re prerendering')
    setHeader(e, 'Content-Type', 'application/json')
    return {
      siteConfig: {
        url: e.context.siteConfig.get().url,
      },
      compatibilityHints,
      cacheKey: ctx.key,
      options: ctx.options,
      ...(options.renderer === 'satori' ? await renderer.debug(ctx) : undefined),
    }
  }
  switch (extension) {
    case 'html':
      setHeader(e, 'Content-Type', `text/html`)
      // if the user is loading the iframe we need to render a nicer template
      // also used for chromium screenshots
      return html(ctx)
    case 'svg':
      if (!debug && !import.meta.dev) {
        return createError({
          statusCode: 404,
        })
      }
      if (ctx.renderer.name !== 'satori') {
        return createError({
          statusCode: 400,
          statusMessage: `[Nuxt OG Image] Generating ${extension}\'s with ${renderer.name} is not supported.`,
        })
      }
      // add svg headers
      setHeader(e, 'Content-Type', `image/svg+xml`)
      return (await ctx.renderer.debug(ctx)).svg
    case 'png':
    case 'jpeg':
    case 'jpg':
      if (!renderer.supportedFormats.includes(extension)) {
        return createError({
          statusCode: 400,
          statusMessage: `[Nuxt OG Image] Generating ${extension}\'s with ${renderer.name} is not supported.`,
        })
      }
      setHeader(e, 'Content-Type', `image/${extension === 'jpg' ? 'jpeg' : extension}`)
      break
    default:
      return createError({
        statusCode: 400,
        statusMessage: `[Nuxt OG Image] Invalid request for og.${extension}.`,
      })
  }
  const cacheApi = await useOgImageBufferCache(ctx, {
    cacheMaxAgeSeconds: ctx.options.cacheMaxAgeSeconds,
    baseCacheKey,
  })
  // we sent a 304 not modified
  if (typeof cacheApi === 'undefined')
    return
  if (cacheApi instanceof H3Error)
    return cacheApi

  let image: H3Error | BufferSource | false | void = cacheApi.cachedItem
  if (!image) {
    image = await renderer.createImage(ctx)
    if (image instanceof H3Error)
      return image
    if (!image) {
      return createError({
        statusCode: 500,
        statusMessage: `Failed to generate og.${extension}.`,
      })
    }
    await cacheApi.update(image)
  }
  return image
}
