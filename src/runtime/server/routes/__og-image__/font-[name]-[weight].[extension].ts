import { createError, defineEventHandler } from 'h3'
import { parseURL } from 'ufo'

// /__og-image__/font/<name>/<weight>.ttf
export default defineEventHandler(async (e) => {
  const path = parseURL(e.path).pathname

  const [_name, _weight] = path.split('/font/')[1].split('.')[0].split('/')

  if (!_name || !_weight)
    return 'Provide a font name and weight'

  // make sure name starts with a capital letter
  const name = _name[0].toUpperCase() + _name.slice(1)
  // make sure weight is a valid number between 100 to 900 in 100 increments
  const weight = Math.round(Number.parseInt(_weight) / 100) * 100

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
  if (ttfResource[1])
    return globalThis.$fetch(ttfResource[1], { responseType: 'arrayBuffer' })

  // try woff2
  const woff2Resource = css.match(/src: url\((.+)\) format\('woff2'\)/)
  if (woff2Resource[1])
    return globalThis.$fetch(woff2Resource[1], { responseType: 'arrayBuffer' })

  return createError({
    statusCode: 500,
    statusMessage: `[Nuxt OG Image] Malformed Google Font CSS ${css}`,
  })
})
