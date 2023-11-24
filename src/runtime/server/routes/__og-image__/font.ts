import type { H3Event } from 'h3'
import { getQuery } from 'h3'
import { defineCachedEventHandler } from '#imports'

// copied from vercel/satori
export default defineCachedEventHandler(async (e) => {
  const { name, weight } = getQuery(e)

  if (!name || !weight)
    return 'Provide a font name and weight'

  const css = await (
    await globalThis.$fetch(`https://fonts.googleapis.com/css2?family=${name}:wght@${weight}`, {
      headers: {
        // Make sure it returns TTF.
        'User-Agent':
          'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1',
      },
    })
  )

  const resource = css.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/)

  if (!resource)
    return
  return resource[1]
}, {
  getKey: (e: H3Event) => {
    const query = getQuery(e)
    return `nuxt-og-image:font-url:${query.name}:${query.weight}`
  },
})
