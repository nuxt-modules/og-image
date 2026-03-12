import type _satori from 'satori'
import type _sharp from 'sharp'

// we keep instances alive to avoid re-importing them on every request
// Using any for bindings since they differ between node/wasm variants
const sharpInstance: { instance?: typeof _sharp } = { instance: undefined }
const svgToPngInstance: { instance?: { initWasmPromise: Promise<void>, svgToPng: (svg: string, width?: number, height?: number) => Promise<Buffer | Uint8Array> } } = { instance: undefined }
const satoriInstance: { instance?: { initWasmPromise: Promise<void>, satori: typeof _satori } } = { instance: undefined }

// Singleton promises to prevent race conditions on concurrent first calls
let svgToPngImportPromise: Promise<void> | undefined
let satoriImportPromise: Promise<void> | undefined

export async function getSvgToPng() {
  if (!svgToPngImportPromise) {
    svgToPngImportPromise = import('#og-image/bindings/svgToPng').then((m) => {
      svgToPngInstance.instance = m.default
    })
  }
  await svgToPngImportPromise
  await svgToPngInstance.instance!.initWasmPromise
  const { svgToPng } = svgToPngInstance.instance!
  if (!svgToPng)
    throw new Error('[Nuxt OG Image] svgToPng is undefined — the @napi-rs/image binding may have failed to load.')
  return svgToPng
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
