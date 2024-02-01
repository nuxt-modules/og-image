import type ChromiumRenderer from './chromium/renderer'
import type SatoriRenderer from './satori/renderer'

// we keep instances alive to avoid re-importing them on every request, maybe not needed but
// also helps with type inference
const satoriRendererInstance: { instance?: typeof SatoriRenderer } = { instance: undefined }
const chromiumRendererInstance: { instance?: typeof ChromiumRenderer } = { instance: undefined }

export async function useSatoriRenderer() {
  satoriRendererInstance.instance = satoriRendererInstance.instance || await import('#nuxt-og-image/renderers/satori').then(m => m.default)
  return satoriRendererInstance.instance!
}

export async function useChromiumRenderer() {
  chromiumRendererInstance.instance = chromiumRendererInstance.instance || await import('#nuxt-og-image/renderers/chromium').then(m => m.default)
  return chromiumRendererInstance.instance!
}
