export const SVG2PNGWasmPlaceholder = '"/* NUXT_OG_IMAGE_SVG2PNG_WASM */"'
export const YogaWasmPlaceholder = '"/* NUXT_OG_IMAGE_YOGA_WASM */"'
export const ReSVGWasmPlaceholder = '"/* NUXT_OG_IMAGE_RESVG_WASM */"'

export const Wasms = [
  {
    placeholder: SVG2PNGWasmPlaceholder,
    path: 'svg2png/svg2png.wasm',
    file: 'svg2png.wasm',
  },
  {
    placeholder: ReSVGWasmPlaceholder,
    path: 'resvg/resvg.wasm',
    file: 'resvg.wasm',
  },
  {
    placeholder: YogaWasmPlaceholder,
    path: 'yoga/yoga.wasm',
    file: 'yoga.wasm',
  },
] as const

export interface RuntimeCompatibilitySchema {
  browser: false | 'playwright' | 'lambda'
  satori: false | 'default' | 'yoga-wasm'
  wasm: 'inline' | 'import' | 'fetch'
  png: 'resvg' | 'svg2png'
  wasmImportQuery?: string
}

export const DefaultRuntimeCompatibility: RuntimeCompatibilitySchema = {
  browser: 'playwright',
  satori: 'default',
  wasm: 'import',
  png: 'resvg',
}

export const RuntimeCompatibility: Record<'default' | string, Partial<RuntimeCompatibilitySchema>> = {
  'stackblitz': {
    browser: false,
    satori: 'yoga-wasm',
    wasm: 'inline',
  },
  'netlify': {
    browser: 'lambda',
    wasm: 'inline',
  },
  'cloudflare-pages': {
    browser: false,
  },
  'cloudflare': {
    browser: false,
  },
  'cloudflare-pages': {
    browser: false,
  },
  'vercel-edge': {
    browser: false,
    wasmImportQuery: '?module',
  },
}
