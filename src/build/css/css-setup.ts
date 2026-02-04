import type { Nuxt } from '@nuxt/schema'
import type { OgImageComponent } from '../../runtime/types'
import type { CssProvider } from './css-provider'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createResolver, hasNuxtModule, useLogger } from '@nuxt/kit'
import { join, relative } from 'pathe'
import { detectCssProvider } from './css-provider'

export interface CssSetupOptions {
  nuxt: Nuxt
  tailwindCssConfig?: string
  /** Callback to get OG image components for class scanning (called lazily during TW4 init) */
  getComponents: () => OgImageComponent[]
}

export interface CssSetupResult {
  cssFramework: 'tailwind' | 'unocss' | null
  cssProvider: CssProvider | undefined
  // TW4-specific (used when cssProvider is undefined)
  tw4State: Tw4State
  initTw4: () => Promise<void>
  loadNuxtUiColors: () => Promise<Record<string, string> | undefined>
}

interface Tw4State {
  styleMap: Record<string, Record<string, string>>
  cssPath: string | undefined
  fontVars: Record<string, string>
  breakpoints: Record<string, number>
  colors: Record<string, string | Record<string, string>>
  nuxtUiColors: Record<string, string> | undefined
  initialized: boolean
}

const nuxtUiDefaults: Record<string, string> = {
  primary: 'green',
  secondary: 'blue',
  success: 'green',
  info: 'blue',
  warning: 'yellow',
  error: 'red',
  neutral: 'slate',
}

