import type _satori from 'satori'
import type _sharp from 'sharp'

// we keep instances alive to avoid re-importing them on every request
// Using any for bindings since they differ between node/wasm variants
const sharpInstance: { instance?: typeof _sharp } = { instance: undefined }
const resvgInstance: { instance?: { initWasmPromise: Promise<void>, Resvg: any } } = { instance: undefined }
const satoriInstance: { instance?: { initWasmPromise: Promise<void>, satori: typeof _satori } } = { instance: undefined }

export async function useResvg() {
  if (!resvgInstance.instance) {
    const m = await import('#og-image/bindings/resvg')
    resvgInstance.instance = m.default
  }
  await resvgInstance.instance!.initWasmPromise
  const Resvg = resvgInstance.instance!.Resvg
  if (!Resvg)
    throw new Error('[Nuxt OG Image] Resvg class is undefined after WASM initialization — the @resvg/resvg-wasm binding may have failed to load.')
  return Resvg
}

export async function useSatori() {
  if (!satoriInstance.instance) {
    const m = await import('#og-image/bindings/satori')
    satoriInstance.instance = m.default
  }
  await satoriInstance.instance!.initWasmPromise
  return satoriInstance.instance!.satori
}

export async function useSharp() {
  sharpInstance.instance = sharpInstance.instance || await import('#og-image/bindings/sharp').then(m => m.default)
  return sharpInstance.instance!
}
