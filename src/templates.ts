import type { Nuxt } from '@nuxt/schema'
import type { ModuleOptions } from './module'
import type { OgImageComponent } from './runtime/types'
import { addTypeTemplate } from '@nuxt/kit'
import { relative, resolve } from 'pathe'

interface TemplateContext {
  nuxt: Nuxt
  config: ModuleOptions
  components: OgImageComponent[]
}

function getTypesPath(nuxt: Nuxt) {
  return relative(
    resolve(nuxt.options.rootDir, nuxt.options.buildDir, 'module'),
    resolve('runtime/types'),
  )
}

export function registerTypeTemplates(ctx: TemplateContext) {
  const { nuxt, config, components } = ctx

  // Nuxt-only: component types for client-side usage
  addTypeTemplate({
    filename: 'module/nuxt-og-image-components.d.ts',
    getContents: () => {
      const componentImports = components.map((component) => {
        const relativeComponentPath = relative(
          resolve(nuxt.options.rootDir, nuxt.options.buildDir, 'module'),
          component.path!,
        )
        const name = config.componentDirs
          .sort((a, b) => b.length - a.length)
          .reduce((n, dir) => n.replace(new RegExp(`^${dir}`), ''), component.pascalName)
        return `    '${name}': typeof import('${relativeComponentPath}')['default']`
      }).join('\n')
      return `declare module '#og-image/components' {
  export interface OgImageComponents {
${componentImports}
  }
}
declare module '#og-image/unocss-config' {
  export type theme = any
}
`
    },
  }, { nuxt: true })

  // Nitro-only: server-side virtual modules
  addTypeTemplate({
    filename: 'module/nuxt-og-image-server.d.ts',
    getContents: (data) => {
      const typesPath = getTypesPath(data.nuxt!)
      return `declare module '#og-image/compatibility' {
  const compatibility: Partial<Omit<import('${typesPath}').RuntimeCompatibilitySchema, 'wasm'>>
  export default compatibility
}
declare module '#og-image-virtual/component-names.mjs' {
  export const componentNames: import('${typesPath}').OgImageComponent[]
}
`
    },
  }, { nitro: true })

  // Nitro-only: nitropack augmentations
  addTypeTemplate({
    filename: 'module/nuxt-og-image-nitro.d.ts',
    getContents: (data) => {
      const typesPath = getTypesPath(data.nuxt!)
      const types = `interface NitroRouteRules {
    ogImage?: false | import('${typesPath}').OgImageOptions & Record<string, any>
  }
  interface NitroRouteConfig {
    ogImage?: false | import('${typesPath}').OgImageOptions & Record<string, any>
  }
  interface NitroRuntimeHooks {
    'nuxt-og-image:context': (ctx: import('${typesPath}').OgImageRenderEventContext) => void | Promise<void>
    'nuxt-og-image:satori:vnodes': (vnodes: import('${typesPath}').VNode, ctx: import('${typesPath}').OgImageRenderEventContext) => void | Promise<void>
  }`
      return `import '${typesPath}'

declare module 'nitropack' {
${types}
}

declare module 'nitropack/types' {
${types}
}

export {}
`
    },
  }, { nitro: true })
}
