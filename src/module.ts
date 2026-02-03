import type { AddComponentOptions } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { ResvgRenderOptions } from '@resvg/resvg-js'
import type { SatoriOptions } from 'satori'
import type { SharpOptions } from 'sharp'
import type {
  CompatibilityFlagEnvOverrides,
  CompatibilityFlags,
  OgImageComponent,
  OgImageOptions,
  OgImageRuntimeConfig,
  RendererType,
  RuntimeCompatibilitySchema,
} from './runtime/types'
import * as fs from 'node:fs'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { addBuildPlugin, addComponent, addComponentsDir, addImports, addPlugin, addServerHandler, addServerPlugin, addTemplate, addVitePlugin, createResolver, defineNuxtModule, hasNuxtModule, updateTemplates } from '@nuxt/kit'
import { defu } from 'defu'
import { createJiti } from 'jiti'
import { installNuxtSiteConfig } from 'nuxt-site-config/kit'
import { hash } from 'ohash'
import { isAbsolute, join, relative } from 'pathe'
import { readPackageJSON } from 'pkg-types'
import { isDevelopment } from 'std-env'
import { setupBuildHandler } from './build/build'
import { clearTw4Cache, extractTw4Metadata } from './build/css/providers/tw4'
import { setupDevHandler } from './build/dev'
import { setupDevToolsUI } from './build/devtools'
import { setupGenerateHandler } from './build/generate'
import { setupPrerenderHandler } from './build/prerender'
import { TreeShakeComposablesPlugin } from './build/tree-shake-plugin'
import { AssetTransformPlugin } from './build/vite-asset-transform'
import {
  ensureDependencies,
  getPresetNitroPresetCompatibility,
  resolveNitroPreset,
} from './compatibility'
import { getNuxtModuleOptions, isNuxtGenerate } from './kit'
import { addComponentWarning, addConfigWarning, emitWarnings, hasWarnings, REMOVED_CONFIG } from './migrations/warnings'
import { onInstall, onUpgrade } from './onboarding'
import { logger } from './runtime/logger'
import { registerTypeTemplates } from './templates'
import { checkLocalChrome, getRendererFromFilename, hasResolvableDependency, isUndefinedOrTruthy } from './util'

export type {
  OgImageComponent,
  OgImageOptions,
  OgImageRuntimeConfig,
  RuntimeCompatibilitySchema,
} from './runtime/types'
export type { OgImageRenderEventContext, VNode } from './runtime/types'

const IS_MODULE_DEVELOPMENT = import.meta.filename.endsWith('.ts')

export interface ModuleOptions {
  /**
   * Whether the og:image images should be generated.
   *
   * @default true
   */
  enabled: boolean
  /**
   * Default data used within the payload to generate the OG Image.
   *
   * You can use this to change the default template, image sizing and more.
   *
   * @default { component: 'NuxtSeo', width: 1200, height: 630, cache: true, cacheTtl: 24 * 60 * 60 * 1000 }
   */
  defaults: OgImageOptions
  /**
   * Options to pass to satori.
   *
   * @see https://github.com/vercel/satori/blob/main/src/satori.ts#L18
   */
  satoriOptions?: Partial<SatoriOptions>
  /**
   * Options to pass to resvg.
   *
   * @see https://github.com/yisibl/resvg-js/blob/main/wasm/index.d.ts#L39
   */
  resvgOptions?: Partial<ResvgRenderOptions>
  /**
   * Options to pass to sharp.
   *
   * @see https://sharp.pixelplumbing.com/api-constructor
   */
  sharpOptions?: true | Partial<SharpOptions>
  /**
   * Enables debug logs and a debug endpoint.
   *
   * @false false
   */
  debug: boolean
  /**
   * Options to pass to the <OgImage> and <OgImageScreenshot> component.
   */
  componentOptions?: Pick<AddComponentOptions, 'global'>
  /**
   * Configure the runtime cache storage for generated OG images.
   * - `true` - Use Nitro's default cache storage (default)
   * - `false` - Disable caching
   * - `string` - Use a custom storage mount key (e.g., `'redis'`). You must mount the storage yourself via a Nitro plugin.
   * - `object` - Provide a driver config that the module will mount for you (build-time only)
   *
   * @default true
   * @see https://nitro.unjs.io/guide/storage#mountpoints
   * @example runtimeCacheStorage: 'redis' // Use your own mounted 'redis' storage
   * @example runtimeCacheStorage: { driver: 'redis', host: 'localhost', port: 6379 }
   */
  runtimeCacheStorage: boolean | string | (Record<string, any> & {
    driver: string
  })
  /**
   * Custom version string for cache key namespacing.
   *
   * By default, the module version is used which invalidates cache on upgrades.
   * Set a static value like `'v1'` to persist cache across module updates.
   * Set to `false` to disable versioning entirely.
   *
   * @default module version
   * @example cacheVersion: 'v1'
   * @example cacheVersion: false
   */
  cacheVersion?: string | false
  /**
   * Extra component directories that should be used to resolve components.
   *
   * @default ['OgImage', 'og-image', 'OgImageTemplate']
   */
  componentDirs: string[]
  /**
   * Manually modify the compatibility.
   */
  compatibility?: CompatibilityFlagEnvOverrides
  /**
   * Only allow the prerendering and dev runtimes to generate images.
   */
  zeroRuntime?: boolean
  /**
   * Enable persistent build cache for CI environments.
   * Caches rendered images to disk so they persist between CI runs.
   *
   * @default false
   * @example true
   * @example { base: '.cache/og-image' }
   */
  buildCache?: boolean | { base?: string }
  /**
   * Warn about OG Image components missing renderer suffix in dev mode.
   * Set to false to suppress warnings for legacy/test components.
   *
   * @default true
   */
  warnMissingSuffix?: boolean
  /**
   * @deprecated Runtime always uses Iconify API now. Build-time uses local icons if available.
   * Use `defaults.emojis: false` to disable emoji support entirely.
   */
  emojiStrategy?: 'auto' | 'local' | 'fetch'
  /**
   * Include query parameters in cache keys.
   *
   * When enabled, requests like `/page?foo=bar` will have a separate cache from `/page`.
   * Enable this if your OG image content depends on query params.
   *
   * @default false
   */
  cacheQueryParams?: boolean
  /**
   * Path to your Tailwind CSS 4 entry file for OG image styling.
   *
   * Use this when using Tailwind 4 with the Vite plugin instead of @nuxtjs/tailwindcss.
   * The CSS file should include `@import "tailwindcss"` and any `@theme` customizations.
   *
   * @example '~/assets/css/main.css'
   */
  tailwindCss?: string
  /**
   * Font subsets to include for OG image rendering.
   *
   * Google Fonts serves variable fonts as multiple WOFF2 files, one per unicode-range subset.
   * By default, only latin is loaded to reduce memory usage.
   * Add more subsets if your OG images use non-latin characters.
   *
   * @default ['latin']
   * @example ['latin', 'latin-ext', 'cyrillic']
   */
  fontSubsets?: string[]
}

