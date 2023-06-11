import { screenshot } from '../../browserUtil'
import type { Renderer } from '../../../types'
import loadBrowserLauncherChunk from '#nuxt-og-image/browser'

const BrowserRenderer: Renderer = {
  name: 'browser',
  createSvg: async function createSvg() {
    throw new Error('Browser provider can\'t create SVGs.')
  },
  createVNode: async function createVNode() {
    throw new Error('Browser provider can\'t create VNodes.')
  },
  createPng: async function createPng(options) {
    const launchBrowser = await loadBrowserLauncherChunk()
    if (!launchBrowser) {
      // throw new exception
      throw new Error('Failed to load browser. Is the `browserProvider` enabled?')
    }
    const browser = await launchBrowser()
    let res = null
    if (browser) {
      try {
        res = await screenshot(browser!, {
          ...options,
          host: options.requestOrigin,
          path: `/api/og-image-html?path=${options.path}`,
        })
      }
      finally {
        browser!.close()
      }
    }
    // @todo return placeholder image on failure
    return res
  },
}

export default BrowserRenderer
