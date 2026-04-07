import type { OgImagePageScreenshotOptions } from '../../types'
import { useRouter } from '#app'
import { defineOgImageRaw } from './_defineOgImageRaw'

export function defineOgImageScreenshot(options: OgImagePageScreenshotOptions = {}) {
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