export async function setupCssFramework(options: CssSetupOptions): Promise<CssSetupResult> {
  const { nuxt, tailwindCssConfig, getComponents } = options

  const logger = useLogger('@nuxtjs/og-image')
  const { resolvePath } = createResolver(import.meta.url)
  const cssFramework = detectCssProvider(nuxt)
  let cssProvider: CssProvider | undefined

  // TW4 state (used as fallback when no provider)
  const tw4State: Tw4State = {
    styleMap: {},
    cssPath: undefined,
    fontVars: {},
    breakpoints: {},
    colors: {},
    nuxtUiColors: undefined,
    initialized: false,
  }
  let tw4InitPromise: Promise<void> | undefined
  let jitiInstance: ReturnType<typeof import('jiti').createJiti> | undefined

  // Load Nuxt UI colors from .nuxt/app.config.mjs
  async function loadNuxtUiColors(): Promise<Record<string, string> | undefined> {
    if (tw4State.nuxtUiColors)
      return tw4State.nuxtUiColors
    if (!hasNuxtModule('@nuxt/ui'))
      return undefined
    const appConfigPath = join(nuxt.options.buildDir, 'app.config.mjs')
    if (!existsSync(appConfigPath))
      return { ...nuxtUiDefaults }
    const rawContent = await readFile(appConfigPath, 'utf-8')
    // Strip client-side HMR code that can't run in Node
    const strippedContent = rawContent.replace(/\/\*\* client \*\*\/[\s\S]*?\/\*\* client-end \*\*\//g, '')
    // Reuse jiti instance to avoid repeated initialization overhead
    if (!jitiInstance) {
      const { createJiti } = await import('jiti')
      jitiInstance = createJiti(nuxt.options.buildDir, {
        interopDefault: true,
        moduleCache: false,
      })
    }
    // Shim defineAppConfig (Nuxt auto-import) so jiti can evaluate user's app.config.ts
    const hadShim = 'defineAppConfig' in globalThis
    const prev = (globalThis as any).defineAppConfig
    ;(globalThis as any).defineAppConfig = (c: any) => c
    let mergedAppConfig: { ui?: { colors?: Record<string, string> } }
    try {
      mergedAppConfig = await jitiInstance.evalModule(strippedContent, { filename: appConfigPath }) as typeof mergedAppConfig
    }
    finally {
      if (hadShim)
        (globalThis as any).defineAppConfig = prev
      else
        delete (globalThis as any).defineAppConfig
    }
    tw4State.nuxtUiColors = { ...nuxtUiDefaults, ...mergedAppConfig?.ui?.colors }
    logger.debug(`Nuxt UI colors: ${JSON.stringify(tw4State.nuxtUiColors)}`)
    return tw4State.nuxtUiColors
  }

  // Auto-detect Tailwind v4 CSS from nuxt.options.css
  async function detectTailwindCssPath(): Promise<string | undefined> {
    for (const cssEntry of nuxt.options.css) {
      // @ts-expect-error untyped
      const cssPath = typeof cssEntry === 'string' ? cssEntry : cssEntry?.src
      if (!cssPath || !cssPath.endsWith('.css'))
        continue
      const resolved = await resolvePath(cssPath).catch(() => null)
      if (!resolved || !existsSync(resolved))
        continue
      const content = await readFile(resolved, 'utf-8')
      if (content.includes('@import "tailwindcss"') || content.includes('@import \'tailwindcss\''))
        return resolved
    }
  }

  // Lazy TW4 initializer
  async function initTw4(): Promise<void> {
    if (tw4State.initialized)
      return
    if (tw4InitPromise)
      return tw4InitPromise
    tw4InitPromise = (async () => {
      // Skip TW4 initialization when using UnoCSS provider
      if (cssProvider) {
        tw4State.initialized = true
        return
      }

      const resolvedCssPath = tailwindCssConfig
        ? await resolvePath(tailwindCssConfig)
        : nuxt.options.alias['#tailwindcss'] as string | undefined ?? await detectTailwindCssPath()

      tw4State.cssPath = resolvedCssPath
      if (!resolvedCssPath || !existsSync(resolvedCssPath)) {
        tw4State.initialized = true
        return
      }

      const tw4CssContent = await readFile(resolvedCssPath, 'utf-8')
      if (!tw4CssContent.includes('@theme') && !tw4CssContent.includes('@import "tailwindcss"')) {
        tw4State.initialized = true
        return
      }

      // Load Nuxt UI colors
      const nuxtUiColors = await loadNuxtUiColors()

      // Extract TW4 metadata
      const { extractTw4Metadata } = await import('./providers/tw4')
      const metadata = await extractTw4Metadata({
        cssPath: resolvedCssPath,
        nuxtUiColors,
      }).catch((e: Error) => {
        logger.warn(`TW4 metadata extraction failed: ${e.message}`)
        return { fontVars: {}, breakpoints: {}, colors: {} }
      })

      tw4State.fontVars = metadata.fontVars
      tw4State.breakpoints = metadata.breakpoints
      tw4State.colors = metadata.colors

      // Scan all OG components for classes and generate style map
      try {
        const { scanComponentClasses, filterProcessableClasses } = await import('./css-classes')
        const { generateStyleMap } = await import('./providers/tw4')

        const components = getComponents()
        const allClasses = await scanComponentClasses(components, logger, nuxt.options.buildDir)
        const processableClasses = filterProcessableClasses(allClasses)

        if (processableClasses.length > 0) {
          logger.debug(`TW4: Found ${processableClasses.length} unique classes in OG components`)

          const styleMap = await generateStyleMap({
            cssPath: resolvedCssPath,
            classes: processableClasses,
            nuxtUiColors,
          })

          for (const [cls, styles] of styleMap.classes) {
            tw4State.styleMap[cls] = styles
          }

          logger.debug(`TW4: Generated style map with ${Object.keys(tw4State.styleMap).length} resolved classes`)
        }
      }
      catch (e) {
        logger.warn(`TW4 style map generation failed: ${(e as Error).message}`)
      }

      logger.debug(`TW4 enabled from ${relative(nuxt.options.rootDir, resolvedCssPath)}`)
      tw4State.initialized = true
    })()
    return tw4InitPromise
  }

  // Setup UnoCSS provider
  if (cssFramework === 'unocss') {
    logger.info('UnoCSS detected, using UnoCSS provider for OG image styling')
    const { setUnoConfig, createUnoProvider, clearUnoCache } = await import('./providers/uno')

    // Capture UnoCSS config from module hook
    nuxt.hook('unocss:config' as any, (config: any) => {
      setUnoConfig(config)
    })

    cssProvider = createUnoProvider()

    // HMR: watch for uno.config changes
    if (nuxt.options.dev) {
      nuxt.hook('builder:watch', async (_event, relativePath) => {
        if (relativePath.includes('uno.config')) {
          clearUnoCache()
          logger.info('HMR: UnoCSS config changed, cleared cache')
        }
      })
    }
  }
  // Setup Tailwind provider (currently uses legacy tw4State approach)
  else if (cssFramework === 'tailwind') {
    logger.debug('Tailwind CSS detected, using TW4 provider for OG image styling')
    // TW4 uses lazy initialization via initTw4() - no explicit provider yet
    // The vite plugin will call initTw4() on first transform
  }

  return {
    cssFramework,
    cssProvider,
    tw4State,
    initTw4,
    loadNuxtUiColors,
  }
}
