import { screenshot } from '../../browserUtil'
import type { Renderer } from '../../../types'
import loadBrowser from '#nuxt-og-image/browser'

export default <Renderer> {
  name: 'browser',
  createSvg: async function createSvg() {
    throw new Error('Browser provider can\'t create SVGs.')
  },
  createVNode: async function createVNode() {
    throw new Error('Browser provider can\'t create VNodes.')
  },
  createPng: async function createPng(basePath, options) {
    const url = new URL(basePath)
    const createBrowser = await loadBrowser()
    const browser = await createBrowser()
    if (browser) {
      return screenshot(browser!, {
        ...options,
        host: url.origin,
        path: `/api/og-image-html?path=${url.pathname}`,
      })
    }
    return null
  },
}
