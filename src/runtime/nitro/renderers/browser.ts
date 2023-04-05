import { withBase } from 'ufo'
import { screenshot } from '../../browserUtil'
import type { Renderer } from '../../../types'
import loadBrowser from '#nuxt-og-image/browser'
import { useRuntimeConfig } from '#imports'

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
    if (!createBrowser) {
      // throw new exception
      throw new Error('Failed to load browser. Is the `browserProvider` enabled?')
    }
    const browser = await createBrowser()
    if (browser) {
      try {
        return await screenshot(browser!, {
          ...options,
          host: withBase(useRuntimeConfig().app.baseURL, url.origin),
          path: `/api/og-image-html?path=${url.pathname}`,
        })
      }
      finally {
        browser!.close()
      }
    }
    return null
  },
}
