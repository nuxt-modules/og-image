import { screenshot } from '../../browserUtil'
import type { Provider, ScreenshotOptions } from '../../../types'
import { createBrowser } from '#nuxt-og-image/browser'

export default <Provider> {
  name: 'browser',
  createSvg: function createSvg() {
    throw new Error('Browser provider isn\'t able to create SVGs.')
  },
  createPng: async function createPng(basePath, options) {
    const browser = await createBrowser()
    return screenshot(browser!, basePath, options as ScreenshotOptions)
  },
}
