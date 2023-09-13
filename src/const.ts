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
  browser: false | 'playwright' | 'lambda' | 'universal'
  satori: false | 'default' | 'yoga-wasm'
  wasm: 'inline' | 'import' | 'fetch'
  png: 'resvg-wasm' | 'svg2png' | 'resvg-node'
  cssInline?: 'node' | 'mock'
  node?: boolean
  wasmImportQuery?: string
}

export const DefaultRuntimeCompatibility: RuntimeCompatibilitySchema = {
  // node-server runtime
  browser: 'playwright',
  satori: 'default',
  wasm: 'fetch',
  png: 'resvg-node',
  node: true,
}

const cloudflare: Partial<RuntimeCompatibilitySchema> = {
  browser: false,
  wasm: 'import',
  png: 'resvg-wasm',
  node: false,
}
const awsLambda: Partial<RuntimeCompatibilitySchema> = {
  browser: false, // too difficult to support
  wasm: 'inline',
}
export const RuntimeCompatibility: Record<'default' | string, Partial<false | RuntimeCompatibilitySchema>> = {
  'nitro-dev': {
    wasm: 'fetch',
    browser: 'universal',
  },
  'stackblitz': {
    browser: false,
    satori: 'yoga-wasm',
    wasm: 'inline',
    png: 'resvg-wasm',
  },
  'aws-lambda': awsLambda,
  'netlify': awsLambda,
  'netlify-edge': {
    wasm: 'inline',
    png: 'resvg-wasm',
    node: false,
  },
  'vercel': {
    // exceeds 50mb limit
    browser: false,
  },
  'vercel-edge': {
    browser: false,
    wasm: 'import',
    wasmImportQuery: '?module',
    png: 'resvg-wasm',
    node: false,
  },
  'cloudflare-pages': cloudflare,
  'cloudflare': cloudflare,
}
