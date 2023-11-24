import type { Browser } from 'playwright-core'
import { screenshot } from '../../browserUtil'
import type { Renderer } from '../../types'
import { getOgImagePath } from '../../utilts'
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
    // TODO validate environment
    // if (process.env.NODE_ENV === 'production' && !process.env.prerender && !runtimeBrowser && options.provider === 'browser')
    //   return sendRedirect(e, joinURL(useNitroOrigin(e), '__nuxt_og_image__/browser-provider-not-supported.png'))
    // TODO redirect for screenshot
    const launchBrowser = await loadBrowserLauncherChunk()
    if (!launchBrowser) {
      // throw new exception
      throw new Error('Failed to load browser. Is the `browserProvider` enabled?')
    }
    const browser: Browser = await launchBrowser()
    let res = null
    if (browser) {
      try {
        if (options.html) {
          res = await screenshot(browser!, options)
        }
        else {
          res = await screenshot(browser!, {
            ...options,
            host: options.requestOrigin,
            path: getOgImagePath(options.path, 'html'),
          })
        }
      }
      finally {
        await browser!.close()
      }
    }
    // @todo return placeholder image on failure
    return res
  },
}

export default BrowserRenderer
