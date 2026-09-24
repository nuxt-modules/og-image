import type { OgImagePageScreenshotOptions } from '../../types'
import { createError, useRouter } from '#app'
import { useOgImageRuntimeConfig } from '../utils'
import { defineOgImageRaw } from './_defineOgImageRaw'

export function defineOgImageScreenshot(options: OgImagePageScreenshotOptions = {}) {
  if (!useOgImageRuntimeConfig().browserEnabled)
    throw createError({ statusCode: 500, statusMessage: '[nuxt-og-image] Screenshots require browser opt-in. Set ogImage.browser to true or a browser provider in nuxt.config.ts.' })
  const router = useRouter()
  const route = router.currentRoute.value?.path || '/'
  const { delay, mask, selector, colorScheme, ...rest } = options
  return defineOgImageRaw({
    alt: `Web page screenshot${route ? ` of ${route}` : ''}.`,
    renderer: 'browser',
    extension: 'jpeg',
    component: 'PageScreenshot', // this is an alias
    screenshot: { delay, mask, selector, colorScheme },
    ...rest,
  })
}
