import type { Nuxt } from '@nuxt/schema'
import {
  addDependency,
} from 'nypm'
import { env, provider } from 'std-env'
import { defu } from 'defu'
import type { NitroConfig } from 'nitropack/types'

const autodetectableProviders = {
  azure_static: 'azure',
  cloudflare_pages: 'cloudflare-pages',
  netlify: 'netlify',
  stormkit: 'stormkit',
  vercel: 'vercel',
  cleavr: 'cleavr',
  stackblitz: 'stackblitz',
}

const autodetectableStaticProviders = {
  netlify: 'netlify-static',
  vercel: 'vercel-static',
}

export interface RuntimeCompatibilitySchema {
  bindings: {
    chromium: 'universal' | 'playwright' | 'lambda' | false
    ['css-inline']: 'node' | false
    resvg: 'node' | 'wasm' | false
    satori: 'node' | 'yoga-wasm' | false
    sharp: 'node' | 'lambda' | false
  }
  wasmStrategy?: 'inline' | 'import' | 'fetch'
  wasmImportQuery?: string
}

export const NodeRuntime: RuntimeCompatibilitySchema = {
  // node-server runtime
  bindings: {
    'chromium': 'universal',
    'css-inline': 'node',
    'resvg': 'node',
    'satori': 'node',
    'sharp': 'node',
  },
  wasmStrategy: 'import',
}

const cloudflare: RuntimeCompatibilitySchema = {
  bindings: {
    'chromium': false,
    'css-inline': 'node',
    'resvg': 'wasm',
    'satori': 'node',
    'sharp': false,
  },
  wasmStrategy: 'import',
}
const awsLambda: RuntimeCompatibilitySchema = {
  bindings: {
    'chromium': false,
    'css-inline': 'node',
    'resvg': 'wasm',
    'satori': 'node',
    'sharp': 'node',
  },
  wasmStrategy: 'inline',
}

export const RuntimeCompatibility: Record<string, RuntimeCompatibilitySchema> = {
  'nitro-dev': NodeRuntime,
  'nitro-prerender': NodeRuntime,
  'node-server': NodeRuntime,
  'stackblitz': {
    bindings: {
      'chromium': false,
      'css-inline': 'node',
      'resvg': 'wasm',
      'satori': 'node',
      'sharp': 'node',
    },
    wasmStrategy: 'inline',
  },
  'aws-lambda': awsLambda,
  'netlify': awsLambda,
  'netlify-edge': {
    bindings: {
      'chromium': false,
      'css-inline': 'node',
      'resvg': 'wasm',
      'satori': 'node',
      'sharp': 'node',
    },
    wasmStrategy: 'inline',
  },
  'vercel': {
    bindings: {
      'chromium': false,
      'css-inline': 'node',
      'resvg': 'wasm',
      'satori': 'node',
      'sharp': 'node',
    },
    wasmStrategy: 'inline',
  },
  'vercel-edge': {
    bindings: {
      'chromium': false,
      'css-inline': 'node',
      'resvg': 'wasm',
      'satori': 'node',
      'sharp': 'node',
    },
    wasmStrategy: 'inline',
    wasmImportQuery: '?module',
  },
  'cloudflare-pages': cloudflare,
  'cloudflare': cloudflare,
} as const

export function detectTarget(options: { static?: boolean } = {}) {
  // @ts-expect-error untyped
  return options?.static ? autodetectableStaticProviders[provider] : autodetectableProviders[provider]
}

export function resolveNitroPreset(nitroConfig: NitroConfig) {
  if (provider === 'stackblitz')
    return 'stackblitz'
  let preset
  if (nitroConfig.preset)
    preset = nitroConfig.preset
  if (!preset)
    preset = env.NITRO_PRESET || detectTarget() || 'node-server'
  return preset.replace('_', '-') // sometimes they are different
}

export function applyNitroPresetCompatibility(nitroConfig: NitroConfig, options: { compatibility?: RuntimeCompatibilitySchema, resolve: (s: string) => string, overrides?: RuntimeCompatibilitySchema }): RuntimeCompatibilitySchema {
  let compatibility: RuntimeCompatibilitySchema | undefined = options?.compatibility
  const target = resolveNitroPreset(nitroConfig)
  if (!compatibility) {
    compatibility = RuntimeCompatibility[target as keyof typeof RuntimeCompatibility]
    if (!compatibility)
      compatibility = RuntimeCompatibility['nitro-dev']
  }
  const resolve = options.resolve
  function applyBinding(key: keyof RuntimeCompatibilitySchema['bindings']) {
    const binding: string | false = compatibility!.bindings[key]
    if (binding === false)
      return { [`#nuxt-og-image/bindings/${key}`]: 'unenv/runtime/mock/empty' }
    return { [`#nuxt-og-image/bindings/${key}`]: resolve(`./runtime/core/bindings/${key}/${binding}`) }
  }
  nitroConfig.alias = defu(
    applyBinding('chromium'),
    applyBinding('satori'),
    applyBinding('resvg'),
    applyBinding('sharp'),
    nitroConfig.alias || {},
  )
  if (target.includes('cloudflare')) {
    nitroConfig.rollupConfig = nitroConfig.rollupConfig || {}
    nitroConfig.rollupConfig.output!.inlineDynamicImports = true
  }
  return compatibility
}

export function ensureDependencies(nuxt: Nuxt, dep: string[]) {
  return Promise.all(dep.map((d) => {
    return addDependency(d, { cwd: nuxt.options.rootDir })
  }))
}

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
