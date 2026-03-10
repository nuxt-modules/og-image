import type _satori from 'satori'
import type _sharp from 'sharp'

// we keep instances alive to avoid re-importing them on every request
// Using any for bindings since they differ between node/wasm variants
const sharpInstance: { instance?: typeof _sharp } = { instance: undefined }
const resvgInstance: { instance?: { initWasmPromise: Promise<void>, Resvg: any } } = { instance: undefined }
const satoriInstance: { instance?: { initWasmPromise: Promise<void>, satori: typeof _satori } } = { instance: undefined }

// Singleton promises to prevent race conditions on concurrent first calls
let resvgImportPromise: Promise<void> | undefined
let satoriImportPromise: Promise<void> | undefined

export async function getResvg() {
  if (!resvgImportPromise) {
    resvgImportPromise = import('#og-image/bindings/resvg').then((m) => {
      resvgInstance.instance = m.default
    })
  }
  await resvgImportPromise
  await resvgInstance.instance!.initWasmPromise
  const Resvg = resvgInstance.instance!.Resvg
  if (!Resvg)
    throw new Error('[Nuxt OG Image] Resvg class is undefined after WASM initialization — the @resvg/resvg-wasm binding may have failed to load.')
  return Resvg
}

export async function getSatori() {
  if (!satoriImportPromise) {
    satoriImportPromise = import('#og-image/bindings/satori').then((m) => {
      satoriInstance.instance = m.default
    })
  }
  await satoriImportPromise
  await satoriInstance.instance!.initWasmPromise
  const { satori } = satoriInstance.instance!
  if (!satori)
    throw new Error('[Nuxt OG Image] satori is undefined after WASM initialization — the satori binding may have failed to load.')
  return satori
}

export async function getSharp() {
  sharpInstance.instance = sharpInstance.instance || await import('#og-image/bindings/sharp').then(m => m.default)
  return sharpInstance.instance!
}
