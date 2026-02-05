import type { OgImagePageScreenshotOptions } from '../../types'
import { useRouter } from '#app'
import { _defineOgImageRaw } from './_defineOgImageRaw'

export function defineOgImageScreenshot(options: OgImagePageScreenshotOptions = {}) {
  const router = useRouter()
  const route = router.currentRoute.value?.path || '/'
  return _defineOgImageRaw({
    alt: `Web page screenshot${route ? ` of ${route}` : ''}.`,
    renderer: 'browser',
    extension: 'jpeg',
    component: 'PageScreenshot', // this is an alias
    ...options,
  })
}
