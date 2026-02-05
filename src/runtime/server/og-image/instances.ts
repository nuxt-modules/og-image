import type BrowserRenderer from './browser/renderer'
import type SatoriRenderer from './satori/renderer'
import type TakumiRenderer from './takumi/renderer'

// we keep instances alive to avoid re-importing them on every request, maybe not needed but
// also helps with type inference
const satoriRendererInstance: { instance?: typeof SatoriRenderer } = { instance: undefined }
const browserRendererInstance: { instance?: typeof BrowserRenderer } = { instance: undefined }
const takumiRendererInstance: { instance?: typeof TakumiRenderer } = { instance: undefined }

export async function useSatoriRenderer() {
  satoriRendererInstance.instance = satoriRendererInstance.instance || await import('#og-image/renderers/satori').then(m => m.default)
  return satoriRendererInstance.instance!
}

export async function useBrowserRenderer() {
  browserRendererInstance.instance = browserRendererInstance.instance || await import('#og-image/renderers/browser').then(m => m.default)
  return browserRendererInstance.instance!
}

export async function useTakumiRenderer() {
  takumiRendererInstance.instance = takumiRendererInstance.instance || await import('#og-image/renderers/takumi').then(m => m.default)
  return takumiRendererInstance.instance!
}
