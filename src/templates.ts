import type { Nuxt } from '@nuxt/schema'
import type { ModuleOptions } from './module'
import type { OgImageComponent } from './runtime/types'
import { addTemplate, addTypeTemplate } from '@nuxt/kit'
import { relative, resolve } from 'pathe'
import { stripRendererSuffix } from './util'

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
      const sortedDirs = config.componentDirs.sort((a, b) => b.length - a.length)

      // Build base name → renderers map to detect ambiguous names
      const baseNameRenderers = new Map<string, string[]>()
      for (const component of componentCtx.components) {
        const strippedName = sortedDirs.reduce((n, dir) => n.replace(new RegExp(`^${dir}`), ''), component.pascalName)
        const baseName = stripRendererSuffix(strippedName)
        const renderers = baseNameRenderers.get(baseName) || []
        renderers.push(component.renderer)
        baseNameRenderers.set(baseName, renderers)
      }

      const lines: string[] = []
      for (const component of componentCtx.components) {
        const relativeComponentPath = relative(
          resolve(nuxt.options.rootDir, nuxt.options.buildDir, 'module'),
          component.path!,
        )
        const importType = `typeof import('${relativeComponentPath}')['default']`
        const strippedName = sortedDirs.reduce((n, dir) => n.replace(new RegExp(`^${dir}`), ''), component.pascalName)
        const baseName = stripRendererSuffix(strippedName)
        const renderer = component.renderer

        // Primary: dot notation 'NuxtSeo.satori'
        lines.push(`    '${baseName}.${renderer}': ${importType}`)
        // Alias: PascalCase 'NuxtSeoSatori'
        lines.push(`    '${strippedName}': ${importType}`)
        // Shorthand: bare name 'NuxtSeo' only if unambiguous (single renderer)
        const renderers = baseNameRenderers.get(baseName) || []
        if (renderers.length === 1) {
          lines.push(`    '${baseName}': ${importType}`)
        }
      }

      return `declare module '#og-image/components' {
  export interface OgImageComponents {
${lines.join('\n')}
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

declare module '#og-image/font-requirements' {
  export const fontRequirements: {
    weights: number[]
    styles: Array<'normal' | 'italic'>
    isComplete: boolean
  }
}

declare module '#og-image-virtual/unocss-config.mjs' {
  export const theme: Record<string, any>
}

declare module '#og-image-virtual/iconify-json-icons.mjs' {
  interface IconsData { icons: Record<string, { body: string, width?: number, height?: number }>, width: number, height: number }
  export function loadIcons(): IconsData
}

declare module '#og-image-virtual/component-names.mjs' {
  import type { OgImageComponent } from '${typesPath}'
  export const componentNames: OgImageComponent[]
}

declare module '#og-image-virtual/build-dir.mjs' {
  export const buildDir: string
}

declare module '#og-image/compatibility' {
  import type { RuntimeCompatibilitySchema } from '${typesPath}'
  const compatibility: Partial<Omit<RuntimeCompatibilitySchema, 'wasm'>>
  export default compatibility
}
declare module '#og-image-virtual/tw4-theme.mjs' {
  export const tw4FontVars: Record<string, string>
  export const tw4Breakpoints: Record<string, number>
  export const tw4Colors: Record<string, string | Record<string, string>>
}
`
    },
  })

  // Binding type definitions
  addTemplate({
    filename: 'types/og-image-bindings.d.ts',
    getContents: (data) => {
      const typesPath = relative(resolve(data.nuxt!.options.rootDir, data.nuxt!.options.buildDir, 'types'), resolve('runtime/types'))
      return `declare module '#og-image/bindings/browser' {
  export function createBrowser(): Promise<any>
}

declare module '#og-image/bindings/satori' {
  import satori from 'satori'
  const _default: { initWasmPromise: Promise<void>, satori: typeof satori }
  export default _default
}

declare module '#og-image/bindings/resvg' {
  import { Resvg } from '@resvg/resvg-js'
  const _default: { initWasmPromise: Promise<void>, Resvg: typeof Resvg }
  export default _default
}

declare module '#og-image/bindings/sharp' {
  import sharp from 'sharp'
  const _default: typeof sharp
  export default _default
}

declare module '#og-image/bindings/css-inline' {
  import cssInline from '@css-inline/css-inline'
  const _default: { initWasmPromise: Promise<void>, cssInline: typeof cssInline }
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

declare module '#og-image/renderers/browser' {
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
  import type { OgImageRenderEventContext } from '${typesPath}'
  export function getEmojiSvg(ctx: OgImageRenderEventContext, emoji: string): Promise<string | null>
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
