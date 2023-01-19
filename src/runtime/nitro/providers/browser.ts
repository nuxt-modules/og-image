import { screenshot } from '../../browserUtil'
import type { Provider } from '../../../types'
import { height, width } from '#nuxt-og-image/config'
import { createBrowser } from '#nuxt-og-image/browser'

export default <Provider> {
  name: 'browser',
  createSvg: function createSvg() {
    throw new Error('Browser provider isn\'t able to create SVGs.')
  },
  createPng: async function createPng(basePath: string) {
    // extract the payload from the original path
    const browser = await createBrowser()
    return screenshot(browser!, basePath, {
      width: Number(width),
      height: Number(height),
    })
  },
}
