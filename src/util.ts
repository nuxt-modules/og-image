import type { Nuxt } from '@nuxt/schema'
import {
  addDependency,
} from 'nypm'
import { provider } from 'std-env'
import defu from 'defu'
import type { RuntimeCompatibilitySchema } from './const'
import { DefaultRuntimeCompatibility, RuntimeCompatibility } from './const'

export function getNitroProviderCompatibility(nuxt: Nuxt): RuntimeCompatibilitySchema {
  if (nuxt.options.dev || nuxt.options._prepare)
    return DefaultRuntimeCompatibility

  if (provider === 'stackblitz')
    return defu(RuntimeCompatibility.stackblitz as RuntimeCompatibilitySchema, DefaultRuntimeCompatibility)

  const target = process.env.NITRO_PRESET || nuxt.options.nitro.preset
  const compatibility = RuntimeCompatibility[target as keyof typeof RuntimeCompatibility] || {}
  return defu(compatibility as RuntimeCompatibilitySchema, DefaultRuntimeCompatibility)
}

export function ensureDependency(nuxt: Nuxt, dep: string) {
  return addDependency(dep, { cwd: nuxt.options.rootDir })
}
