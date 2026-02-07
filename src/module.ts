import type { AddComponentOptions } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { ResvgRenderOptions } from '@resvg/resvg-js'
import type { SatoriOptions } from 'satori'
import type { SharpOptions } from 'sharp'
import type {
  BrowserConfig,
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
import { addBuildPlugin, addComponent, addComponentsDir, addImports, addPlugin, addServerHandler, addServerPlugin, addTemplate, addVitePlugin, createResolver, defineNuxtModule, getNuxtModuleVersion, hasNuxtModule, hasNuxtModuleCompatibility, updateTemplates } from '@nuxt/kit'
import { defu } from 'defu'
import { createJiti } from 'jiti'
import { installNuxtSiteConfig } from 'nuxt-site-config/kit'
import { hash } from 'ohash'
import { isAbsolute, join, relative } from 'pathe'
import { readPackageJSON } from 'pkg-types'
import { setupBuildHandler } from './build/build'
import { clearTw4Cache, createTw4Provider, extractTw4Metadata } from './build/css/providers/tw4'
import { setupDevHandler } from './build/dev'
import { setupDevToolsUI } from './build/devtools'
import { convertWoff2ToTtf, persistFontUrlMapping, resolveOgImageFonts } from './build/fontless'
import {
  buildFontRequirements,
  copyTtfFontsToOutput,
} from './build/fonts'
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
import { ensureProviderDependencies, getInstalledProviders, getMissingDependencies, getRecommendedBinding, promptForRendererSelection } from './utils/dependencies'

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
   * By default, unicode-range from @font-face declarations is used automatically.
   * Set this to override subset filtering if fonts aren't loading correctly.
   *
   * @default ['latin']
   * @example ['latin', 'latin-ext', 'cyrillic']
   */
  fontSubsets?: string[]
  /**
   * Browser renderer configuration.
   *
   * When using browser-based rendering (screenshots), configure the browser provider.
   * For Cloudflare deployments, specify the browser binding name.
   *
   * @example { provider: 'cloudflare', binding: 'BROWSER' }
   */
  browser?: BrowserConfig
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
      optional: true,
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
      debug: false,
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
      if (key !== 'chromium-node' && key !== 'browser-node' && key in ogImageConfig && ogImageConfig[key] !== undefined) {
        addConfigWarning(key)
      }
    }

    // Check for deprecated browser: 'node' binding (legacy chromium config)
    const browserRuntime = config.compatibility?.runtime?.browser as string | undefined
    if (browserRuntime === 'node') {
      addConfigWarning('browser-node')
    }

    let hasNuxtFonts = hasNuxtModule('@nuxt/fonts')

    // Check @nuxt/fonts version - require 0.13.0+ for proper font extraction
    if (hasNuxtFonts && !await hasNuxtModuleCompatibility('@nuxt/fonts', '>=0.13.0')) {
      const version = await getNuxtModuleVersion('@nuxt/fonts')
      logger.error(
        `@nuxt/fonts ${version} is not supported. Version 0.13.0+ is required for OG image font extraction.\n`
        + `Falling back to bundled Inter font.\n\n`
        + `To fix, update @nuxt/fonts:\n`
        + `  pnpm add @nuxt/fonts@latest\n\n`
        + `Or pin to a specific version in package.json:\n`
        + `  "@nuxt/fonts": "^0.13.0"`,
      )
      hasNuxtFonts = false
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

    // Satori WASM compatibility - 0.16+ uses WebAssembly.instantiate() blocked by edge runtimes
    // See: https://github.com/vercel/satori/issues/693
    const satoriBinding = targetCompatibility.satori
    const isSatoriWasm = typeof satoriBinding === 'string' && satoriBinding.includes('wasm')
    if (isSatoriWasm) {
      const satoriPkg = await readPackageJSON('satori').catch(() => null)
      if (satoriPkg?.version) {
        const [major = 0, minor = 0] = satoriPkg.version.split('.').map(Number)
        if (major > 0 || (major === 0 && minor >= 16)) {
          logger.error(new Error(
            `[nuxt-og-image] Satori ${satoriPkg.version} is incompatible with edge runtimes (${preset}). `
            + `Satori 0.16+ uses WebAssembly.instantiate() which is blocked by edge platforms. `
            + `Pin satori to 0.15.x in your package.json: "satori": "0.15.2". `
            + `See: https://github.com/vercel/satori/issues/693`,
          )) // cant throw for now
        }
      }
    }

    // Cloudflare Workers-specific checks
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

    // CSS provider for class resolution (UnoCSS or TW4)
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
    // Lazy TW4 initialization - all setup deferred until first access (only when not using UnoCSS)
    const tw4State = {
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
      families: [] as string[], // resolved family names; empty = don't filter
      isComplete: true,
      componentMap: {} as Record<string, { weights: number[], styles: Array<'normal' | 'italic'>, families: string[], isComplete: boolean }>,
      scanned: false,
    }
    let fontScanPromise: Promise<void> | undefined

    // Lazy reference to OG image components (populated in components:extend hook)
    let getOgComponents: () => OgImageComponent[] = () => []

    // Lazy font requirements scanner - scans components for font weight/style/family usage
    async function scanFontRequirementsLazy(): Promise<void> {
      if (fontRequirementsState.scanned)
        return
      if (fontScanPromise)
        return fontScanPromise

      fontScanPromise = (async () => {
        const result = await buildFontRequirements({
          components: getOgComponents(),
          buildDir: nuxt.options.buildDir,
          fontVars: tw4State.fontVars,
          logger,
        })
        fontRequirementsState.weights = result.weights
        fontRequirementsState.styles = result.styles
        fontRequirementsState.isComplete = result.isComplete
        fontRequirementsState.families = result.families
        fontRequirementsState.componentMap = result.componentMap
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
      // Shim defineAppConfig (Nuxt auto-import) so jiti can evaluate user's app.config.ts
      const hadShim = 'defineAppConfig' in globalThis
      const prev = (globalThis as any).defineAppConfig
      ;(globalThis as any).defineAppConfig = (c: any) => c
      let mergedAppConfig: { ui?: { colors?: Record<string, string> } }
      try {
        mergedAppConfig = await jiti.evalModule(strippedContent, { filename: appConfigPath }) as typeof mergedAppConfig
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

        let resolvedCssPath: string | undefined
        if (config.tailwindCss) {
          resolvedCssPath = await resolver.resolvePath(config.tailwindCss)
        }
        else {
          // Try alias first, but fall through to auto-detect if it's a virtual module (not a real file)
          const aliasPath = nuxt.options.alias['#tailwindcss'] as string | undefined
          if (aliasPath && existsSync(aliasPath))
            resolvedCssPath = aliasPath
          else
            resolvedCssPath = await detectTailwindCssPath()
        }

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

        logger.debug(`TW4 enabled from ${relative(nuxt.options.rootDir, resolvedCssPath)}`)
        tw4State.initialized = true
      })()
      return tw4InitPromise
    }

    // Create TW4 provider when not using UnoCSS
    if (!cssProvider && cssFramework === 'tailwind') {
      cssProvider = createTw4Provider({
        getCssPath: () => tw4State.cssPath,
        loadNuxtUiColors,
        init: initTw4,
      })
    }

    // Collect resolved OG component directory paths for the asset transform plugin (populated later, accessed via getter)
    const resolvedOgComponentPaths: string[] = []

    // Add Vite plugin in modules:done (after all aliases registered)
    nuxt.hook('modules:done', () => {
      // Handles: emoji → SVG (when local), Icon/UIcon → inline SVG, local images → data URI, CSS class resolution
      addVitePlugin(AssetTransformPlugin.vite({
        emojiSet: buildEmojiSet,
        get ogComponentPaths() { return resolvedOgComponentPaths },
        rootDir: nuxt.options.rootDir,
        srcDir: nuxt.options.srcDir,
        publicDir: join(nuxt.options.srcDir, nuxt.options.dir.public || 'public'),
        cssProvider,
      }))
    })

    if (config.zeroRuntime) {
      config.compatibility = defu(config.compatibility, <CompatibilityFlagEnvOverrides>{
        runtime: {
          browser: false, // should already be false
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
    // Sharp (JPEG output) — independent of renderer choice
    if (!config.zeroRuntime) {
      let attemptSharpUsage = false
      if (isProviderEnabledForEnv('sharp', nuxt, config)) {
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
            await import('sharp')
              .catch(() => {})
              .then(() => {
                attemptSharpUsage = true
              })
          }
        }
        else if (hasConfiguredJpegs) {
          logger.warn('You have enabled `JPEG` images. These require the `sharp` dependency which is missing, installing it for you.')
          await ensureDependencies(['sharp'])
          logger.warn('Support for `sharp` is limited so check the compatibility guide.')
          attemptSharpUsage = true
        }
      }
      if (!attemptSharpUsage) {
        config.compatibility = defu(config.compatibility, <CompatibilityFlagEnvOverrides>{
          runtime: { sharp: false },
          dev: { sharp: false },
          prerender: { sharp: false },
        })
      }
    }

    if (isProviderEnabledForEnv('browser', nuxt, config)) {
      // in dev and prerender we rely on local chrome or playwright dependency
      // for runtime we need playwright dependency (or cloudflare binding)
      const hasChromeLocally = checkLocalChrome()
      const hasPlaywrightDependency = await hasResolvableDependency('playwright')
      const browserCompatibilityFlags = {
        prerender: config.compatibility?.prerender?.browser,
        dev: config.compatibility?.dev?.browser,
        runtime: config.compatibility?.runtime?.browser,
      }
      const browserBinding: Record<string, RuntimeCompatibilitySchema['browser'] | null> = {
        dev: null,
        prerender: null,
        runtime: null,
      }

      // Handle new browser: { provider, binding } config shape
      const browserConfig = config.browser
      const isCloudflareProvider = typeof browserConfig === 'object' && browserConfig?.provider === 'cloudflare'

      if (isCloudflareProvider) {
        // Cloudflare provider: validate binding, use local providers for dev/prerender
        if (!browserConfig.binding) {
          throw new Error('[nuxt-og-image] `ogImage.browser.binding` is required when provider is cloudflare')
        }
        const hasCloudfarePuppeteer = await hasResolvableDependency('@cloudflare/puppeteer')
        if (!hasCloudfarePuppeteer) {
          throw new Error(
            '[nuxt-og-image] Missing @cloudflare/puppeteer dependency. '
            + 'Install it with: pnpm add @cloudflare/puppeteer',
          )
        }
        // Dev: use chrome-launcher (zero config)
        browserBinding.dev = hasChromeLocally ? 'chrome-launcher' : hasPlaywrightDependency ? 'playwright' : 'on-demand'
        // Prerender: use playwright
        browserBinding.prerender = hasPlaywrightDependency ? 'playwright' : hasChromeLocally ? 'chrome-launcher' : 'on-demand'
        // Runtime: use cloudflare
        browserBinding.runtime = 'cloudflare'
      }
      else if (nuxt.options.dev) {
        if (isUndefinedOrTruthy(browserCompatibilityFlags.dev))
          browserBinding.dev = hasChromeLocally ? 'chrome-launcher' : hasPlaywrightDependency ? 'playwright' : 'on-demand'
      }
      else {
        if (isUndefinedOrTruthy(browserCompatibilityFlags.prerender))
          browserBinding.prerender = hasChromeLocally ? 'chrome-launcher' : hasPlaywrightDependency ? 'playwright' : 'on-demand'
        if (isUndefinedOrTruthy(browserCompatibilityFlags.runtime))
          browserBinding.runtime = hasPlaywrightDependency ? 'playwright' : null
      }
      config.compatibility = defu(config.compatibility, <CompatibilityFlagEnvOverrides>{
        runtime: { browser: browserBinding.runtime },
        dev: { browser: browserBinding.dev },
        prerender: { browser: browserBinding.prerender },
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
      { name: 'defineOgImageScreenshot', enabled: isProviderEnabledForEnv('browser', nuxt, config) },
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

    addComponent({
      name: 'OgImageScreenshot',
      filePath: resolve(`./runtime/app/components/OgImage/OgImageScreenshot`),
      ...config.componentOptions,
    })

    const basePluginPath = `./runtime/app/plugins${config.zeroRuntime ? '/__zero-runtime' : ''}`
    // allows us to add og images using route rules without calling defineOgImage
    addPlugin({ mode: 'server', src: resolve(`${basePluginPath}/route-rule-og-image.server`) })
    addPlugin({ mode: 'server', src: resolve(`${basePluginPath}/og-image-canonical-urls.server`) })

    // Register OG component subdirectories (OgImage/, OgImageCommunity/, etc.) found under a root
    function registerOgComponentDir(root: string) {
      for (const componentDir of config.componentDirs) {
        const path = join(root, componentDir)
        if (existsSync(path) && !resolvedOgComponentPaths.includes(path)) {
          resolvedOgComponentPaths.push(path)
          addComponentsDir({
            path,
            island: true,
            watch: IS_MODULE_DEVELOPMENT,
            prefix: componentDir === 'OgImageCommunity' ? 'OgImage' : undefined,
          })
        }
      }
    }

    // 1. Scan layer roots (handles most setups including app/ directory convention)
    for (const layer of (nuxt.options._layers || [])) {
      registerOgComponentDir(join(layer.cwd, 'components'))
      if (layer.config?.srcDir && layer.config.srcDir !== layer.cwd)
        registerOgComponentDir(join(layer.config.srcDir, 'components'))
    }

    // 2. Also hook into Nuxt's resolved component dirs to respect custom configurations
    nuxt.hook('components:dirs', (dirs) => {
      for (const dirConfig of dirs) {
        const dirPath = typeof dirConfig === 'string' ? dirConfig : dirConfig.path
        if (dirPath)
          registerOgComponentDir(dirPath)
      }
    })
    // Also include the module's built-in templates directory
    const builtinTemplatesDir = resolve('./runtime/app/components/Templates')
    if (fs.existsSync(builtinTemplatesDir)) {
      resolvedOgComponentPaths.push(builtinTemplatesDir)
    }

    // we're going to expose the og image components to the ssr build so we can fix prop usage
    const ogImageComponentCtx: { components: OgImageComponent[], detectedRenderers: Set<RendererType> } = { components: [], detectedRenderers: new Set() }
    // Lazy reference for CSS/font scanning - exclude community templates in production (bundled with known styling)
    getOgComponents = () => nuxt.options.dev
      ? ogImageComponentCtx.components
      : ogImageComponentCtx.components.filter(c => c.category !== 'community')

    // Pre-scan component directories to detect renderers early (before nitro hooks fire)
    // This ensures detectedRenderers is populated when nitro:init runs
    let hasUserComponents = false
    for (const resolvedPath of resolvedOgComponentPaths) {
      // OgImageCommunity is module-managed (community templates), not user-provided
      const isUserDir = !resolvedPath.endsWith('/OgImageCommunity')
      if (fs.existsSync(resolvedPath)) {
        const files = fs.readdirSync(resolvedPath).filter(f => f.endsWith('.vue'))
        for (const file of files) {
          const renderer = getRendererFromFilename(file)
          if (renderer) {
            ogImageComponentCtx.detectedRenderers.add(renderer)
            if (isUserDir)
              hasUserComponents = true
          }
        }
      }
    }
    // No user components — auto-detect from installed deps, prompt only if none installed
    if (!nuxt.options._prepare && !hasUserComponents) {
      const installedProviders = await getInstalledProviders()
      const preferred = installedProviders.find(p => p.provider === 'satori') || installedProviders[0]
      if (preferred) {
        ogImageComponentCtx.detectedRenderers.add(preferred.provider)
        logger.debug(`Using ${preferred.provider} renderer`)
      }
      else if (nuxt.options.dev && !nuxt.options._prepare) {
        const renderer = await promptForRendererSelection()
        ogImageComponentCtx.detectedRenderers.add(renderer)
        logger.debug(`Using ${renderer} renderer`)
      }
      else {
        ogImageComponentCtx.detectedRenderers.add(config.defaults.renderer || 'satori')
      }
    }

    const availableRenderers = new Set<RendererType>()
    if (!nuxt.options._prepare) {
      // Ensure renderer dependencies are installed for each detected renderer
      if (!config.zeroRuntime) {
        for (const renderer of ogImageComponentCtx.detectedRenderers) {
          const binding = getRecommendedBinding(renderer, targetCompatibility)
          const missing = await getMissingDependencies(renderer, binding)
          if (missing.length === 0) {
            availableRenderers.add(renderer)
          }
          else if (nuxt.options.dev && !nuxt.options._prepare) {
            logger.warn(`${renderer} renderer requires: ${missing.join(', ')}`)
            const { success } = await ensureProviderDependencies(renderer, binding, nuxt)
            if (success) {
              availableRenderers.add(renderer)
            }
            else {
              logger.error(`Failed to install ${renderer} dependencies. Templates using this renderer won't work.`)
            }
          }
          else {
            logger.error(`${renderer} renderer missing dependencies: ${missing.join(', ')}. Install with: npx nypm add ${missing.join(' ')}`)
          }
          // Set resvg WASM fallback compatibility when satori resolved to wasm binding
          if (renderer === 'satori' && availableRenderers.has(renderer) && binding !== 'node') {
            logger.warn('ReSVG native binding not available. Falling back to WASM version, this may slow down PNG rendering.')
            config.compatibility = defu(config.compatibility, <CompatibilityFlagEnvOverrides>{
              dev: { resvg: 'wasm-fs' },
              prerender: { resvg: 'wasm-fs' },
            })
            if (targetCompatibility.resvg === 'node') {
              config.compatibility = defu(config.compatibility, <CompatibilityFlagEnvOverrides>{
                runtime: { resvg: 'wasm' },
              })
            }
          }
        }
      }
      else {
        // zeroRuntime — all detected renderers considered available
        for (const renderer of ogImageComponentCtx.detectedRenderers)
          availableRenderers.add(renderer)
      }
    }

    // Register community templates for all renderers with available dependencies (dev only)
    // This allows users to use community templates for any renderer, not just ones they've created components for
    if (nuxt.options.dev) {
      const communityRenderers = new Set<RendererType>()
      for (const renderer of (['satori', 'takumi', 'browser'] as const)) {
        const binding = getRecommendedBinding(renderer, targetCompatibility)
        const missing = await getMissingDependencies(renderer, binding)
        if (missing.length === 0)
          communityRenderers.add(renderer)
      }
      const rendererPatterns = [...communityRenderers]
        .map(r => `**/*.${r}.vue`)
      if (rendererPatterns.length > 0) {
        addComponentsDir({
          path: resolve('./runtime/app/components/Templates/Community'),
          pattern: rendererPatterns,
          island: true,
          watch: IS_MODULE_DEVELOPMENT,
        })
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

          component.island = true
          component.mode = 'server'
          let category: OgImageComponent['category'] = 'app'
          if (component.filePath.includes(resolve('./runtime/app/components/Templates/Community')))
            category = 'community'
          // Only add user component renderers to detectedRenderers (community templates use the default)
          if (category !== 'community')
            ogImageComponentCtx.detectedRenderers.add(renderer)
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
              // Convert dot-notation filename to PascalCase to match Nuxt's component naming
              // e.g., NuxtSeo.satori.vue → NuxtSeoSatori (matching what addComponentsDir produces in dev)
              const pascalName = file.replace('.vue', '').split('.').map((s, i) => i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)).join('')
              const filePath = resolve(communityDir, file)
              // skip if already added (user ejected with same name)
              if (ogImageComponentCtx.components.some(c => c.pascalName === pascalName))
                return
              ogImageComponentCtx.components.push({
                hash: '',
                pascalName,
                kebabName: pascalName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(),
                path: filePath,
                category: 'community',
                renderer,
              })
            })
        }
      }

      // Warn about new renderers with missing dependencies (HMR case)
      if (nuxt.options.dev) {
        for (const renderer of ogImageComponentCtx.detectedRenderers) {
          if (!availableRenderers.has(renderer)) {
            const binding = getRecommendedBinding(renderer, targetCompatibility)
            getMissingDependencies(renderer, binding).then((missing) => {
              if (missing.length > 0)
                logger.warn(`New ${renderer} component detected but dependencies missing: ${missing.join(', ')}. Install with: npx nypm add ${missing.join(' ')}`)
            })
          }
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
          const message = `OG Image components missing renderer suffix (.satori.vue, .browser.vue, .takumi.vue):\n${
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
    // When @nuxt/fonts is not installed, serve static Inter TTFs as public assets
    if (!hasNuxtFonts) {
      nuxt.options.nitro.publicAssets ||= []
      nuxt.options.nitro.publicAssets.push({
        dir: resolve('./runtime/public/_og-fonts'),
        baseURL: '/_og-fonts',
        maxAge: 60 * 60 * 24 * 365,
      })
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
    // Track which WOFF2 files were successfully converted to TTF (satori only)
    const convertedWoff2Files = new Set<string>()

    // Whether satori is a detected renderer — gates WOFF2 conversion and fontless logic
    // Takumi and browser renderers handle WOFF2 and variable fonts natively
    const hasSatoriRenderer = () => ogImageComponentCtx.detectedRenderers.has('satori')

    nuxt.options.nitro.virtual['#og-image/fonts'] = async () => {
      await scanFontRequirementsLazy()
      const fonts = await resolveOgImageFonts({
        nuxt,
        hasNuxtFonts,
        hasSatoriRenderer: hasSatoriRenderer(),
        convertedWoff2Files,
        fontSubsets: config.fontSubsets,
        fontRequirements: fontRequirementsState,
        tw4FontVars: tw4State.fontVars,
        logger,
        ogFontsDir: resolve('./runtime/public/_og-fonts'),
      })
      return `export default ${JSON.stringify(fonts)}`
    }

    // Font requirements virtual module - provides detected font weights/styles from component analysis
    nuxt.options.nitro.virtual['#og-image/font-requirements'] = async () => {
      await scanFontRequirementsLazy()
      return `export const fontRequirements = ${JSON.stringify({
        weights: fontRequirementsState.weights,
        styles: fontRequirementsState.styles,
        families: fontRequirementsState.families,
        isComplete: fontRequirementsState.isComplete,
      })}
export const componentFontMap = ${JSON.stringify(fontRequirementsState.componentMap)}`
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

    // @nuxt/fonts + satori font processing — convert WOFF2 to static TTF via fontless
    // Only needed when satori is detected; takumi/browser handle WOFF2 natively
    if (hasNuxtFonts) {
      // Hook into @nuxt/fonts to persist font URL mapping for prerender
      let fontContext: { renderedFontURLs: Map<string, string> } | null = null
      nuxt.hook('fonts:public-asset-context' as any, (ctx: { renderedFontURLs: Map<string, string> }) => {
        fontContext = ctx
      })

      let fontProcessingDone = false
      nuxt.hook('vite:compiled', async () => {
        if (fontProcessingDone || !hasSatoriRenderer())
          return
        persistFontUrlMapping({ fontContext, buildDir: nuxt.options.buildDir, logger })
        await scanFontRequirementsLazy()
        await convertWoff2ToTtf({
          nuxt,
          logger,
          fontRequirements: fontRequirementsState,
          convertedWoff2Files,
          fontSubsets: config.fontSubsets,
        })
        fontProcessingDone = true
      })

      // Copy converted TTFs to output after Nitro copies publicAssets
      nuxt.hook('nitro:build:public-assets' as any, (nitro: any) => {
        if (!hasSatoriRenderer())
          return
        copyTtfFontsToOutput({
          buildDir: nuxt.options.buildDir,
          outputPublicDir: nitro.options.output.publicDir,
          logger,
        })
      })
    }

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
        // Browser renderer config for cloudflare binding access
        browser: typeof config.browser === 'object'
          ? {
              provider: config.browser.provider,
              binding: config.browser.binding,
            }
          : undefined,
      }
      if (nuxt.options.dev) {
        runtimeConfig.componentDirs = config.componentDirs
        runtimeConfig.srcDir = nuxt.options.srcDir
        runtimeConfig.rootDir = nuxt.options.rootDir
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
        const absolutePath = isAbsolute(relativePath) ? relativePath : join(nuxt.options.rootDir, relativePath)

        // Check if TW4 CSS file changed
        const isTw4CssChange = tw4State.cssPath && absolutePath === tw4State.cssPath

        // Check if OgImage component changed
        const isOgImageComponent = config.componentDirs.some((dir) => {
          const componentDir = join(nuxt.options.srcDir, 'components', dir)
          return absolutePath.startsWith(componentDir) && absolutePath.endsWith('.vue')
        })

        if (isTw4CssChange || isOgImageComponent) {
          // Clear TW4 caches - resolveClassesToStyles will re-resolve on next transform
          clearTw4Cache()
          logger.debug('HMR: Cleared TW4 cache')

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
