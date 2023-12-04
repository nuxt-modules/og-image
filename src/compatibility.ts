import type { Nuxt } from '@nuxt/schema'
import {
  addDependency,
} from 'nypm'
import { env, provider } from 'std-env'
import { defu } from 'defu'
import type { NitroConfig, WasmOptions } from 'nitropack/types'

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
    chromium: 'node' | false
    ['css-inline']: 'node' | false
    resvg: 'node' | 'wasm' | false
    satori: 'node' | 'wasm' | false
    sharp: 'node' | false
  }
  wasm?: WasmOptions
}

export const NodeRuntime: RuntimeCompatibilitySchema = {
  // node-server runtime
  bindings: {
    'chromium': 'node',
    'css-inline': 'node',
    'resvg': 'node',
    'satori': 'node',
    'sharp': 'node',
  },
}

const cloudflare: RuntimeCompatibilitySchema = {
  bindings: {
    'chromium': false,
    'css-inline': false,
    'resvg': 'wasm',
    'satori': 'node',
    'sharp': false,
  },
  wasm: {
    esmImport: true,
  },
}
const awsLambda: RuntimeCompatibilitySchema = {
  bindings: {
    'chromium': false,
    'css-inline': 'node',
    'resvg': 'node',
    'satori': 'node',
    'sharp': 'node',
  },
}

export const RuntimeCompatibility: Record<string, RuntimeCompatibilitySchema> = {
  'nitro-dev': NodeRuntime,
  'nitro-prerender': NodeRuntime,
  'node-server': NodeRuntime,
  'stackblitz': {
    bindings: {
      'chromium': false,
      'css-inline': false,
      'resvg': 'wasm',
      'satori': 'wasm',
      'sharp': false,
    },
    wasm: {
      rollup: {
        targetEnv: 'auto-inline',
        sync: ['@resvg/resvg-wasm/index_bg.wasm'],
      },
    },
  },
  'aws-lambda': awsLambda,
  'netlify': awsLambda,
  'netlify-edge': {
    bindings: {
      'chromium': false,
      'css-inline': false,
      'resvg': 'wasm',
      'satori': 'node',
      'sharp': false,
    },
    wasm: {
      rollup: {
        targetEnv: 'auto-inline',
        sync: ['@resvg/resvg-wasm/index_bg.wasm'],
      },
    },
  },
  'vercel': awsLambda,
  'vercel-edge': {
    bindings: {
      'chromium': false,
      'css-inline': false,
      'resvg': 'wasm',
      'satori': 'node',
      'sharp': false,
    },
    wasm: {
      // lowers workers kb size
      esmImport: true,
    },
  },
  'cloudflare-pages': cloudflare,
  'cloudflare': cloudflare,
} as const

export function detectTarget(options: { static?: boolean } = {}) {
  // @ts-expect-error untyped
  return options?.static ? autodetectableStaticProviders[provider] : autodetectableProviders[provider]
}

export function resolveNitroPreset(nitroConfig?: NitroConfig) {
  if (provider === 'stackblitz')
    return 'stackblitz'
  let preset
  if (nitroConfig && nitroConfig?.preset)
    preset = nitroConfig.preset
  if (!preset)
    preset = env.NITRO_PRESET || detectTarget() || 'node-server'
  return preset.replace('_', '-') // sometimes they are different
}

export function getPresetNitroPresetCompatibility(target: string) {
  let compatibility: RuntimeCompatibilitySchema = RuntimeCompatibility[target as keyof typeof RuntimeCompatibility]
  if (!compatibility)
    compatibility = RuntimeCompatibility['nitro-dev']
  return compatibility
}

export function applyNitroPresetCompatibility(nitroConfig: NitroConfig, options: { compatibility?: RuntimeCompatibilitySchema, resolve: (s: string) => string, overrides?: RuntimeCompatibilitySchema }): RuntimeCompatibilitySchema {
  let compatibility: RuntimeCompatibilitySchema | undefined = options?.compatibility
  const target = resolveNitroPreset(nitroConfig)
  if (!compatibility)
    compatibility = getPresetNitroPresetCompatibility(target)
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
    applyBinding('css-inline'),
    nitroConfig.alias || {},
  )
  // if we're using any wasm modules we need to enable the wasm runtime
  if (Object.values(compatibility.bindings).includes('wasm')) {
    nitroConfig.experimental = nitroConfig.experimental || {}
    nitroConfig.experimental.wasm = true
  }
  nitroConfig.rollupConfig = nitroConfig.rollupConfig || {}
  nitroConfig.wasm = defu(compatibility.wasm, nitroConfig.wasm)
  return compatibility
}

export function ensureDependencies(nuxt: Nuxt, dep: string[]) {
  return Promise.all(dep.map((d) => {
    return addDependency(d, { cwd: nuxt.options.rootDir })
  }))
}
