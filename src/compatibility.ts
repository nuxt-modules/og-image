import type { Nuxt } from '@nuxt/schema'
import {
  ensureDependencyInstalled,
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
  'sharp': 'node', // will be disabled if they're missing the dependency
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

export const WebContainer: RuntimeCompatibilitySchema = {
  'chromium': false,
  'css-inline': 'wasm-fs',
  'resvg': 'wasm-fs',
  'satori': 'wasm-fs',
  'sharp': false,
}

export const RuntimeCompatibility: Record<string, RuntimeCompatibilitySchema> = {
  'nitro-dev': NodeRuntime,
  'nitro-prerender': NodeRuntime,
  'node-server': NodeRuntime,
  'stackblitz': WebContainer,
  'codesandbox': WebContainer,
  'aws-lambda': awsLambda,
  'netlify': awsLambda,
  'netlify-edge': {
    'chromium': false,
    'css-inline': 'wasm',
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
    'css-inline': 'wasm',
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
  'cloudflare-module': cloudflare,
} as const

export function detectTarget(options: { static?: boolean } = {}) {
  // @ts-expect-error untyped
  return options?.static ? autodetectableStaticProviders[provider] : autodetectableProviders[provider]
}

export function resolveNitroPreset(nitroConfig?: NitroConfig): string {
  if (provider === 'stackblitz' || provider === 'codesandbox')
    return provider
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

export function applyNitroPresetCompatibility(nitroConfig: NitroConfig, options: { compatibility?: CompatibilityFlags, resolve: (s: string) => string, overrides?: RuntimeCompatibilitySchema }): Partial<Omit<RuntimeCompatibilitySchema, 'wasm'>> {
  const target = resolveNitroPreset(nitroConfig)
  const compatibility: RuntimeCompatibilitySchema = getPresetNitroPresetCompatibility(target)
  const { resolve } = options

  const satoriEnabled = typeof options.compatibility?.satori !== 'undefined' ? !!options.compatibility.satori : !!compatibility.satori
  const chromiumEnabled = typeof options.compatibility?.chromium !== 'undefined' ? !!options.compatibility.chromium : !!compatibility.chromium
  // renderers
  nitroConfig.alias!['#nuxt-og-image/renderers/satori'] = satoriEnabled ? resolve('./runtime/core/renderers/satori') : 'unenv/runtime/mock/empty'
  nitroConfig.alias!['#nuxt-og-image/renderers/chromium'] = chromiumEnabled ? resolve('./runtime/core/renderers/chromium') : 'unenv/runtime/mock/empty'

  const resolvedCompatibility: Partial<Omit<RuntimeCompatibilitySchema, 'wasm'>> = {}
  function applyBinding(key: keyof Omit<RuntimeCompatibilitySchema, 'wasm'>) {
    let binding = options.compatibility?.[key]
    if (typeof binding === 'undefined')
      binding = compatibility[key]
    // TODO avoid breaking changes, remove this in v4
    if (key === 'chromium' && binding === 'node')
      binding = 'playwright'
    // @ts-expect-error untyped
    resolvedCompatibility[key] = binding
    return {
      [`#nuxt-og-image/bindings/${key}`]: binding === false ? 'unenv/runtime/mock/empty' : resolve(`./runtime/core/bindings/${key}/${binding}`),
    }
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

  nitroConfig.virtual!['#nuxt-og-image/compatibility'] = () => `export default ${JSON.stringify(resolvedCompatibility)}`
  addTemplate({
    filename: 'nuxt-og-image/compatibility.mjs',
    getContents() {
      return `export default ${JSON.stringify(resolvedCompatibility)}`
    },
    options: { mode: 'server' },
  })
  return resolvedCompatibility
}

export function ensureDependencies(dep: string[], nuxt: Nuxt = useNuxt()) {
  return Promise.all(dep.map((d) => {
    return ensureDependencyInstalled(d, {
      cwd: nuxt.options.rootDir,
      dev: true,
    })
  }))
}
