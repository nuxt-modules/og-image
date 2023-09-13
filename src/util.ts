import type { Nuxt } from '@nuxt/schema'
import {
  addDependency,
} from 'nypm'
import { provider } from 'std-env'
import defu from 'defu'
import { useNuxt } from '@nuxt/kit'
import type { RuntimeCompatibilitySchema } from './const'
import { RuntimeCompatibility } from './const'

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

export function getNitroPreset(nuxt: Nuxt = useNuxt()) {
  return process.env.NITRO_PRESET || nuxt.options.nitro.preset || detectTarget() || 'node-server'
}

export function getNitroProviderCompatibility(defaults: RuntimeCompatibilitySchema, nuxt: Nuxt = useNuxt()): false | RuntimeCompatibilitySchema {
  let compatibility
  if (provider === 'stackblitz') {
    compatibility = RuntimeCompatibility.stackblitz as RuntimeCompatibilitySchema
  }
  else if (nuxt.options.dev || nuxt.options._prepare || nuxt.options._generate) {
    compatibility = {
      wasm: 'fetch',
      browser: 'universal',
    } as RuntimeCompatibilitySchema
  }
  else {
    const target = getNitroPreset(nuxt)
    const lookup = RuntimeCompatibility[target as keyof typeof RuntimeCompatibility]
    if (lookup === false)
      return false
    compatibility = (lookup || {}) as RuntimeCompatibilitySchema
  }
  compatibility = defu(compatibility, defaults)
  // compatibility is now resolved, normalise
  compatibility.cssInline = compatibility.cssInline || (compatibility.node ? 'node' : 'mock')
  return compatibility
}

export function ensureDependencies(nuxt: Nuxt, dep: string[]) {
  return Promise.all(dep.map((d) => {
    return addDependency(d, { cwd: nuxt.options.rootDir })
  }))
}
