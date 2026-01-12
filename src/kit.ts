import type { Nuxt, NuxtModule } from '@nuxt/schema'
import { loadNuxtModuleInstance, useNuxt } from '@nuxt/kit'

/**
 * Get the user provided options for a Nuxt module.
 *
 * These options may not be the resolved options that the module actually uses.
 * @param module
 * @param nuxt
 */
export async function getNuxtModuleOptions(module: string | NuxtModule, nuxt: Nuxt = useNuxt()) {
  const moduleMeta = (typeof module === 'string' ? { name: module } : await module.getMeta?.()) || {}
  const { nuxtModule } = (await loadNuxtModuleInstance(module, nuxt))

  let moduleEntry: [string | NuxtModule, Record<string, any>] | undefined
  for (const m of nuxt.options.modules) {
    if (Array.isArray(m) && m.length >= 2) {
      const _module = m[0]
      const _moduleEntryName = typeof _module === 'string'
        ? _module
        : (await (_module as any as NuxtModule).getMeta?.())?.name || ''
      if (_moduleEntryName === moduleMeta.name)
        moduleEntry = m as [string | NuxtModule, Record<string, any>]
    }
  }

  let inlineOptions = {}
  if (moduleEntry)
    inlineOptions = moduleEntry[1]
  if (nuxtModule.getOptions)
    return nuxtModule.getOptions(inlineOptions, nuxt)
  return inlineOptions
}

export function isNuxtGenerate(nuxt: Nuxt = useNuxt()) {
  return nuxt.options.nitro.static || nuxt.options.nitro.preset === 'static'
}
