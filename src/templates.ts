import type { Nuxt } from '@nuxt/schema'
import type { ModuleOptions } from './module'
import type { OgImageComponent } from './runtime/types'
import { addTemplate, addTypeTemplate } from '@nuxt/kit'
import { relative, resolve } from 'pathe'

interface TemplateContext {
  nuxt: Nuxt
  config: ModuleOptions
  componentCtx: { components: OgImageComponent[] }
}

export function registerTypeTemplates(ctx: TemplateContext) {
  const { nuxt, config, componentCtx } = ctx

  // Nuxt-only: component types for client-side usage
  addTypeTemplate({
    filename: 'module/nuxt-og-image-components.d.ts',
    getContents: () => {
      const componentImports = componentCtx.components.map((component) => {
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
`
    },
  }, { nuxt: true })

  // Virtual module type definitions
  addTemplate({
    filename: 'types/og-image-virtual.d.ts',
    getContents: (data) => {
      const typesPath = relative(resolve(data.nuxt!.options.rootDir, data.nuxt!.options.buildDir, 'types'), resolve('runtime/types'))
      return `declare module '#og-image-virtual/public-assets.mjs' {
  import type { H3Event } from 'h3'
  import type { FontConfig } from '${typesPath}'
  export function resolve(event: H3Event, font: FontConfig): Promise<BufferSource>
}

declare module '#og-image/fonts' {
  import type { FontConfig } from '${typesPath}'
  const fonts: FontConfig[]
  export default fonts
}

declare module '#og-image-virtual/unocss-config.mjs' {
  export const theme: Record<string, any>
}

declare module '#og-image-virtual/iconify-json-icons.mjs' {
  export const icons: Record<string, string>
  export const width: number
  export const height: number
}

declare module '#og-image-virtual/component-names.mjs' {
  import type { OgImageComponent } from '${typesPath}'
  export const componentNames: OgImageComponent[]
}

declare module '#og-image/compatibility' {
  import type { RuntimeCompatibilitySchema } from '${typesPath}'
  const compatibility: Partial<Omit<RuntimeCompatibilitySchema, 'wasm'>>
  export default compatibility
}
`
    },
  })

  // Binding type definitions
  addTemplate({
    filename: 'types/og-image-bindings.d.ts',
    getContents: (data) => {
      const typesPath = relative(resolve(data.nuxt!.options.rootDir, data.nuxt!.options.buildDir, 'types'), resolve('runtime/types'))
      return `declare module '#og-image/bindings/chromium' {
  export function createBrowser(): Promise<any>
}

declare module '#og-image/bindings/satori' {
  import satori from 'satori'
  const _default: typeof satori
  export default _default
}

declare module '#og-image/bindings/resvg' {
  import { Resvg } from '@resvg/resvg-js'
  const _default: typeof Resvg
  export default _default
}

declare module '#og-image/bindings/sharp' {
  import sharp from 'sharp'
  const _default: typeof sharp
  export default _default
}

declare module '#og-image/bindings/css-inline' {
  const _default: { inline: (html: string, options?: any) => string }
  export default _default
}

declare module '#og-image/bindings/takumi' {
  const _default: any
  export default _default
}

declare module '#og-image/renderers/satori' {
  import type { Renderer } from '${typesPath}'
  const _default: Renderer
  export default _default
}

declare module '#og-image/renderers/chromium' {
  import type { Renderer } from '${typesPath}'
  const _default: Renderer
  export default _default
}

declare module '#og-image/renderers/takumi' {
  import type { Renderer } from '${typesPath}'
  const _default: Renderer
  export default _default
}

declare module '#og-image/emoji-transform' {
  export function getEmojiSvg(emoji: string): Promise<string | undefined>
}

declare module '#og-image-cache' {
  export { htmlPayloadCache, prerenderOptionsCache, emojiCache, fontCache } from '${typesPath.replace('/types', '')}/server/og-image/cache/lru'
}
`
    },
  })

  // Nitropack augmentations
  addTypeTemplate({
    filename: 'types/og-image-augments.d.ts',
    getContents: (data) => {
      const typesPath = relative(resolve(data.nuxt!.options.rootDir, data.nuxt!.options.buildDir, 'types'), resolve('runtime/types'))
      return `/// <reference path="./og-image-virtual.d.ts" />
/// <reference path="./og-image-bindings.d.ts" />
import type { OgImageOptions, OgImageRenderEventContext, VNode } from '${typesPath}'

declare module 'nitropack' {
  interface NitroRouteRules {
    ogImage?: false | OgImageOptions & Record<string, any>
  }
  interface NitroRouteConfig {
    ogImage?: false | OgImageOptions & Record<string, any>
  }
  interface NitroRuntimeHooks {
    'nuxt-og-image:context': (ctx: OgImageRenderEventContext) => void | Promise<void>
    'nuxt-og-image:satori:vnodes': (vnodes: VNode, ctx: OgImageRenderEventContext) => void | Promise<void>
  }
}

declare module 'nitropack/types' {
  interface NitroRouteRules {
    ogImage?: false | OgImageOptions & Record<string, any>
  }
  interface NitroRouteConfig {
    ogImage?: false | OgImageOptions & Record<string, any>
  }
  interface NitroRuntimeHooks {
    'nuxt-og-image:context': (ctx: OgImageRenderEventContext) => void | Promise<void>
    'nuxt-og-image:satori:vnodes': (vnodes: VNode, ctx: OgImageRenderEventContext) => void | Promise<void>
  }
}

export {}
`
    },
  })
}
