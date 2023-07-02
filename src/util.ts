import type { Nuxt } from '@nuxt/schema'
import {
  addDependency,
} from 'nypm'
import { provider } from 'std-env'
import defu from 'defu'
import type { RuntimeCompatibilitySchema } from './const'
import { DefaultRuntimeCompatibility, RuntimeCompatibility } from './const'

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

export function detectTarget(options: { static?: boolean } = {}) {
  // @ts-expect-error untyped
  return options?.static ? autodetectableStaticProviders[provider] : autodetectableProviders[provider]
}

export function getNitroPreset(nuxt: Nuxt) {
  return process.env.NITRO_PRESET || nuxt.options.nitro.preset || detectTarget() || 'node-server'
}

export function getNitroProviderCompatibility(nuxt: Nuxt): false | RuntimeCompatibilitySchema {
  if (provider === 'stackblitz')
    return defu(RuntimeCompatibility.stackblitz as RuntimeCompatibilitySchema, DefaultRuntimeCompatibility)
  if (nuxt.options.dev || nuxt.options._prepare || nuxt.options._generate) {
    return defu({
      wasm: 'fetch',
      browser: 'universal',
    } as RuntimeCompatibilitySchema, DefaultRuntimeCompatibility)
  }
  const target = getNitroPreset(nuxt)
  const compatibility = RuntimeCompatibility[target as keyof typeof RuntimeCompatibility]
  if (compatibility === false)
    return false
  return defu((compatibility || {}) as RuntimeCompatibilitySchema, DefaultRuntimeCompatibility)
}

export function ensureDependencies(nuxt: Nuxt, dep: string[]) {
  return Promise.all(dep.map((d) => {
    return addDependency(d, { cwd: nuxt.options.rootDir })
  }))
}