export interface ModuleHooks {
  'nuxt-og-image:components': (ctx: { components: OgImageComponent[] }) => Promise<void> | void
  'nuxt-og-image:runtime-config': (config: ModuleOptions) => Promise<void> | void
}

function isProviderEnabledForEnv(provider: keyof CompatibilityFlags, nuxt: Nuxt, config: ModuleOptions) {
  return (nuxt.options.dev && config.compatibility?.dev?.[provider] !== false) || (!nuxt.options.dev && (config.compatibility?.runtime?.[provider] !== false || config.compatibility?.prerender?.[provider] !== false))
}

const defaultComponentDirs = ['OgImage', 'OgImageCommunity', 'og-image', 'OgImageTemplate']

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-og-image',
    compatibility: {
      nuxt: '>=3.16.0',
    },
    configKey: 'ogImage',
  },
  moduleDependencies: {
    '@nuxt/content': {
      version: '>=3',
      optional: true,
    },
    '@nuxt/fonts': {
      version: '>=0.13.0',
    },
  },
  defaults() {
    return {
      enabled: true,
      defaults: {
        emojis: 'noto',
        component: 'NuxtSeo',
        extension: 'png',
        width: 1200,
        height: 600,
        // default is to cache the image for 3 day (72 hours)
        cacheMaxAgeSeconds: 60 * 60 * 24 * 3,
      },
      componentDirs: defaultComponentDirs,
      runtimeCacheStorage: true,
      debug: isDevelopment,
      fontSubsets: ['latin'],
    }
  },
  async onInstall(nuxt: Nuxt) {
    await onInstall(nuxt)
  },
  async onUpgrade(nuxt: Nuxt, options: ModuleOptions, previousVersion: string) {
    await onUpgrade(nuxt, options, previousVersion)
  },
  async setup(config, nuxt) {
    const _resolver = createResolver(import.meta.url)
    // Fix paths for @nuxt/module-builder bundling into shared/ subdirectory
    // When bundled, import.meta.url points to dist/shared/*.mjs, causing paths like './runtime/...'
    // to incorrectly resolve to dist/shared/runtime/... instead of dist/runtime/...
    // TODO find upstream fix or broken code in module
    const fixSharedPath = (p: string) => {
      if (p.includes('/shared/runtime/'))
        return p.replace('/shared/runtime/', '/runtime/')
      if (p.includes('/shared/client'))
        return p.replace('/shared/client', '/client')
      return p
    }
    const resolve: typeof _resolver.resolve = path => fixSharedPath(_resolver.resolve(path))
    const resolver: typeof _resolver = {
      ..._resolver,
      resolve,
      resolvePath: async (path, opts) => fixSharedPath(await _resolver.resolvePath(path, opts)),
    }
    const { version } = await readPackageJSON(resolve('../package.json'))
    const userAppPkgJson = await readPackageJSON(nuxt.options.rootDir)
      .catch(() => ({ dependencies: {}, devDependencies: {} }))
    logger.level = (config.debug || nuxt.options.debug) ? 4 : 3
    if (config.enabled === false) {
      logger.info('The module is disabled, skipping setup.')
      // need to mock the composables to allow module still to work when disabled
      ;['defineOgImage', 'defineOgImageComponent', 'defineOgImageScreenshot']
        .forEach((name) => {
          addImports({ name, from: resolve(`./runtime/app/composables/mock`) })
        })
      return
    }
    if (config.enabled && !nuxt.options.ssr) {
      logger.warn('Nuxt OG Image is enabled but SSR is disabled.\n\nYou should enable SSR (`ssr: true`) or disable the module (`ogImage: { enabled: false }`).')
      return
    }

    // Check for removed/deprecated config options
    const ogImageConfig = config as unknown as Record<string, unknown>
    for (const key of Object.keys(REMOVED_CONFIG)) {
      if (key !== 'chromium-node' && key in ogImageConfig && ogImageConfig[key] !== undefined) {
        addConfigWarning(key)
      }
    }

    // Check for deprecated chromium: 'node' binding
    const chromiumRuntime = config.compatibility?.runtime?.chromium as string | undefined
    if (chromiumRuntime === 'node') {
      addConfigWarning('chromium-node')
    }

    // Warn about wildcard route rules that may break og-image routes
    const routeRules = nuxt.options.routeRules || {}
    const wildcardPatterns = ['/**', '/*', '*']
    for (const pattern of wildcardPatterns) {
      const rule = routeRules[pattern]
      if (rule && (rule.swr || rule.isr || rule.cache)) {
        logger.warn(`Wildcard route rule \`${pattern}\` with caching (swr/isr/cache) may break og-image routes.`)
        logger.info('See: https://nuxtseo.com/og-image/guides/route-rules#wildcard-route-rules-warning')
        break
      }
    }
    nuxt.options.alias['#og-image'] = resolve('./runtime')
    nuxt.options.alias['#og-image-cache'] = resolve('./runtime/server/og-image/cache/lru')

    // Resolve preset early to check compatibility settings
    const preset = resolveNitroPreset(nuxt.options.nitro)
    const targetCompatibility = getPresetNitroPresetCompatibility(preset)

    // Cloudflare Workers compatibility checks
    const normalizedPreset = preset.replace(/-legacy$/, '')
    const isCloudflareWorkers = ['cloudflare', 'cloudflare-module'].includes(normalizedPreset)
    if (isCloudflareWorkers) {
      // Check for legacy Workers Sites at nitro init (when the actual preset is determined)
      nuxt.hooks.hook('nitro:init', (nitro) => {
        const finalPreset = nitro.options.preset
        const isLegacyPreset = finalPreset.endsWith('-legacy')
        const compatDate = nuxt.options.compatibilityDate
        if (isLegacyPreset || (compatDate && compatDate < '2024-09-19')) {
          logger.warn(
            `Cloudflare Workers with compatibilityDate < 2024-09-19 uses legacy Workers Sites which may have issues loading fonts. `
            + `Update to compatibilityDate: '2024-09-19' or later for Workers Static Assets support.`,
          )
        }
      })
    }

    // Determine emoji strategy for build-time and runtime
    // Build-time: Vite plugin uses local @iconify-json for static emojis in templates
    // Runtime: Always use fetch (Iconify API) to avoid bundling 24MB of icons
    let buildEmojiSet: string | undefined

    // Check if emojis are disabled
    if (config.defaults.emojis === false) {
      logger.debug('Emoji support disabled.')
      nuxt.options.alias['#og-image/emoji-transform'] = resolve('./runtime/server/og-image/satori/transforms/emojis/noop')
      buildEmojiSet = undefined
    }
    else {
      // Build-time: local icons preferred, fetch fallback (inlines static emojis in templates)
      buildEmojiSet = config.defaults.emojis || 'noto'

      // Runtime: always use fetch to avoid 24MB bundle (only needed for dynamic emojis)
      nuxt.options.alias['#og-image/emoji-transform'] = resolve('./runtime/server/og-image/satori/transforms/emojis/fetch')
    }

    // CSS framework detection - supports UnoCSS and Tailwind
    const { detectCssProvider } = await import('./build/css/css-provider')
    const cssFramework = detectCssProvider(nuxt)

    // CSS provider for class resolution (UnoCSS or future providers)
    let cssProvider: import('./build/css/css-provider').CssProvider | undefined

    // UnoCSS provider setup
    if (cssFramework === 'unocss') {
      logger.info('UnoCSS detected, using UnoCSS provider for OG image styling')
      const { setUnoConfig, setUnoRootDir, createUnoProvider, clearUnoCache } = await import('./build/css/providers/uno')

      // Set root directory for loading uno.config.ts
      setUnoRootDir(nuxt.options.rootDir)

      // Capture UnoCSS config from module hook (may have Nuxt-specific settings)
      nuxt.hook('unocss:config' as any, (config: any) => {
        setUnoConfig(config)
      })

      // Create the provider instance
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

    // Add build-time asset transform plugin for OgImage components
    // TW4 support: scan classes → compile with TW4 → resolve vars with postcss → style map
    // Lazy TW4 initialization - all setup deferred until first access (only when not using UnoCSS)
    const tw4State = {
      styleMap: {} as Record<string, Record<string, string>>,
      cssPath: undefined as string | undefined,
      fontVars: {} as Record<string, string>,
      breakpoints: {} as Record<string, number>,
      colors: {} as Record<string, string | Record<string, string>>,
      nuxtUiColors: undefined as Record<string, string> | undefined,
      initialized: false,
    }
    let tw4InitPromise: Promise<void> | undefined

    // Font requirements state - detected from component analysis
    const fontRequirementsState = {
      weights: [400] as number[], // default to 400
      styles: ['normal'] as Array<'normal' | 'italic'>,
      isComplete: true,
      scanned: false,
    }
    let fontScanPromise: Promise<void> | undefined

    // Lazy reference to OG image components (populated in components:extend hook)
    let getOgComponents: () => OgImageComponent[] = () => []

    // Lazy font requirements scanner - scans components for font weight/style usage
    async function scanFontRequirementsLazy(): Promise<void> {
      if (fontRequirementsState.scanned)
        return
      if (fontScanPromise)
        return fontScanPromise

      fontScanPromise = (async () => {
        const { scanFontRequirements } = await import('./build/css/css-classes')
        const requirements = await scanFontRequirements(getOgComponents(), logger, nuxt.options.buildDir)
        fontRequirementsState.weights = requirements.weights
        fontRequirementsState.styles = requirements.styles
        fontRequirementsState.isComplete = requirements.isComplete
        fontRequirementsState.scanned = true
      })()
      return fontScanPromise
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
      const jiti = createJiti(nuxt.options.buildDir, {
        interopDefault: true,
        moduleCache: false,
      })
      const mergedAppConfig = await jiti.evalModule(strippedContent, { filename: appConfigPath }) as { ui?: { colors?: Record<string, string> } }
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
        const resolved = await resolver.resolvePath(cssPath).catch(() => null)
        if (!resolved || !existsSync(resolved))
          continue
        const content = await readFile(resolved, 'utf-8')
        if (content.includes('@import "tailwindcss"') || content.includes('@import \'tailwindcss\''))
          return resolved
      }
    }

    // Lazy initializer - called on first access by vite plugin or virtual module
    async function initTw4(): Promise<void> {
      if (tw4State.initialized)
        return
      if (tw4InitPromise)
        return tw4InitPromise
      tw4InitPromise = (async () => {
        // Skip TW4 initialization when using UnoCSS
        if (cssFramework === 'unocss') {
          tw4State.initialized = true
          return
        }

        const resolvedCssPath = config.tailwindCss
          ? await resolver.resolvePath(config.tailwindCss)
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

        // Load Nuxt UI colors from .nuxt/app.config.mjs
        const nuxtUiColors = await loadNuxtUiColors()

        // Extract TW4 metadata (fonts, breakpoints, colors) for runtime
        const metadata = await extractTw4Metadata({
          cssPath: resolvedCssPath,
          nuxtUiColors,
        }).catch((e) => {
          logger.warn(`TW4 metadata extraction failed: ${e.message}`)
          return { fontVars: {}, breakpoints: {}, colors: {} }
        })

        tw4State.fontVars = metadata.fontVars
        tw4State.breakpoints = metadata.breakpoints
        tw4State.colors = metadata.colors

        // Scan all OG components for classes and generate style map
        try {
          const { scanComponentClasses, filterProcessableClasses } = await import('./build/css/css-classes')
          const { generateStyleMap } = await import('./build/css/providers/tw4')

          const allClasses = await scanComponentClasses(getOgComponents(), logger, nuxt.options.buildDir)
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

    // Collect resolved OG component directory paths for the asset transform plugin (populated later, accessed via getter)
    const resolvedOgComponentPaths: string[] = []

    // Add Vite plugin in modules:done (after all aliases registered)
    nuxt.hook('modules:done', () => {
      // Handles: emoji → SVG (when local), Icon/UIcon → inline SVG, local images → data URI, TW4 custom classes
      addVitePlugin(AssetTransformPlugin.vite({
        emojiSet: buildEmojiSet,
        get ogComponentPaths() { return resolvedOgComponentPaths }, // Resolved OG component directory paths
        rootDir: nuxt.options.rootDir,
        srcDir: nuxt.options.srcDir,
        publicDir: join(nuxt.options.srcDir, nuxt.options.dir.public || 'public'),
        cssProvider, // UnoCSS or other CSS provider (takes precedence over TW4)
        get tw4StyleMap() { return tw4State.styleMap }, // Getter to access populated map
        initTw4, // Lazy initializer - called on first transform
        get tw4CssPath() { return tw4State.cssPath }, // Getter for gradient resolution
        loadNuxtUiColors, // Lazy loader for Nuxt UI colors from .nuxt/app.config.mjs
      }))
    })

    if (config.zeroRuntime) {
      config.compatibility = defu(config.compatibility, <CompatibilityFlagEnvOverrides>{
        runtime: {
          chromium: false, // should already be false
          satori: false,
        },
      })

      if (!nuxt.options.dev) {
        addBuildPlugin(TreeShakeComposablesPlugin, { server: true, client: true, build: true })
        nuxt.options.alias['#og-image-cache'] = resolve('./runtime/server/og-image/cache/mock')
      }
    }
    const basePath = config.zeroRuntime ? './runtime/server/routes/__zero-runtime' : './runtime/server/routes'
    let publicDirAbs = nuxt.options.dir.public
    if (!isAbsolute(publicDirAbs)) {
      publicDirAbs = (publicDirAbs in nuxt.options.alias ? nuxt.options.alias[publicDirAbs] : join(nuxt.options.rootDir, publicDirAbs)) || ''
    }
    if (!config.zeroRuntime && isProviderEnabledForEnv('satori', nuxt, config)) {
      let attemptSharpUsage = false
      if (isProviderEnabledForEnv('sharp', nuxt, config)) {
        // avoid any sharp logic if user explicitly opts-out
        const userConfiguredExtension = config.defaults.extension
        const hasConfiguredJpegs = userConfiguredExtension && ['jpeg', 'jpg'].includes(userConfiguredExtension)
        const allDeps = {
          ...(userAppPkgJson.dependencies || {}),
          ...(userAppPkgJson.devDependencies || {}),
        }
        const hasExplicitSharpDependency = !!config.sharpOptions || 'sharp' in allDeps || hasConfiguredJpegs
        if (hasExplicitSharpDependency) {
          if (!targetCompatibility.sharp) {
            logger.warn(`Rendering JPEGs requires sharp which does not work with ${preset}. Images will be rendered as PNG at runtime.`)
            config.compatibility = defu(config.compatibility, <CompatibilityFlagEnvOverrides>{
              runtime: { sharp: false },
            })
          }
          else {
            // if we can import it then we'll use it
            await import('sharp')
              .catch(() => {})
              .then(() => {
                attemptSharpUsage = true
              })
          }
        }
        else if (hasConfiguredJpegs) {
          // sharp is supported but not installed, and JPEGs need sharp for satori/takumi
          logger.warn('You have enabled `JPEG` images. These require the `sharp` dependency which is missing, installing it for you.')
          await ensureDependencies(['sharp'])
          logger.warn('Support for `sharp` is limited so check the compatibility guide.')
          attemptSharpUsage = true
        }
      }
      if (!attemptSharpUsage) {
        // disable sharp
        config.compatibility = defu(config.compatibility, <CompatibilityFlagEnvOverrides>{
          runtime: { sharp: false },
          dev: { sharp: false },
          prerender: { sharp: false },
        })
      }
      if (isProviderEnabledForEnv('resvg', nuxt, config)) {
        // let's check we can access resvg
        await import('@resvg/resvg-js')
          .catch(() => {
            logger.warn('ReSVG is missing dependencies for environment. Falling back to WASM version, this may slow down PNG rendering.')
            config.compatibility = defu(config.compatibility, <CompatibilityFlagEnvOverrides>{
              dev: { resvg: 'wasm-fs' },
              prerender: { resvg: 'wasm-fs' },
            })
            // swap out runtime node for wasm if we have a broken dependency
            if (targetCompatibility.resvg === 'node') {
              config.compatibility = defu(config.compatibility, <CompatibilityFlagEnvOverrides>{
                runtime: { resvg: 'wasm' },
              })
            }
          })
      }
    }

    if (isProviderEnabledForEnv('chromium', nuxt, config)) {
      // in dev and prerender we rely on local chrome or playwright dependency
      // for runtime we need playwright dependency
      const hasChromeLocally = checkLocalChrome()
      const hasPlaywrightDependency = await hasResolvableDependency('playwright')
      const chromeCompatibilityFlags = {
        prerender: config.compatibility?.prerender?.chromium,
        dev: config.compatibility?.dev?.chromium,
        runtime: config.compatibility?.runtime?.chromium,
      }
      const chromiumBinding: Record<string, RuntimeCompatibilitySchema['chromium'] | null> = {
        dev: null,
        prerender: null,
        runtime: null,
      }
      if (nuxt.options.dev) {
        if (isUndefinedOrTruthy(chromeCompatibilityFlags.dev))
          chromiumBinding.dev = hasChromeLocally ? 'chrome-launcher' : hasPlaywrightDependency ? 'playwright' : 'on-demand'
      }
      else {
        if (isUndefinedOrTruthy(chromeCompatibilityFlags.prerender))
          chromiumBinding.prerender = hasChromeLocally ? 'chrome-launcher' : hasPlaywrightDependency ? 'playwright' : 'on-demand'
        if (isUndefinedOrTruthy(chromeCompatibilityFlags.runtime))
          chromiumBinding.runtime = hasPlaywrightDependency ? 'playwright' : null
      }
      config.compatibility = defu(config.compatibility, <CompatibilityFlagEnvOverrides>{
        runtime: { chromium: chromiumBinding.runtime },
        dev: { chromium: chromiumBinding.dev },
        prerender: { chromium: chromiumBinding.prerender },
      })
    }

    await installNuxtSiteConfig()

    nuxt.options.experimental.componentIslands ||= true

    if (config.debug || nuxt.options.dev) {
      addServerHandler({
        lazy: true,
        route: '/_og/debug.json',
        handler: resolve('./runtime/server/routes/debug.json'),
      })
    }
    addServerHandler({
      lazy: true,
      route: '/_og/d/**',
      handler: resolve(`${basePath}/image`),
    })
    // prerender only
    addServerHandler({
      lazy: true,
      route: '/_og/s/**',
      handler: resolve(`${basePath}/image`),
    })

    if (!nuxt.options.dev) {
      nuxt.options.optimization.treeShake.composables.client['nuxt-og-image'] = []
    }

    ;[
      'defineOgImage',
      'defineOgImageComponent',
      { name: 'defineOgImageScreenshot', enabled: isProviderEnabledForEnv('chromium', nuxt, config) },
    ]
      .forEach((name) => {
        if (typeof name === 'object') {
          if (!name.enabled) {
            addImports({ name: name.name, from: resolve(`./runtime/app/composables/mock`) })
            return
          }
          name = name.name
        }
        addImports({
          name,
          from: resolve(`./runtime/app/composables/${name}`),
        })
        if (!nuxt.options.dev) {
          nuxt.options.optimization.treeShake.composables.client = nuxt.options.optimization.treeShake.composables.client || {}
          nuxt.options.optimization.treeShake.composables.client['nuxt-og-image'] = nuxt.options.optimization.treeShake.composables.client['nuxt-og-image'] || []
          nuxt.options.optimization.treeShake.composables.client['nuxt-og-image'].push(name)
        }
      })

    // community templates only in dev - must be ejected for production
    if (nuxt.options.dev) {
      addComponentsDir({
        path: resolve('./runtime/app/components/Templates/Community'),
        island: true,
        watch: IS_MODULE_DEVELOPMENT,
      })
    }

    addComponent({
      name: 'OgImageScreenshot',
      filePath: resolve(`./runtime/app/components/OgImage/OgImageScreenshot`),
      ...config.componentOptions,
    })

    const basePluginPath = `./runtime/app/plugins${config.zeroRuntime ? '/__zero-runtime' : ''}`
    // allows us to add og images using route rules without calling defineOgImage
    addPlugin({ mode: 'server', src: resolve(`${basePluginPath}/route-rule-og-image.server`) })
    addPlugin({ mode: 'server', src: resolve(`${basePluginPath}/og-image-canonical-urls.server`) })

    // Register OgImage component directories from all configured component roots (supports layers)
    const componentRoots = await Promise.all(
      (nuxt.options.components as { dirs?: (string | { path: string })[] })?.dirs?.map(async (dir) => {
        const dirPath = typeof dir === 'string' ? dir : dir.path
        return resolver.resolvePath(dirPath).catch(() => null)
      }) || [],
    ).then(paths => paths.filter(Boolean) as string[])

    // Populate resolved OG component directory paths
    for (const componentDir of config.componentDirs) {
      let found = false
      for (const root of componentRoots) {
        const path = join(root, componentDir)
        if (existsSync(path)) {
          found = true
          resolvedOgComponentPaths.push(path)
          addComponentsDir({
            path,
            island: true,
            watch: IS_MODULE_DEVELOPMENT,
            prefix: componentDir === 'OgImageCommunity' ? 'OgImage' : undefined,
          })
        }
      }
      if (!found && !defaultComponentDirs.includes(componentDir)) {
        logger.warn(`The configured component directory \`${componentDir}\` does not exist in any component root. Skipping.`)
      }
    }
    // Also include the module's built-in templates directory
    const builtinTemplatesDir = resolve('./runtime/app/components/Templates')
    if (fs.existsSync(builtinTemplatesDir)) {
      resolvedOgComponentPaths.push(builtinTemplatesDir)
    }

    // we're going to expose the og image components to the ssr build so we can fix prop usage
    const ogImageComponentCtx: { components: OgImageComponent[], detectedRenderers: Set<RendererType> } = { components: [], detectedRenderers: new Set() }
    // Set lazy reference for TW4 class scanning
    getOgComponents = () => ogImageComponentCtx.components

    // Pre-scan component directories to detect renderers early (before nitro hooks fire)
    // This ensures detectedRenderers is populated when nitro:init runs
    let hasUserComponents = false
    for (const componentDir of config.componentDirs) {
      for (const root of componentRoots) {
        const path = join(root, componentDir)
        if (fs.existsSync(path)) {
          const files = fs.readdirSync(path).filter(f => f.endsWith('.vue'))
          for (const file of files) {
            const renderer = getRendererFromFilename(file)
            if (renderer) {
              ogImageComponentCtx.detectedRenderers.add(renderer)
              hasUserComponents = true
            }
          }
        }
      }
    }
    // Only include community template renderers if user has no components of their own
    // This prevents bundling unused renderer bindings (e.g., resvg-wasm for satori when only takumi is used)
    const communityDir = resolve('./runtime/app/components/Templates/Community')
    if (!hasUserComponents && fs.existsSync(communityDir)) {
      const files = fs.readdirSync(communityDir).filter(f => f.endsWith('.vue'))
      for (const file of files) {
        const renderer = getRendererFromFilename(file)
        if (renderer)
          ogImageComponentCtx.detectedRenderers.add(renderer)
      }
    }
    nuxt.hook('components:extend', (components) => {
      ogImageComponentCtx.components = []
      // Don't clear detectedRenderers - pre-scan already populated it and nitro:init may have already fired
      const invalidComponents: string[] = []

      // check if the component is in an OgImage component directory
      // Only use directory-based detection (matching CLI migration logic) to avoid false positives
      // e.g. components/content/OgImageExample.vue should NOT be treated as an OG Image template
      components.forEach((component) => {
        let valid = false
        config.componentDirs.forEach((dir) => {
          if (component.shortPath.includes(`components/${dir}/`)) {
            valid = true
          }
        })
        if (component.filePath.includes(resolve('./runtime/app/components/Templates')))
          valid = true

        if (valid && fs.existsSync(component.filePath)) {
          // Only validate .vue files - non-vue files (like OgImageScreenshot.ts) are runtime components, not templates
          if (!component.filePath.endsWith('.vue'))
            return

          const renderer = getRendererFromFilename(component.filePath)

          if (!renderer) {
            invalidComponents.push(component.filePath)
            return
          }

          ogImageComponentCtx.detectedRenderers.add(renderer)

          component.island = true
          component.mode = 'server'
          let category: OgImageComponent['category'] = 'app'
          if (component.filePath.includes(resolve('./runtime/app/components/Templates/Community')))
            category = 'community'
          const componentFile = fs.readFileSync(component.filePath, 'utf-8')
          const credits = componentFile.split('\n').find(line => line.startsWith(' * @credits'))?.replace('* @credits', '').trim()
          ogImageComponentCtx.components.push({
            hash: hash(componentFile).replaceAll('_', '-'),
            pascalName: component.pascalName,
            kebabName: component.kebabName,
            path: component.filePath,
            category,
            credits,
            renderer,
          })
        }
      })

      // in production, add community template metadata for validation (not registered as components)
      if (!nuxt.options.dev) {
        const communityDir = resolve('./runtime/app/components/Templates/Community')
        if (fs.existsSync(communityDir)) {
          fs.readdirSync(communityDir)
            .filter(f => f.endsWith('.vue'))
            .forEach((file) => {
              const renderer = getRendererFromFilename(file)
              if (!renderer)
                return
              const name = file.replace('.vue', '')
              const filePath = resolve(communityDir, file)
              // skip if already added (user ejected with same name)
              if (ogImageComponentCtx.components.some(c => c.pascalName === name))
                return
              ogImageComponentCtx.components.push({
                hash: '',
                pascalName: name,
                kebabName: name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(),
                path: filePath,
                category: 'community',
                renderer,
              })
              ogImageComponentCtx.detectedRenderers.add(renderer)
            })
        }
      }

      // Validate: collect warnings in dev, error in prod for missing suffix
      if (invalidComponents.length > 0) {
        if (nuxt.options.dev) {
          if (config.warnMissingSuffix !== false) {
            for (const componentPath of invalidComponents) {
              addComponentWarning(componentPath)
            }
          }
        }
        else {
          const message = `OG Image components missing renderer suffix (.satori.vue, .chromium.vue, .takumi.vue):\n${
            invalidComponents.map(c => `  ${c}`).join('\n')
          }\n\nRun: npx nuxt-og-image migrate v6`
          throw new Error(message)
        }
      }

      // @ts-expect-error untyped
      nuxt.hooks.hook('nuxt-og-image:components', ogImageComponentCtx)
    })
    addTemplate({
      filename: 'nuxt-og-image/components.mjs',
      getContents() {
        return `export const componentNames = ${JSON.stringify(ogImageComponentCtx.components)}`
      },
      options: { mode: 'server' },
    })

    nuxt.options.nitro.virtual = nuxt.options.nitro.virtual || {}
    nuxt.options.nitro.virtual['#og-image-virtual/component-names.mjs'] = () => {
      return `export const componentNames = ${JSON.stringify(ogImageComponentCtx.components)}`
    }
    nuxt.options.nitro.virtual['#og-image-virtual/public-assets.mjs'] = async () => {
      // Use dev-prerender binding which handles dev/prerender/runtime for node
      // Use cloudflare binding for cloudflare presets at runtime
      const normalizedPreset = preset.replace(/-legacy$/, '')
      const isCloudflare = ['cloudflare', 'cloudflare-pages', 'cloudflare-module'].includes(normalizedPreset)
      if (isCloudflare) {
        const devBinding = resolver.resolve('./runtime/server/og-image/bindings/font-assets/dev-prerender')
        const cfBinding = resolver.resolve('./runtime/server/og-image/bindings/font-assets/cloudflare')
        return `
import { resolve as devResolve } from '${devBinding}'
import { resolve as cfResolve } from '${cfBinding}'
export const resolve = (import.meta.dev || import.meta.prerender) ? devResolve : cfResolve
`
      }
      // For non-cloudflare (node), use dev-prerender for everything
      return `export { resolve } from '${resolver.resolve('./runtime/server/og-image/bindings/font-assets/dev-prerender')}'`
    }
    nuxt.options.nitro.virtual['#og-image/fonts'] = async () => {
      // find nuxt-fonts-global.css template
      const templates = nuxt.options.build.templates
      const nuxtFontsTemplate = templates.find(t => t.filename?.endsWith('nuxt-fonts-global.css'))
      if (!nuxtFontsTemplate?.getContents) {
        return `export default []`
      }
      const contents = await nuxtFontsTemplate.getContents({} as any)

      // parse @font-face blocks with optional subset comment (e.g. /* latin */)
      // Google Fonts CSS includes subset comments before each @font-face block
      const fontFaceRegex = /(?:\/\*\s*([a-z-]+)\s*\*\/\s*)?@font-face\s*\{([^}]+)\}/g
      const fonts: Array<{ family: string, src: string, weight: number, style: string }> = []
      const configuredSubsets = config.fontSubsets || ['latin']

      for (const match of contents.matchAll(fontFaceRegex)) {
        const subsetComment = match[1] // e.g. 'latin', 'cyrillic-ext'
        const block = match[2]
        if (!block)
          continue

        // Filter by configured font subsets (if subset comment present)
        // Non-Google fonts without subset comments are always included
        if (subsetComment && !configuredSubsets.includes(subsetComment))
          continue

        const family = block.match(/font-family:\s*['"]?([^'";]+)['"]?/)?.[1]?.trim()
        const src = block.match(/url\(["']?([^)"']+)["']?\)/)?.[1]
        // Handle both single weights (400) and ranges (200 900) for variable fonts
        const weightMatch = block.match(/font-weight:\s*(\d+)(?:\s+(\d+))?/)
        let weight = 400
        if (weightMatch) {
          const minWeight = Number.parseInt(weightMatch[1]!, 10)
          const maxWeight = weightMatch[2] ? Number.parseInt(weightMatch[2], 10) : minWeight
          // For variable fonts with ranges, use 400 if in range, otherwise use min
          weight = (minWeight <= 400 && maxWeight >= 400) ? 400 : minWeight
        }
        const style = block.match(/font-style:\s*(\w+)/)?.[1] || 'normal'

        if (family && src) {
          fonts.push({ family, src, weight, style })
        }
      }
      // warn at build time if satori will have issues (no non-woff2 fonts)
      const familiesWithNonWoff2 = new Set(fonts.filter(f => !f.src.endsWith('.woff2')).map(f => f.family))
      const warnedFamilies = new Set<string>()
      for (const f of fonts) {
        if (f.src.endsWith('.woff2') && !familiesWithNonWoff2.has(f.family) && !warnedFamilies.has(f.family)) {
          warnedFamilies.add(f.family)
          logger.warn(`WOFF2-only font detected (${f.family}). Satori renderer does not support WOFF2 - use Takumi renderer or provide WOFF/TTF alternatives.`)
        }
      }
      logger.debug(`Extracted ${fonts.length} fonts from @nuxt/fonts (subsets: ${configuredSubsets.join(', ')})`)
      return `export default ${JSON.stringify(fonts)}`
    }

    // Font requirements virtual module - provides detected font weights/styles from component analysis
    nuxt.options.nitro.virtual['#og-image/font-requirements'] = async () => {
      await scanFontRequirementsLazy()
      return `export const fontRequirements = ${JSON.stringify({
        weights: fontRequirementsState.weights,
        styles: fontRequirementsState.styles,
        isComplete: fontRequirementsState.isComplete,
      })}`
    }

    // TW4 theme vars virtual module - provides fonts, breakpoints, and colors from @theme
    // Note: classMap is NOT included here as it's too heavy - transforms happen at build time via AssetTransformPlugin
    nuxt.options.nitro.virtual['#og-image-virtual/tw4-theme.mjs'] = () => {
      return `export const tw4FontVars = ${JSON.stringify(tw4State.fontVars)}
export const tw4Breakpoints = ${JSON.stringify(tw4State.breakpoints)}
export const tw4Colors = ${JSON.stringify(tw4State.colors)}`
    }
    nuxt.options.nitro.virtual['#og-image-virtual/build-dir.mjs'] = () => {
      return `export const buildDir = ${JSON.stringify(nuxt.options.buildDir)}`
    }

    // Hook into @nuxt/fonts to persist font URL mapping for prerender
    // fonts:public-asset-context fires at modules:done, giving us a reference to the context
    // We then read from renderedFontURLs in vite:compiled when it's populated
    let fontContext: { renderedFontURLs: Map<string, string> } | null = null
    nuxt.hook('fonts:public-asset-context' as any, (ctx: { renderedFontURLs: Map<string, string> }) => {
      fontContext = ctx
    })
    nuxt.hook('vite:compiled', () => {
      if (fontContext?.renderedFontURLs.size) {
        const cacheDir = join(nuxt.options.buildDir, 'cache', 'og-image')
        fs.mkdirSync(cacheDir, { recursive: true })
        const mapping = Object.fromEntries(fontContext.renderedFontURLs)
        fs.writeFileSync(join(cacheDir, 'font-urls.json'), JSON.stringify(mapping))
        logger.debug(`Persisted ${fontContext.renderedFontURLs.size} font URLs for prerender`)
      }
    })

    registerTypeTemplates({
      nuxt,
      config,
      componentCtx: ogImageComponentCtx,
    })

    const cacheEnabled = typeof config.runtimeCacheStorage !== 'undefined' && config.runtimeCacheStorage !== false
    const cacheVersion = config.cacheVersion === false ? '' : (config.cacheVersion ?? version)
    const versionSuffix = cacheVersion ? `/${cacheVersion}` : ''
    let baseCacheKey: string | false
    if (config.runtimeCacheStorage === true) {
      // default: use nitro's built-in cache storage
      baseCacheKey = `/cache/nuxt-og-image${versionSuffix}`
    }
    else if (typeof config.runtimeCacheStorage === 'string') {
      // string: user provides their own storage mount key
      baseCacheKey = `/${config.runtimeCacheStorage}/nuxt-og-image${versionSuffix}`
    }
    else if (typeof config.runtimeCacheStorage === 'object') {
      // object: module mounts the storage
      baseCacheKey = `/nuxt-og-image${versionSuffix}`
      if (!nuxt.options.dev) {
        nuxt.options.nitro.storage = nuxt.options.nitro.storage || {}
        nuxt.options.nitro.storage['nuxt-og-image'] = config.runtimeCacheStorage
      }
    }
    else {
      baseCacheKey = false
    }
    if (!cacheEnabled)
      baseCacheKey = false

    // Build cache for CI persistence (absolute path)
    const buildCachePath = typeof config.buildCache === 'object' && config.buildCache.base
      ? config.buildCache.base
      : 'node_modules/.cache/nuxt-seo/og-image'
    const buildCacheDir = config.buildCache
      ? join(nuxt.options.rootDir, buildCachePath)
      : undefined
    nuxt.hooks.hook('modules:done', async () => {
      // allow other modules to modify runtime data
      if (!isNuxtGenerate() && nuxt.options.build) {
        nuxt.options.nitro = nuxt.options.nitro || {}
        nuxt.options.nitro.prerender = nuxt.options.nitro.prerender || {}
        nuxt.options.nitro.prerender.routes = nuxt.options.nitro.prerender.routes || []
      }

      // set theme color for the NuxtSeo component
      type ColorMode = 'light' | 'dark' | 'system'
      const hasColorModeModule = hasNuxtModule('@nuxtjs/color-mode')
      const colorModeOptions: { fallback?: ColorMode, preference?: ColorMode } = hasColorModeModule
        ? (await getNuxtModuleOptions('@nuxtjs/color-mode') as { fallback?: ColorMode, preference?: ColorMode })
        : {}
      let colorPreference = colorModeOptions.preference
      if (!colorPreference || colorPreference === 'system')
        colorPreference = colorModeOptions.fallback
      if (!colorPreference || colorPreference === 'system')
        colorPreference = 'light'
      const runtimeConfig = <OgImageRuntimeConfig>{
        version,
        // binding options
        satoriOptions: config.satoriOptions || {},
        resvgOptions: config.resvgOptions || {},
        sharpOptions: config.sharpOptions === true ? {} : (config.sharpOptions || {}),
        publicStoragePath: `root${publicDirAbs.replace(nuxt.options.rootDir, '').replaceAll('/', ':')}`,

        defaults: config.defaults,
        debug: config.debug,
        // avoid adding credentials
        baseCacheKey,
        buildCacheDir,
        hasNuxtIcon: hasNuxtModule('nuxt-icon') || hasNuxtModule('@nuxt/icon'),
        colorPreference,

        // @ts-expect-error runtime type
        isNuxtContentDocumentDriven: !!nuxt.options.content?.documentDriven,
        cacheQueryParams: config.cacheQueryParams ?? false,
        cssFramework: cssFramework || 'none',
      }
      if (nuxt.options.dev) {
        runtimeConfig.componentDirs = config.componentDirs
        runtimeConfig.srcDir = nuxt.options.srcDir
        runtimeConfig.communityTemplatesDir = resolve('./runtime/app/components/Templates/Community')
      }
      // @ts-expect-error untyped
      nuxt.hooks.callHook('nuxt-og-image:runtime-config', runtimeConfig)
      // @ts-expect-error untyped
      nuxt.options.runtimeConfig['nuxt-og-image'] = runtimeConfig
    })

    // Setup playground. Only available in development
    const getDetectedRenderers = () => ogImageComponentCtx.detectedRenderers
    if (nuxt.options.dev) {
      setupDevHandler(config, resolver, getDetectedRenderers)
      setupDevToolsUI(config, resolve)

      // Capture Nitro for HMR reload
      const useNitro = new Promise<import('nitropack/types').Nitro>((resolveNitro) => {
        nuxt.hooks.hook('nitro:init', resolveNitro)
      })

      // HMR: watch for TW4 CSS and OgImage component changes
      nuxt.hook('builder:watch', async (_event, relativePath) => {
        const absolutePath = join(nuxt.options.rootDir, relativePath)

        // Check if TW4 CSS file changed
        const isTw4CssChange = tw4State.cssPath && absolutePath === tw4State.cssPath

        // Check if OgImage component changed
        const isOgImageComponent = config.componentDirs.some((dir) => {
          const componentDir = join(nuxt.options.srcDir, 'components', dir)
          return absolutePath.startsWith(componentDir) && absolutePath.endsWith('.vue')
        })

        if (isTw4CssChange || isOgImageComponent) {
          // Clear TW4 caches
          clearTw4Cache()

          // Regenerate style map if TW4 is enabled
          if (tw4State.cssPath && existsSync(tw4State.cssPath)) {
            const { scanComponentClasses, filterProcessableClasses } = await import('./build/css/css-classes')
            const { generateStyleMap } = await import('./build/css/providers/tw4')

            const allClasses = await scanComponentClasses(getOgComponents(), logger, nuxt.options.buildDir)
            const processableClasses = filterProcessableClasses(allClasses)

            if (processableClasses.length > 0) {
              const nuxtUiColors = await loadNuxtUiColors()
              const styleMap = await generateStyleMap({
                cssPath: tw4State.cssPath,
                classes: processableClasses,
                nuxtUiColors,
              })
              tw4State.styleMap = {}
              for (const [cls, styles] of styleMap.classes) {
                tw4State.styleMap[cls] = styles
              }
              logger.info(`HMR: Regenerated TW4 style map (${Object.keys(tw4State.styleMap).length} classes)`)
            }
          }

          // Update templates to refresh virtual modules and trigger Nitro reload
          await updateTemplates({ filter: t => t.filename.includes('nuxt-og-image') })
          const nitro = await useNitro
          await nitro.hooks.callHook('rollup:reload')
        }
      })
    }
    else if (isNuxtGenerate()) {
      setupGenerateHandler(config, resolver, getDetectedRenderers)
    }
    else if (nuxt.options.build) {
      await setupBuildHandler(config, resolver, getDetectedRenderers)
    }
    // no way to know if we'll prerender any routes
    if (nuxt.options.build)
      addServerPlugin(resolve('./runtime/server/plugins/prerender'))
    // always call this as we may have routes only discovered at build time
    setupPrerenderHandler(config, resolver, getDetectedRenderers)

    // Emit migration warnings at end of setup (dev only)
    if (nuxt.options.dev && hasWarnings()) {
      // Delay to ensure all warnings are collected
      nuxt.hook('ready', () => {
        emitWarnings()
      })
    }
  },
})
