import type { Nuxt } from '@nuxt/schema'
import type { ModuleOptions } from './module'
import type { OgImageComponent } from './runtime/types'
import { addTemplate, addTypeTemplate } from '@nuxt/kit'
import { relative, resolve } from 'pathe'
import { getRegisteredBaseNames } from './util'

interface TemplateContext {
  nuxt: Nuxt
  config: ModuleOptions
  componentCtx: { components: OgImageComponent[] }
}

/**
 * Get the type expression for a component in the generated declaration.
 *
 * Uses `typeof import('...vue')['default']` for all components (app, community, pro).
 * The generated .d.ts is excluded from nuxt.d.ts and loaded via tsconfig include instead,
 * so .vue auto-imports are available by the time TypeScript resolves these imports.
 */
function getComponentTypeExpression(component: OgImageComponent, nuxt: Nuxt): string {
  if (!component.path)
    return `import('vue').DefineComponent<Record<string, any>>`
  const relativeComponentPath = relative(
    resolve(nuxt.options.rootDir, nuxt.options.buildDir, 'module'),
    component.path,
  )
  return `typeof import('${relativeComponentPath}')['default']`
}

export function registerTypeTemplates(ctx: TemplateContext) {
  const { nuxt, config, componentCtx } = ctx

  // Component types — uses `typeof import('component.vue')['default']` for full type safety.
  // NOT referenced from nuxt.d.ts ({ nuxt: false }) to avoid circular type resolution:
  //   nuxt.d.ts → component types → .vue → auto-imports (global, declared in nuxt.d.ts)
  // The .vue files need auto-imports to be loaded first, but nuxt.d.ts hasn't finished loading.
  // Instead, added to tsconfig include so it loads independently after nuxt.d.ts globals are ready.
  nuxt.hook('prepare:types', ({ tsConfig }) => {
    tsConfig.include = tsConfig.include || []
    tsConfig.include.push('./module/nuxt-og-image-components.d.ts')
  })
  addTypeTemplate({
    filename: 'module/nuxt-og-image-components.d.ts',
    getContents: () => {
      const sortedDirs = config.componentDirs.sort((a, b) => b.length - a.length)

      // Build base name → renderers map to detect ambiguous names
      const baseNameRenderers = new Map<string, string[]>()
      for (const component of componentCtx.components) {
        for (const baseName of getRegisteredBaseNames(component.pascalName)) {
          const renderers = baseNameRenderers.get(baseName) || []
          renderers.push(component.renderer)
          baseNameRenderers.set(baseName, renderers)
        }
      }

      const lines: string[] = []
      for (const component of componentCtx.components) {
        const importType = getComponentTypeExpression(component, nuxt)
        const strippedName = sortedDirs.reduce((n, dir) => n.replace(new RegExp(`^${dir}`), ''), component.pascalName)
        const renderer = component.renderer
        const baseNames = getRegisteredBaseNames(component.pascalName)

        // Alias: PascalCase 'NuxtSeoSatori'
        lines.push(`    '${strippedName}': ${importType}`)
        // Add all base name variants (handles Nuxt prefix deduplication)
        const seen = new Set<string>([strippedName])
        for (const baseName of baseNames) {
          // Primary: dot notation 'NuxtSeo.satori'
          const dotName = `${baseName}.${renderer}`
          if (!seen.has(dotName)) {
            lines.push(`    '${dotName}': ${importType}`)
            seen.add(dotName)
          }
          // Shorthand: bare name 'NuxtSeo' only if unambiguous (single renderer)
          const renderers = baseNameRenderers.get(baseName) || []
          if (renderers.length === 1 && !seen.has(baseName)) {
            lines.push(`    '${baseName}': ${importType}`)
            seen.add(baseName)
          }
        }
      }

      return `declare module '#og-image/components' {
  export interface OgImageComponents {
${lines.join('\n')}
  }
}
`
    },
  }, { nuxt: false })

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

declare module '#og-image/fonts-available' {
  const fonts: Array<{ family: string, src: string, weight: number, style: string, satoriSrc?: string, unicodeRange?: string }>
  export default fonts
}

declare module '#og-image/font-requirements' {
  export const fontRequirements: {
    weights: number[]
    styles: Array<'normal' | 'italic'>
    families: string[]
    hasDynamicBindings: boolean
  }
  export const componentFontMap: Record<string, {
    weights: number[]
    styles: Array<'normal' | 'italic'>
    families: string[]
    hasDynamicBindings: boolean
    category?: 'app' | 'community' | 'pro'
  }>
  export const hasNuxtFonts: boolean
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
  import type { H3Event } from 'h3'
  export function createBrowser(event?: H3Event): Promise<any>
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
