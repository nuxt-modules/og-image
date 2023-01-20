import { screenshot } from '../../browserUtil'
import type { Provider, ScreenshotOptions } from '../../../types'
import { createBrowser } from '#nuxt-og-image/browser'

export default <Provider> {
  name: 'browser',
  createSvg: async function createSvg() {
    throw new Error('Browser provider can\'t create SVGs.')
  },
  createVNode: async function createVNode() {
    throw new Error('Browser provider can\'t create VNodes.')
  },
  createPng: async function createPng(basePath, options) {
    const browser = await createBrowser()
    return screenshot(browser!, basePath, options as ScreenshotOptions)
  },
}
