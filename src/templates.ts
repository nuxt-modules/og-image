import type { Nuxt } from '@nuxt/schema'
import type { ModuleOptions } from './module'
import type { OgImageComponent } from './runtime/types'
import { readFileSync } from 'node:fs'
import { addTemplate, addTypeTemplate } from '@nuxt/kit'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { relative, resolve } from 'pathe'
import { stripLiteral } from 'strip-literal'
import { getRegisteredBaseNames } from './util'

interface TemplateContext {
  nuxt: Nuxt
  config: ModuleOptions
  componentCtx: { components: OgImageComponent[] }
}

/**
 * Extract the type literal from `defineProps<TYPE>()` in a Vue SFC string.
 * Returns null if extraction fails or the type references imported identifiers.
 */
export function extractDefinePropsType(sfcContent: string): string | null {
  const { descriptor } = parseSfc(sfcContent)
  const scriptContent = descriptor.scriptSetup?.content
  if (!scriptContent)
    return null

  // Search on stripped content (comments/strings replaced with spaces, positions preserved)
  // to avoid matching defineProps< inside comments or string literals
  const stripped = stripLiteral(scriptContent)
  const definePropsIndex = stripped.indexOf('defineProps<')
  if (definePropsIndex === -1)
    return null

  // Match balanced angle brackets to extract the type parameter
  const typeStart = definePropsIndex + 'defineProps<'.length
  let depth = 1
  let i = typeStart
  while (i < scriptContent.length && depth > 0) {
    const char = scriptContent[i]
    if (char === '<') {
      depth++
    }
    else if (char === '>') {
      // Skip `=>` (arrow functions) — not a closing angle bracket
      if (i > 0 && scriptContent[i - 1] !== '=')
        depth--
    }
    i++
  }
  if (depth !== 0)
    return null

  const typeString = scriptContent.slice(typeStart, i - 1).trim()
  // Must be an object type literal (not a type reference like `Props`)
  if (!typeString.startsWith('{') || !typeString.endsWith('}'))
    return null

  // Collect imported identifiers from the script
  const importedIdentifiers = new Set<string>()
  const importRegex = /import\s+(?:type\s+)?(?:\{([^}]+)\}|(\w+))/g
  let match
  // eslint-disable-next-line no-cond-assign
  while ((match = importRegex.exec(scriptContent)) !== null) {
    if (match[1]) {
      for (const id of match[1].split(',')) {
        const name = id.trim().split(/\s+as\s+/).pop()?.trim()
        if (name)
          importedIdentifiers.add(name)
      }
    }
    if (match[2])
      importedIdentifiers.add(match[2])
  }

  // Bail if the type references any imported identifier (would need the import context)
  for (const id of importedIdentifiers) {
    if (new RegExp(`\\b${id}\\b`).test(typeString))
      return null
  }

  return typeString
}

/**
 * Get the type expression for a component in the generated declaration.
 *
 * For app components, avoids `typeof import('...vue')['default']` which causes
 * circular type resolution: nuxt.d.ts -> component types -> .vue -> auto-imports -> nuxt.d.ts.
 * Instead, extracts the defineProps type inline or falls back to a generic DefineComponent.
 */
function getComponentTypeExpression(component: OgImageComponent, nuxt: Nuxt): string {
  if (component.category === 'app') {
    let sfcContent: string | null = null
    try {
      sfcContent = component.path ? readFileSync(component.path, 'utf-8') : null
    }
    catch {}
    const extractedProps = sfcContent ? extractDefinePropsType(sfcContent) : null
    return extractedProps
      ? `import('vue').DefineComponent<${extractedProps}>`
      : `import('vue').DefineComponent<Record<string, any>>`
  }
  // Non-app components (community, pro) are pre-compiled with .d.ts — safe to import
  const relativeComponentPath = relative(
    resolve(nuxt.options.rootDir, nuxt.options.buildDir, 'module'),
    component.path!,
  )
  return `typeof import('${relativeComponentPath}')['default']`
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

declare module '#og-image/fonts-available' {
  const fonts: Array<{ family: string, src: string, weight: number, style: string, satoriSrc?: string, unicodeRange?: string }>
  export default fonts
}

declare module '#og-image/font-requirements' {
  export const fontRequirements: {
    weights: number[]
    styles: Array<'normal' | 'italic'>
    families: string[]
    isComplete: boolean
  }
  export const componentFontMap: Record<string, {
    weights: number[]
    styles: Array<'normal' | 'italic'>
    families: string[]
    isComplete: boolean
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
