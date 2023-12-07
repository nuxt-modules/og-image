import type { Nuxt } from '@nuxt/schema'
import {
  addDependency,
} from 'nypm'
import { env, provider } from 'std-env'
import { defu } from 'defu'
import type { NitroConfig } from 'nitropack/types'
import { addTemplate, useNuxt } from '@nuxt/kit'
import type { CompatibilityFlags, RuntimeCompatibilitySchema } from './runtime/types'

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

export const NodeRuntime: RuntimeCompatibilitySchema = {
  // node-server runtime
  'chromium': 'node',
  'css-inline': 'node',
  'resvg': 'node',
  'satori': 'node',
  'sharp': 'node',
}

const cloudflare: RuntimeCompatibilitySchema = {
  'chromium': false,
  'css-inline': false,
  'resvg': 'wasm',
  'satori': 'node',
  'sharp': false,
  'wasm': {
    esmImport: true,
  },
}
const awsLambda: RuntimeCompatibilitySchema = {
  'chromium': false,
  'css-inline': 'node',
  'resvg': 'node',
  'satori': 'node',
  'sharp': false, // 0.33.x has issues
}

export const RuntimeCompatibility: Record<string, RuntimeCompatibilitySchema> = {
  'nitro-dev': NodeRuntime,
  'nitro-prerender': NodeRuntime,
  'node-server': NodeRuntime,
  'stackblitz': {
    'chromium': false,
    'css-inline': false,
    'resvg': 'wasm-fs',
    'satori': 'wasm-fs',
    'sharp': false,
  },
  'aws-lambda': awsLambda,
  'netlify': awsLambda,
  'netlify-edge': {
    'chromium': false,
    'css-inline': false,
    'resvg': 'wasm',
    'satori': 'node',
    'sharp': false,
    'wasm': {
      rollup: {
        targetEnv: 'auto-inline',
        sync: ['@resvg/resvg-wasm/index_bg.wasm'],
      },
    },
  },
  'firebase': awsLambda,
  'vercel': awsLambda,
  'vercel-edge': {
    'chromium': false,
    'css-inline': false,
    'resvg': 'wasm',
    'satori': 'node',
    'sharp': false,
    'wasm': {
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

export function resolveNitroPreset(nitroConfig?: NitroConfig): string {
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

export function applyNitroPresetCompatibility(nitroConfig: NitroConfig, options: { compatibility?: CompatibilityFlags, resolve: (s: string) => string, overrides?: RuntimeCompatibilitySchema }): RuntimeCompatibilitySchema {
  const target = resolveNitroPreset(nitroConfig)
  const compatibility: RuntimeCompatibilitySchema = getPresetNitroPresetCompatibility(target)
  const { resolve } = options

  // renderers
  nitroConfig.alias!['#nuxt-og-image/renderers/satori'] = compatibility.satori !== false ? resolve('./runtime/core/renderers/satori') : 'unenv/runtime/mock/empty'
  nitroConfig.alias!['#nuxt-og-image/renderers/chromium'] = compatibility.chromium !== false ? resolve('./runtime/core/renderers/chromium') : 'unenv/runtime/mock/empty'

  function applyBinding(key: keyof RuntimeCompatibilitySchema) {
    let binding = compatibility[key] as string | false
    // @ts-expect-error untyped
    const override = options.compatibility?.[key]
    if (override) {
      if (override === true)
        binding = 'node'
      else
        binding = override
    }
    return { [`#nuxt-og-image/bindings/${key}`]: binding === false ? 'unenv/runtime/mock/empty' : resolve(`./runtime/core/bindings/${key}/${binding}`) }
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
  if (Object.values(compatibility).includes('wasm')) {
    nitroConfig.experimental = nitroConfig.experimental || {}
    nitroConfig.experimental.wasm = true
  }
  nitroConfig.rollupConfig = nitroConfig.rollupConfig || {}
  nitroConfig.wasm = defu(compatibility.wasm, nitroConfig.wasm)

  nitroConfig.virtual!['#nuxt-og-image/compatibility'] = () => `export default ${JSON.stringify(compatibility)}`
  addTemplate({
    filename: 'nuxt-og-image/compatibility.mjs',
    getContents() {
      return `export default ${JSON.stringify(compatibility)}`
    },
    options: { mode: 'server' },
  })
  return compatibility
}

export function ensureDependencies(dep: string[], nuxt: Nuxt = useNuxt()) {
  return Promise.all(dep.map((d) => {
    return addDependency(d, { cwd: nuxt.options.rootDir, dev: true })
  }))
}
